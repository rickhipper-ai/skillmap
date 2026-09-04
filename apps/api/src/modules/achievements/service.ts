import { sql, type Kysely, type Transaction } from 'kysely';

import type { FoundationDatabase } from '../../plugins/database.js';
import {
  evaluateAchievement,
  parseAchievementCriterion,
  type AchievementTrigger,
} from './evaluator.js';

export type AchievementDatabase = Kysely<FoundationDatabase> | Transaction<FoundationDatabase>;

export interface AchievementAward {
  achievementId: string;
  title: string;
  description: string;
  awardedAt: string;
}

interface RevisionRow {
  achievement_id: string;
  revision_id: string;
  criterion_type: 'completed_steps' | 'certification_records';
  criterion_parameters: { minimum?: unknown };
}

interface FactsRow {
  completed_steps: string | number;
  certification_records: string | number;
}

interface AwardRow {
  achievement_id: string;
  title: string;
  description: string;
  awarded_at: Date;
}

export class AchievementService {
  constructor(private readonly database: AchievementDatabase) {}

  evaluate(
    event: { userId: string; trigger: AchievementTrigger },
    executor?: AchievementDatabase,
  ): Promise<void> {
    if (executor) return this.evaluateInTransaction(event, executor);
    return this.database
      .transaction()
      .execute((transaction) => this.evaluateInTransaction(event, transaction));
  }

  private async evaluateInTransaction(
    event: { userId: string; trigger: AchievementTrigger },
    executor: AchievementDatabase,
  ): Promise<void> {
    const [factsResult, revisionsResult] = await Promise.all([
      sql<FactsRow>`
        SELECT
          (SELECT count(*) FROM user_step_states
            WHERE user_id = ${event.userId}::uuid AND current_state = 'completed') AS completed_steps,
          (SELECT count(*) FROM user_certification_records
            WHERE user_id = ${event.userId}::uuid) AS certification_records
      `.execute(executor),
      sql<RevisionRow>`
        SELECT achievement.id AS achievement_id, revision.id AS revision_id,
          revision.criterion_type, revision.criterion_parameters
        FROM achievements achievement
        JOIN achievement_revisions revision ON revision.id = achievement.published_revision_id
        WHERE achievement.status = 'published'
        ORDER BY achievement.id
      `.execute(executor),
    ]);
    const row = factsResult.rows[0]!;
    const facts = {
      completedSteps: Number(row.completed_steps),
      certificationRecords: Number(row.certification_records),
    };

    for (const revision of revisionsResult.rows) {
      const criterion = parseAchievementCriterion({
        type: revision.criterion_type,
        minimum: revision.criterion_parameters.minimum,
      });
      const evidence = evaluateAchievement(criterion, facts, event.trigger);
      if (!evidence) continue;
      await sql`
        INSERT INTO user_achievement_awards
          (user_id, achievement_id, achievement_revision_id, evidence)
        VALUES (${event.userId}::uuid, ${revision.achievement_id}::uuid,
          ${revision.revision_id}::uuid, ${JSON.stringify(evidence)}::jsonb)
        ON CONFLICT (user_id, achievement_id) DO NOTHING
      `.execute(executor);
    }
  }

  async list(userId: string): Promise<AchievementAward[]> {
    const result = await sql<AwardRow>`
      SELECT award.achievement_id, revision.title, revision.description, award.awarded_at
      FROM user_achievement_awards award
      JOIN achievement_revisions revision ON revision.id = award.achievement_revision_id
      WHERE award.user_id = ${userId}::uuid
      ORDER BY award.awarded_at DESC, award.achievement_id
    `.execute(this.database);
    return result.rows.map((row) => ({
      achievementId: row.achievement_id,
      title: row.title,
      description: row.description,
      awardedAt: row.awarded_at.toISOString(),
    }));
  }

  listAchievementAwards(userId: string): Promise<AchievementAward[]> {
    return this.list(userId);
  }
}
