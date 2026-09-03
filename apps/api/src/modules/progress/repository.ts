import { sql, type Kysely, type Transaction } from 'kysely';

import type { FoundationDatabase } from '../../plugins/database.js';
import {
  calculateRequiredPercentage,
  trailStatus,
  type ProgressStep,
  type StepState,
} from './domain.js';
import { projectProgressEvents } from './projector.js';

type DatabaseExecutor = Kysely<FoundationDatabase> | Transaction<FoundationDatabase>;

export interface TrailPublication {
  trailId: string;
  revisionId: string;
  steps: ProgressStep[];
}

export interface StoredTrailState {
  userId: string;
  trailId: string;
  status: 'in_progress' | 'completed';
  streamVersion: number;
  startedAt: Date;
  lastActivityAt: Date;
  lastSeenRevisionId: string;
  reviewRequired: boolean;
  startCommandId: string;
}

export interface StoredProgressEvent {
  eventId: number;
  userId: string;
  trailId: string;
  stepId: string;
  observedRevisionId: string;
  state: StepState;
  source: 'user' | 'admin_correction' | 'system';
  commandId: string;
  baseStreamVersion: number;
  streamVersion: number;
  supersedesEventId: number | null;
  occurredAt: Date;
}

interface TrailRow {
  trail_id: string;
  revision_id: string;
  step_id: string;
  required: boolean;
  prerequisite_step_ids: string[];
}

interface TrailStateRow {
  user_id: string;
  trail_id: string;
  status: 'in_progress' | 'completed';
  current_stream_version: string | number;
  started_at: Date;
  last_activity_at: Date;
  last_seen_revision_id: string;
  review_required: boolean;
  start_command_id: string;
}

interface EventRow {
  id: string | number;
  user_id: string;
  trail_id: string;
  step_id: string;
  observed_trail_revision_id: string;
  new_state: StepState;
  source: 'user' | 'admin_correction' | 'system';
  command_id: string;
  base_stream_version: string | number;
  stream_version: string | number;
  supersedes_event_id: string | number | null;
  occurred_at: Date;
}

export class ProgressRepository {
  constructor(
    private readonly database: DatabaseExecutor,
    private readonly transactional = false,
  ) {}

  transaction<T>(run: (repository: ProgressRepository) => Promise<T>): Promise<T> {
    if (this.transactional) return run(this);
    return this.database
      .transaction()
      .execute((transaction) => run(new ProgressRepository(transaction, true)));
  }

  async getPublishedTrail(trailId: string): Promise<TrailPublication | null> {
    const result = await sql<TrailRow>`
      SELECT trail.id AS trail_id, trail.published_revision_id AS revision_id,
             revision_step.step_id, revision_step.required,
             COALESCE(
               array_agg(prerequisite.prerequisite_step_id ORDER BY prerequisite.prerequisite_step_id)
                 FILTER (WHERE prerequisite.prerequisite_step_id IS NOT NULL),
               ARRAY[]::uuid[]
             ) AS prerequisite_step_ids
      FROM learning_trails trail
      JOIN trail_revision_steps revision_step
        ON revision_step.trail_revision_id = trail.published_revision_id
      LEFT JOIN trail_step_prerequisites prerequisite
        ON prerequisite.trail_revision_id = revision_step.trail_revision_id
       AND prerequisite.step_id = revision_step.step_id
      WHERE trail.id = ${trailId}::uuid
        AND trail.status = 'published'
        AND trail.published_revision_id IS NOT NULL
      GROUP BY trail.id, trail.published_revision_id, revision_step.step_id,
               revision_step.position, revision_step.required
      ORDER BY revision_step.position
    `.execute(this.database);
    if (!result.rows[0]) return null;
    return {
      trailId: result.rows[0].trail_id,
      revisionId: result.rows[0].revision_id,
      steps: result.rows.map((row) => ({
        stepId: row.step_id,
        required: row.required,
        prerequisiteStepIds: row.prerequisite_step_ids,
      })),
    };
  }

  async createEnrollment(
    userId: string,
    trail: TrailPublication,
    commandId: string,
  ): Promise<void> {
    await sql`
      INSERT INTO user_trail_states
        (user_id, trail_id, status, current_stream_version, started_at, last_activity_at,
         last_seen_revision_id, review_required, start_command_id)
      VALUES (${userId}::uuid, ${trail.trailId}::uuid, 'in_progress', 0, now(), now(),
              ${trail.revisionId}::uuid, false, ${commandId}::uuid)
      ON CONFLICT (user_id, trail_id) DO NOTHING
    `.execute(this.database);
  }

  async getTrailState(
    userId: string,
    trailId: string,
    lock = false,
  ): Promise<StoredTrailState | null> {
    const result = await sql<TrailStateRow>`
      SELECT user_id, trail_id, status, current_stream_version, started_at, last_activity_at,
             last_seen_revision_id, review_required, start_command_id
      FROM user_trail_states
      WHERE user_id = ${userId}::uuid AND trail_id = ${trailId}::uuid
      ${lock ? sql`FOR UPDATE` : sql``}
    `.execute(this.database);
    return result.rows[0] ? mapTrailState(result.rows[0]) : null;
  }

  async findStartCommand(commandId: string): Promise<{ userId: string; trailId: string } | null> {
    const result = await sql<{ user_id: string; trail_id: string }>`
      SELECT user_id, trail_id FROM user_trail_states WHERE start_command_id = ${commandId}::uuid
    `.execute(this.database);
    const row = result.rows[0];
    return row ? { userId: row.user_id, trailId: row.trail_id } : null;
  }

  async findCommand(commandId: string): Promise<StoredProgressEvent | null> {
    const result = await sql<EventRow>`
      SELECT * FROM progress_events WHERE command_id = ${commandId}::uuid
    `.execute(this.database);
    return result.rows[0] ? mapEvent(result.rows[0]) : null;
  }

  async findEvent(
    userId: string,
    trailId: string,
    stepId: string,
    eventId: number,
  ): Promise<StoredProgressEvent | null> {
    const result = await sql<EventRow>`
      SELECT * FROM progress_events
      WHERE id = ${eventId} AND user_id = ${userId}::uuid AND trail_id = ${trailId}::uuid
        AND step_id = ${stepId}::uuid
    `.execute(this.database);
    return result.rows[0] ? mapEvent(result.rows[0]) : null;
  }

  async appendEvent(input: {
    userId: string;
    trailId: string;
    stepId: string;
    revisionId: string;
    state: StepState;
    source: StoredProgressEvent['source'];
    commandId: string;
    baseStreamVersion: number;
    streamVersion: number;
    supersedesEventId?: number | undefined;
  }): Promise<StoredProgressEvent> {
    const result = await sql<EventRow>`
      INSERT INTO progress_events
        (user_id, trail_id, step_id, observed_trail_revision_id, new_state, source,
         command_id, base_stream_version, stream_version, supersedes_event_id)
      VALUES (${input.userId}::uuid, ${input.trailId}::uuid, ${input.stepId}::uuid,
              ${input.revisionId}::uuid, ${input.state}::progress_step_state,
              ${input.source}::progress_event_source, ${input.commandId}::uuid,
              ${input.baseStreamVersion}, ${input.streamVersion},
              ${input.supersedesEventId ?? null})
      RETURNING *
    `.execute(this.database);
    return mapEvent(result.rows[0]!);
  }

  async upsertStepState(event: StoredProgressEvent): Promise<void> {
    await sql`
      INSERT INTO user_step_states
        (user_id, trail_id, step_id, current_state, latest_event_id, updated_at)
      VALUES (${event.userId}::uuid, ${event.trailId}::uuid, ${event.stepId}::uuid,
              ${event.state}::progress_step_state, ${event.eventId}, ${event.occurredAt})
      ON CONFLICT (user_id, trail_id, step_id) DO UPDATE
      SET current_state = EXCLUDED.current_state,
          latest_event_id = EXCLUDED.latest_event_id,
          updated_at = EXCLUDED.updated_at
    `.execute(this.database);
  }

  async getStepStates(userId: string, trailId: string): Promise<Map<string, StepState>> {
    const result = await sql<{ step_id: string; current_state: StepState }>`
      SELECT step_id, current_state FROM user_step_states
      WHERE user_id = ${userId}::uuid AND trail_id = ${trailId}::uuid
    `.execute(this.database);
    return new Map(result.rows.map((row) => [row.step_id, row.current_state]));
  }

  async getEvents(userId: string, trailId: string): Promise<StoredProgressEvent[]> {
    const result = await sql<EventRow>`
      SELECT * FROM progress_events
      WHERE user_id = ${userId}::uuid AND trail_id = ${trailId}::uuid
      ORDER BY stream_version, id
    `.execute(this.database);
    return result.rows.map(mapEvent);
  }

  async updateTrailProjection(input: {
    userId: string;
    trailId: string;
    revisionId: string;
    status: 'in_progress' | 'completed';
    streamVersion: number;
    reviewRequired: boolean;
    activityAt?: Date | undefined;
  }): Promise<void> {
    await sql`
      UPDATE user_trail_states
      SET status = ${input.status}::user_trail_status,
          current_stream_version = ${input.streamVersion},
          last_seen_revision_id = ${input.revisionId}::uuid,
          review_required = ${input.reviewRequired},
          last_activity_at = ${input.activityAt ?? sql.ref('last_activity_at')}
      WHERE user_id = ${input.userId}::uuid AND trail_id = ${input.trailId}::uuid
    `.execute(this.database);
  }

  async rebuild(userId: string, trailId: string): Promise<void> {
    await this.transaction(async (repository) => {
      const state = await repository.getTrailState(userId, trailId, true);
      const trail = await repository.getPublishedTrail(trailId);
      if (!state || !trail) throw new Error('PROGRESS_REBUILD_TARGET_NOT_FOUND');
      const events = await repository.getEvents(userId, trailId);
      const projection = projectProgressEvents(events);

      await sql`
        DELETE FROM user_step_states
        WHERE user_id = ${userId}::uuid AND trail_id = ${trailId}::uuid
      `.execute(repository.database);
      for (const projected of projection.stepStates.values()) {
        const event = events.find((candidate) => candidate.eventId === projected.latestEventId)!;
        await repository.upsertStepState(event);
      }
      const states = new Map(
        [...projection.stepStates].map(([stepId, value]) => [stepId, value.state] as const),
      );
      await repository.updateTrailProjection({
        userId,
        trailId,
        revisionId: trail.revisionId,
        status: trailStatus(trail.steps, states),
        streamVersion: projection.streamVersion,
        reviewRequired: projection.reviewRequired,
        activityAt: events.at(-1)?.occurredAt ?? state.startedAt,
      });
      calculateRequiredPercentage(trail.steps, states);
    });
  }
}

function mapTrailState(row: TrailStateRow): StoredTrailState {
  return {
    userId: row.user_id,
    trailId: row.trail_id,
    status: row.status,
    streamVersion: Number(row.current_stream_version),
    startedAt: row.started_at,
    lastActivityAt: row.last_activity_at,
    lastSeenRevisionId: row.last_seen_revision_id,
    reviewRequired: row.review_required,
    startCommandId: row.start_command_id,
  };
}

function mapEvent(row: EventRow): StoredProgressEvent {
  return {
    eventId: Number(row.id),
    userId: row.user_id,
    trailId: row.trail_id,
    stepId: row.step_id,
    observedRevisionId: row.observed_trail_revision_id,
    state: row.new_state,
    source: row.source,
    commandId: row.command_id,
    baseStreamVersion: Number(row.base_stream_version),
    streamVersion: Number(row.stream_version),
    supersedesEventId: row.supersedes_event_id === null ? null : Number(row.supersedes_event_id),
    occurredAt: row.occurred_at,
  };
}
