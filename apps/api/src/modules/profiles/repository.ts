import { sql, type Kysely } from 'kysely';

import type { FoundationDatabase } from '../../plugins/database.js';

export interface ProfessionalProfile {
  displayName: string;
  currentRoleId: string | null;
  desiredRoleId: string | null;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced';
  interestCategoryIds: string[];
  interestSkillIds: string[];
}

export class ProfileRepository {
  constructor(private readonly db: Kysely<FoundationDatabase>) {}

  async get(userId: string): Promise<ProfessionalProfile | null> {
    const result = await sql<{
      display_name: string;
      current_role_id: string | null;
      desired_role_id: string | null;
      experience_level: ProfessionalProfile['experienceLevel'];
      category_ids: string[];
      skill_ids: string[];
    }>`
      SELECT p.display_name, p.current_role_id, p.desired_role_id, p.experience_level,
        ARRAY(SELECT category_id FROM profile_interest_categories WHERE user_id = p.user_id ORDER BY category_id) AS category_ids,
        ARRAY(SELECT skill_id FROM profile_interest_skills WHERE user_id = p.user_id ORDER BY skill_id) AS skill_ids
      FROM professional_profiles p
      WHERE p.user_id = ${userId}
    `.execute(this.db);
    const row = result.rows[0];
    return row
      ? {
          displayName: row.display_name,
          currentRoleId: row.current_role_id,
          desiredRoleId: row.desired_role_id,
          experienceLevel: row.experience_level,
          interestCategoryIds: row.category_ids,
          interestSkillIds: row.skill_ids,
        }
      : null;
  }

  async countActiveRoles(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await sql<{ count: string }>`
      SELECT count(*)::text AS count FROM professional_roles WHERE active AND id = ANY(${ids}::uuid[])
    `.execute(this.db);
    return Number(result.rows[0]?.count ?? 0);
  }

  async countCategories(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await sql<{ count: string }>`
      SELECT count(*)::text AS count FROM skill_categories WHERE id = ANY(${ids}::uuid[])
    `.execute(this.db);
    return Number(result.rows[0]?.count ?? 0);
  }

  async countSkills(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await sql<{ count: string }>`
      SELECT count(*)::text AS count FROM skills WHERE id = ANY(${ids}::uuid[])
    `.execute(this.db);
    return Number(result.rows[0]?.count ?? 0);
  }

  async save(userId: string, profile: ProfessionalProfile): Promise<void> {
    await this.db.transaction().execute(async (transaction) => {
      await sql`
        INSERT INTO professional_profiles (
          user_id, display_name, current_role_id, desired_role_id, experience_level
        ) VALUES (
          ${userId}, ${profile.displayName}, ${profile.currentRoleId}, ${profile.desiredRoleId},
          ${profile.experienceLevel}::experience_level
        )
        ON CONFLICT (user_id) DO UPDATE SET
          display_name = EXCLUDED.display_name,
          current_role_id = EXCLUDED.current_role_id,
          desired_role_id = EXCLUDED.desired_role_id,
          experience_level = EXCLUDED.experience_level,
          updated_at = now()
      `.execute(transaction);
      await sql`DELETE FROM profile_interest_categories WHERE user_id = ${userId}`.execute(
        transaction,
      );
      await sql`DELETE FROM profile_interest_skills WHERE user_id = ${userId}`.execute(transaction);
      if (profile.interestCategoryIds.length > 0) {
        await sql`
          INSERT INTO profile_interest_categories (user_id, category_id)
          SELECT ${userId}, unnest(${profile.interestCategoryIds}::uuid[])
        `.execute(transaction);
      }
      if (profile.interestSkillIds.length > 0) {
        await sql`
          INSERT INTO profile_interest_skills (user_id, skill_id)
          SELECT ${userId}, unnest(${profile.interestSkillIds}::uuid[])
        `.execute(transaction);
      }
    });
  }
}
