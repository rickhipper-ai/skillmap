import { HttpProblem } from '../../plugins/problem-details.js';
import {
  calculateRequiredPercentage,
  evaluateStepTransition,
  getStepEligibility,
  trailStatus,
  type StepState,
} from './domain.js';
import {
  ProgressRepository,
  type StoredProgressEvent,
  type StoredTrailState,
  type TrailPublication,
} from './repository.js';

export interface ProgressCommand {
  state: StepState;
  baseStreamVersion: number;
  supersedesEventId?: number | null | undefined;
}

export interface TrailProgress {
  trailId: string;
  currentRevisionId: string;
  status: 'in_progress' | 'completed';
  percentage: number;
  streamVersion: number;
  catalogChanged: boolean;
  reviewRequired: boolean;
  steps: Array<{
    stepId: string;
    state: StepState;
    eligible: boolean;
    pendingPrerequisiteStepIds: string[];
  }>;
  history: Array<{
    eventId: number;
    stepId: string;
    state: StepState;
    occurredAt: string;
    source: StoredProgressEvent['source'];
    supersedesEventId?: number | undefined;
    observedRevisionId: string;
  }>;
}

export interface ProgressCommandResult {
  eventId: number;
  streamVersion: number;
  state: StepState;
  reviewRequired: boolean;
  trailProgress: TrailProgress;
}

export class ProgressService {
  constructor(private readonly repository: ProgressRepository) {}

  async start(userId: string, trailId: string, commandId: string): Promise<TrailProgress> {
    try {
      return await this.repository.transaction(async (repository) => {
        const prior = await repository.findStartCommand(commandId);
        if (prior && (prior.userId !== userId || prior.trailId !== trailId)) {
          throw conflict('IDEMPOTENCY_KEY_REUSED');
        }
        const trail = await repository.getPublishedTrail(trailId);
        if (!trail) throw notFound('PUBLISHED_TRAIL_NOT_FOUND');
        await repository.createEnrollment(userId, trail, commandId);
        const state = await repository.getTrailState(userId, trailId, true);
        return this.current(repository, state!, trail, true);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('IDEMPOTENCY_KEY_REUSED');
      throw error;
    }
  }

  get(userId: string, trailId: string): Promise<TrailProgress> {
    return this.repository.transaction(async (repository) => {
      const state = await repository.getTrailState(userId, trailId, true);
      if (!state) throw notFound('TRAIL_PROGRESS_NOT_FOUND');
      const trail = await repository.getPublishedTrail(trailId);
      if (!trail) throw notFound('PUBLISHED_TRAIL_NOT_FOUND');
      return this.current(repository, state, trail, true);
    });
  }

  append(
    userId: string,
    trailId: string,
    stepId: string,
    commandId: string,
    command: ProgressCommand,
  ): Promise<ProgressCommandResult> {
    return this.repository.transaction(async (repository) => {
      const state = await repository.getTrailState(userId, trailId, true);
      if (!state) throw notFound('TRAIL_PROGRESS_NOT_FOUND');

      const prior = await repository.findCommand(commandId);
      if (prior) {
        if (prior.userId !== userId || prior.trailId !== trailId || prior.stepId !== stepId) {
          throw conflict('IDEMPOTENCY_KEY_REUSED');
        }
        const trail = await repository.getPublishedTrail(trailId);
        if (!trail) throw notFound('PUBLISHED_TRAIL_NOT_FOUND');
        const current = await this.current(repository, state, trail, false);
        return commandResult(prior, current);
      }

      const trail = await repository.getPublishedTrail(trailId);
      if (!trail) throw notFound('PUBLISHED_TRAIL_NOT_FOUND');
      if (!trail.steps.some((step) => step.stepId === stepId)) {
        throw notFound('PUBLISHED_TRAIL_STEP_NOT_FOUND');
      }

      const states = await repository.getStepStates(userId, trailId);
      const transition = evaluateStepTransition(
        states.get(stepId) ?? 'not_started',
        command.state,
        getStepEligibility(stepId, trail.steps, states),
      );
      if (!transition.accepted) {
        const problem = new HttpProblem({
          status: 422,
          title: 'Validation failed',
          code: 'PENDING_PREREQUISITES',
          extensions: {
            pendingPrerequisiteStepIds: transition.pendingPrerequisiteStepIds,
            errors: transition.pendingPrerequisiteStepIds.map((pendingId) => ({
              path: '/state',
              code: 'pending_prerequisite',
              message: pendingId,
            })),
          },
        });
        Object.assign(problem, {
          pendingPrerequisiteStepIds: transition.pendingPrerequisiteStepIds,
        });
        throw problem;
      }

      if (command.supersedesEventId != null) {
        const superseded = await repository.findEvent(
          userId,
          trailId,
          stepId,
          command.supersedesEventId,
        );
        if (!superseded) {
          throw new HttpProblem({
            status: 422,
            title: 'Validation failed',
            code: 'INVALID_SUPERSEDED_EVENT',
            extensions: {
              errors: [
                {
                  path: '/supersedesEventId',
                  code: 'invalid_superseded_event',
                  message: String(command.supersedesEventId),
                },
              ],
            },
          });
        }
      }

      const event = await repository.appendEvent({
        userId,
        trailId,
        stepId,
        revisionId: trail.revisionId,
        state: transition.state,
        source: 'user',
        commandId,
        baseStreamVersion: command.baseStreamVersion,
        streamVersion: state.streamVersion + 1,
        ...(command.supersedesEventId != null
          ? { supersedesEventId: command.supersedesEventId }
          : {}),
      });
      await repository.upsertStepState(event);
      states.set(stepId, transition.state);
      const reviewRequired =
        state.reviewRequired || command.baseStreamVersion !== state.streamVersion;
      await repository.updateTrailProjection({
        userId,
        trailId,
        revisionId: trail.revisionId,
        status: trailStatus(trail.steps, states),
        streamVersion: event.streamVersion,
        reviewRequired,
        activityAt: event.occurredAt,
      });
      const updatedState: StoredTrailState = {
        ...state,
        status: trailStatus(trail.steps, states),
        streamVersion: event.streamVersion,
        lastSeenRevisionId: trail.revisionId,
        lastActivityAt: event.occurredAt,
        reviewRequired,
      };
      const current = await this.current(repository, updatedState, trail, false);
      return commandResult(event, current);
    });
  }

  private async current(
    repository: ProgressRepository,
    state: StoredTrailState,
    trail: TrailPublication,
    persistRecalculation: boolean,
  ): Promise<TrailProgress> {
    const states = await repository.getStepStates(state.userId, state.trailId);
    const events = await repository.getEvents(state.userId, state.trailId);
    const status = trailStatus(trail.steps, states);
    const catalogChanged = state.lastSeenRevisionId !== trail.revisionId;
    if (persistRecalculation) {
      await repository.updateTrailProjection({
        userId: state.userId,
        trailId: state.trailId,
        revisionId: trail.revisionId,
        status,
        streamVersion: state.streamVersion,
        reviewRequired: state.reviewRequired,
      });
    }
    return {
      trailId: trail.trailId,
      currentRevisionId: trail.revisionId,
      status,
      percentage: calculateRequiredPercentage(trail.steps, states),
      streamVersion: state.streamVersion,
      catalogChanged,
      reviewRequired: state.reviewRequired,
      steps: trail.steps.map((step) => ({
        stepId: step.stepId,
        state: states.get(step.stepId) ?? 'not_started',
        ...getStepEligibility(step.stepId, trail.steps, states),
      })),
      history: events.map((event) => ({
        eventId: event.eventId,
        stepId: event.stepId,
        state: event.state,
        occurredAt: event.occurredAt.toISOString(),
        source: event.source,
        ...(event.supersedesEventId !== null ? { supersedesEventId: event.supersedesEventId } : {}),
        observedRevisionId: event.observedRevisionId,
      })),
    };
  }
}

function commandResult(
  event: StoredProgressEvent,
  trailProgress: TrailProgress,
): ProgressCommandResult {
  return {
    eventId: event.eventId,
    streamVersion: event.streamVersion,
    state: event.state,
    reviewRequired: trailProgress.reviewRequired,
    trailProgress,
  };
}

function notFound(code: string) {
  return new HttpProblem({ status: 404, title: 'Not Found', code });
}

function conflict(code: string) {
  return new HttpProblem({ status: 409, title: 'Conflict', code });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}
