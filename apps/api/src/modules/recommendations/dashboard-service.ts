import { sql, type Kysely } from 'kysely';

import type { FoundationDatabase } from '../../plugins/database.js';
import {
  calculateRequiredPercentage,
  getStepEligibility,
  trailStatus,
  type ProgressStep,
  type StepState,
} from '../progress/domain.js';
import {
  evaluateRecommendations,
  type ActiveTrailInput,
  type EvaluatedRecommendation,
  type PublishedTrailInput,
  type RecommendationRuleSet,
} from './engine.js';

export interface DashboardTrailSummary {
  trailId: string;
  title: string;
  currentRevisionId: string;
  percentage: number;
  streamVersion: number;
  lastActivityAt: string;
  catalogChanged: boolean;
}

export interface DashboardCertificationRecord {
  id: string;
  certificationId: string;
  obtainedOn: string;
  externalIdentifier?: string | null;
  expiresOn?: string | null;
  verificationStatus: 'self_declared';
  createdAt: string;
}

export interface DashboardAchievementAward {
  achievementId: string;
  title: string;
  description?: string;
  awardedAt: string;
}

export interface DashboardSupplementSource {
  listCertificationRecords(userId: string): Promise<DashboardCertificationRecord[]>;
  listAchievementAwards(userId: string): Promise<DashboardAchievementAward[]>;
}

export interface DashboardRecommendation extends Omit<
  EvaluatedRecommendation,
  'catalogRevisionId'
> {
  id: string;
  inputVersions: {
    ruleSetVersion: number;
    profileVersion: number;
    progressStreamVersion: number;
    catalogRevisionId: string;
  };
}

export interface Dashboard {
  activeTrails: DashboardTrailSummary[];
  certificationRecords: DashboardCertificationRecord[];
  achievements: DashboardAchievementAward[];
  recommendations: DashboardRecommendation[];
}

interface ProfileRow {
  desired_role_id: string | null;
  profile_version: string | number;
  category_ids: string[];
  skill_ids: string[];
}

interface ActiveStepRow {
  trail_id: string;
  revision_id: string;
  title: string;
  last_seen_revision_id: string;
  current_stream_version: string | number;
  last_activity_at: Date;
  catalog_change_pending: boolean;
  step_id: string;
  step_title: string;
  position: number;
  required: boolean;
  current_state: StepState | null;
  prerequisite_step_ids: string[];
}

interface TrailCandidateRow {
  trail_id: string;
  revision_id: string;
  title: string;
  category_id: string;
  target_role_ids: string[];
  skill_ids: string[];
}

const emptySupplements: DashboardSupplementSource = {
  async listCertificationRecords() {
    return [];
  },
  async listAchievementAwards() {
    return [];
  },
};

export class DashboardService {
  constructor(
    private readonly database: Kysely<FoundationDatabase>,
    private readonly supplements: DashboardSupplementSource = emptySupplements,
  ) {}

  async get(userId: string): Promise<Dashboard> {
    const [ruleSet, profile, activeRows, progressVersion, certificationRecords, achievements] =
      await Promise.all([
        this.getRuleSet(),
        this.getProfile(userId),
        this.getProgressRows(userId),
        this.getProgressVersion(userId),
        this.supplements.listCertificationRecords(userId),
        this.supplements.listAchievementAwards(userId),
      ]);
    const activeTrails = mapActiveTrails(activeRows);
    const publishedTrails = activeTrails.length === 0 ? await this.getTrailCandidates(userId) : [];
    const evaluated = evaluateRecommendations({
      ruleSet,
      profile: profile
        ? {
            desiredRoleId: profile.desired_role_id,
            interestCategoryIds: profile.category_ids,
            interestSkillIds: profile.skill_ids,
          }
        : null,
      activeTrails: activeTrails.map(({ input }) => input),
      publishedTrails,
    });
    const profileVersion = Number(profile?.profile_version ?? 0);
    const recommendations = await Promise.all(
      evaluated.map(async (recommendation) => {
        const id = await this.storeSnapshot(
          userId,
          ruleSet,
          recommendation,
          profileVersion,
          progressVersion,
        );
        const { catalogRevisionId, ...response } = recommendation;
        return {
          id,
          ...response,
          inputVersions: {
            ruleSetVersion: ruleSet.version,
            profileVersion,
            progressStreamVersion: progressVersion,
            catalogRevisionId,
          },
        };
      }),
    );

    return {
      activeTrails: activeTrails.map(({ summary }) => summary),
      certificationRecords,
      achievements,
      recommendations,
    };
  }

  private async getRuleSet(): Promise<RecommendationRuleSet> {
    const result = await sql<{
      id: string;
      version: string | number;
      rules: RecommendationRuleSet['rules'];
    }>`
      SELECT id, version, rules
      FROM recommendation_rule_sets
      WHERE status = 'published'
      ORDER BY version DESC
      LIMIT 1
    `.execute(this.database);
    const row = result.rows[0];
    if (!row) throw new Error('PUBLISHED_RECOMMENDATION_RULE_SET_NOT_FOUND');
    return { id: row.id, version: Number(row.version), rules: row.rules };
  }

  private async getProfile(userId: string): Promise<ProfileRow | null> {
    const result = await sql<ProfileRow>`
      SELECT profile.desired_role_id, profile.profile_version,
        ARRAY(
          SELECT category_id FROM profile_interest_categories
          WHERE user_id = profile.user_id ORDER BY category_id
        ) AS category_ids,
        ARRAY(
          SELECT skill_id FROM profile_interest_skills
          WHERE user_id = profile.user_id ORDER BY skill_id
        ) AS skill_ids
      FROM professional_profiles profile
      WHERE profile.user_id = ${userId}::uuid
    `.execute(this.database);
    return result.rows[0] ?? null;
  }

  private async getProgressRows(userId: string): Promise<ActiveStepRow[]> {
    const result = await sql<ActiveStepRow>`
      SELECT state.trail_id, trail.published_revision_id AS revision_id, revision.title,
        state.last_seen_revision_id, state.current_stream_version, state.last_activity_at,
        state.catalog_change_pending,
        revision_step.step_id, revision_step.title AS step_title, revision_step.position,
        revision_step.required, step_state.current_state,
        COALESCE(
          array_agg(prerequisite.prerequisite_step_id ORDER BY prerequisite.prerequisite_step_id)
            FILTER (WHERE prerequisite.prerequisite_step_id IS NOT NULL),
          ARRAY[]::uuid[]
        ) AS prerequisite_step_ids
      FROM user_trail_states state
      JOIN learning_trails trail
        ON trail.id = state.trail_id
       AND trail.status = 'published'
       AND trail.published_revision_id IS NOT NULL
      JOIN trail_revisions revision ON revision.id = trail.published_revision_id
      JOIN trail_revision_steps revision_step ON revision_step.trail_revision_id = revision.id
      LEFT JOIN user_step_states step_state
        ON step_state.user_id = state.user_id
       AND step_state.trail_id = state.trail_id
       AND step_state.step_id = revision_step.step_id
      LEFT JOIN trail_step_prerequisites prerequisite
        ON prerequisite.trail_revision_id = revision_step.trail_revision_id
       AND prerequisite.step_id = revision_step.step_id
      WHERE state.user_id = ${userId}::uuid
      GROUP BY state.trail_id, trail.published_revision_id, revision.title,
        state.last_seen_revision_id, state.current_stream_version, state.last_activity_at,
        state.catalog_change_pending,
        revision_step.step_id, revision_step.title, revision_step.position,
        revision_step.required, step_state.current_state
      ORDER BY state.last_activity_at DESC, state.trail_id, revision_step.position
    `.execute(this.database);
    return result.rows;
  }

  private async getProgressVersion(userId: string): Promise<number> {
    const result = await sql<{ version: string | number }>`
      SELECT COALESCE(sum(current_stream_version), 0) AS version
      FROM user_trail_states
      WHERE user_id = ${userId}::uuid
    `.execute(this.database);
    return Number(result.rows[0]?.version ?? 0);
  }

  private async getTrailCandidates(userId: string): Promise<PublishedTrailInput[]> {
    const result = await sql<TrailCandidateRow>`
      SELECT trail.id AS trail_id, revision.id AS revision_id, revision.title,
        revision.category_id,
        COALESCE(
          array_agg(DISTINCT target_role.professional_role_id)
            FILTER (WHERE target_role.professional_role_id IS NOT NULL),
          ARRAY[]::uuid[]
        ) AS target_role_ids,
        COALESCE(
          array_agg(DISTINCT step_skill.skill_id)
            FILTER (WHERE step_skill.skill_id IS NOT NULL),
          ARRAY[]::uuid[]
        ) AS skill_ids
      FROM learning_trails trail
      JOIN trail_revisions revision ON revision.id = trail.published_revision_id
      LEFT JOIN trail_target_roles target_role ON target_role.trail_revision_id = revision.id
      LEFT JOIN trail_step_skills step_skill ON step_skill.trail_revision_id = revision.id
      WHERE trail.status = 'published'
        AND NOT EXISTS (
          SELECT 1 FROM user_trail_states state
          WHERE state.user_id = ${userId}::uuid AND state.trail_id = trail.id
        )
      GROUP BY trail.id, revision.id, revision.title, revision.category_id
      ORDER BY trail.id
    `.execute(this.database);
    return result.rows.map((row) => ({
      trailId: row.trail_id,
      title: row.title,
      revisionId: row.revision_id,
      categoryId: row.category_id,
      targetRoleIds: row.target_role_ids,
      skillIds: row.skill_ids,
    }));
  }

  private async storeSnapshot(
    userId: string,
    ruleSet: RecommendationRuleSet,
    recommendation: EvaluatedRecommendation,
    profileVersion: number,
    progressVersion: number,
  ): Promise<string> {
    const result = await sql<{ id: string }>`
      INSERT INTO learning_recommendations
        (user_id, rule_set_id, target_type, trail_id, step_id, rank, reason_code,
         evidence, profile_version, progress_stream_version, catalog_revision_id)
      VALUES (
        ${userId}::uuid, ${ruleSet.id}::uuid,
        ${recommendation.targetType}::recommendation_target_type,
        ${recommendation.trailId}::uuid, ${recommendation.stepId}::uuid,
        ${recommendation.rank}, ${recommendation.reasonCode}::recommendation_reason_code,
        ${JSON.stringify(recommendation.evidence)}::jsonb, ${profileVersion}, ${progressVersion},
        ${recommendation.catalogRevisionId}::uuid
      )
      RETURNING id
    `.execute(this.database);
    return result.rows[0]!.id;
  }
}

function mapActiveTrails(
  rows: ActiveStepRow[],
): Array<{ summary: DashboardTrailSummary; input: ActiveTrailInput }> {
  const grouped = new Map<string, ActiveStepRow[]>();
  for (const row of rows) grouped.set(row.trail_id, [...(grouped.get(row.trail_id) ?? []), row]);

  return [...grouped.values()].flatMap((trailRows) => {
    const first = trailRows[0]!;
    const steps: ProgressStep[] = trailRows.map((row) => ({
      stepId: row.step_id,
      required: row.required,
      prerequisiteStepIds: row.prerequisite_step_ids,
    }));
    const states = new Map(
      trailRows
        .filter((row) => row.current_state !== null)
        .map((row) => [row.step_id, row.current_state!] as const),
    );
    if (trailStatus(steps, states) !== 'in_progress') return [];
    const streamVersion = Number(first.current_stream_version);
    return [
      {
        summary: {
          trailId: first.trail_id,
          title: first.title,
          currentRevisionId: first.revision_id,
          percentage: calculateRequiredPercentage(steps, states),
          streamVersion,
          lastActivityAt: first.last_activity_at.toISOString(),
          catalogChanged:
            first.catalog_change_pending || first.last_seen_revision_id !== first.revision_id,
        },
        input: {
          trailId: first.trail_id,
          title: first.title,
          revisionId: first.revision_id,
          lastActivityAt: first.last_activity_at.toISOString(),
          streamVersion,
          steps: trailRows.map((row) => ({
            stepId: row.step_id,
            title: row.step_title,
            position: row.position,
            state: row.current_state ?? 'not_started',
            eligible: getStepEligibility(row.step_id, steps, states).eligible,
            prerequisiteStepIds: row.prerequisite_step_ids,
          })),
        },
      },
    ];
  });
}
