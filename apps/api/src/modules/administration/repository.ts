import { sql, type Kysely, type Transaction } from 'kysely';

import type { FoundationDatabase } from '../../plugins/database.js';
import type {
  AchievementInput,
  CatalogDraftInput,
  CategoryInput,
  CertificationInput,
  ResourceType,
  SkillInput,
  TrailDraftInput,
  TrailStepInput,
} from './schemas.js';

export type AdministrationDatabase = Kysely<FoundationDatabase> | Transaction<FoundationDatabase>;
export type CatalogStatus = 'draft' | 'published' | 'unpublished' | 'inactive';

export interface AdminResource {
  id: string;
  slug: string;
  status: CatalogStatus;
  updatedAt: string;
}

export interface StoredTrailDraft {
  id: string;
  slug: string;
  status: CatalogStatus;
  categoryId: string | null;
  title: string | null;
  description: string | null;
  targetRoleIds: string[];
  steps: TrailStepInput[];
}

export interface StoredCertificationDraft extends CertificationInput {
  id: string;
  status: CatalogStatus;
}

export interface StoredAchievementDraft extends AchievementInput {
  id: string;
  status: CatalogStatus;
}

export interface StoredCategoryDraft extends CategoryInput {
  id: string;
  status: CatalogStatus;
}

export interface StoredSkillDraft extends SkillInput {
  id: string;
  status: CatalogStatus;
}

interface RootRow {
  id: string;
  slug: string;
  status: CatalogStatus;
  updated_at: Date;
}

export interface PublicationRecord {
  resourceType: ResourceType;
  resourceId: string;
  revisionId: string;
  revisionNumber: number;
  publishedAt: Date;
}

const rootTables = {
  category: 'skill_categories',
  skill: 'skills',
  trail: 'learning_trails',
  certification: 'certifications',
  achievement: 'achievements',
} as const;

export class AdministrationRepository {
  constructor(
    readonly executor: AdministrationDatabase,
    private readonly transactional = false,
  ) {}

  transaction<T>(run: (repository: AdministrationRepository) => Promise<T>): Promise<T> {
    if (this.transactional) return run(this);
    return this.executor
      .transaction()
      .execute((transaction) => run(new AdministrationRepository(transaction, true)));
  }

  async createCategory(input: CategoryInput, actorId: string): Promise<AdminResource> {
    return this.transaction(async (repository) => {
      const root = await repository.insertRoot('category', input.slug);
      await sql`INSERT INTO category_drafts
        (category_id, name, description, edited_by_user_id)
        VALUES (${root.id}::uuid, ${input.name}, ${input.description}, ${actorId}::uuid)`.execute(
        repository.executor,
      );
      return mapRoot(root);
    });
  }

  async createSkill(input: SkillInput, actorId: string): Promise<AdminResource> {
    return this.transaction(async (repository) => {
      const root = await repository.insertRoot('skill', input.slug);
      await sql`INSERT INTO skill_drafts
        (skill_id, category_id, name, description, edited_by_user_id)
        VALUES (${root.id}::uuid, ${input.categoryId}::uuid, ${input.name}, ${input.description},
          ${actorId}::uuid)`.execute(repository.executor);
      return mapRoot(root);
    });
  }

  async createTrail(input: TrailDraftInput, actorId: string): Promise<AdminResource> {
    return this.transaction(async (repository) => {
      const root = await repository.insertRoot('trail', input.slug!);
      await sql`INSERT INTO trail_drafts
        (trail_id, category_id, title, description, edited_by_user_id)
        VALUES (${root.id}::uuid, ${input.categoryId ?? null}::uuid, ${input.title ?? null},
          ${input.description ?? null}, ${actorId}::uuid)`.execute(repository.executor);
      await repository.replaceTrailRoles(root.id, input.targetRoleIds ?? []);
      await repository.replaceTrailSteps(root.id, input.steps ?? []);
      return mapRoot(root);
    });
  }

  async createCertification(input: CertificationInput, actorId: string): Promise<AdminResource> {
    return this.transaction(async (repository) => {
      const root = await repository.insertRoot('certification', input.slug);
      await sql`INSERT INTO certification_drafts
        (certification_id, name, issuer, description, default_validity_months, edited_by_user_id)
        VALUES (${root.id}::uuid, ${input.name}, ${input.issuer}, ${input.description},
          ${input.defaultValidityMonths ?? null}, ${actorId}::uuid)`.execute(repository.executor);
      await repository.replaceCertificationRelations(root.id, input);
      return mapRoot(root);
    });
  }

  async createAchievement(input: AchievementInput, actorId: string): Promise<AdminResource> {
    return this.transaction(async (repository) => {
      const root = await repository.insertRoot('achievement', input.slug);
      await sql`INSERT INTO achievement_drafts
        (achievement_id, title, description, icon_label, criterion_type, criterion_parameters,
          edited_by_user_id)
        VALUES (${root.id}::uuid, ${input.title}, ${input.description}, ${input.iconLabel},
          ${input.criterionType}::achievement_criterion_type,
          ${JSON.stringify(input.criterionParameters)}::jsonb, ${actorId}::uuid)`.execute(
        repository.executor,
      );
      return mapRoot(root);
    });
  }

  async updateTrail(
    trailId: string,
    input: TrailDraftInput,
    actorId: string,
  ): Promise<AdminResource | null> {
    return this.transaction(async (repository) => {
      const root = await repository.getResource('trail', trailId, true);
      if (!root) return null;
      await repository.ensureTrailDraft(trailId, actorId);
      const existing = await repository.getTrailDraft(trailId, true);
      if (!existing) return null;
      await sql`UPDATE learning_trails SET slug = COALESCE(${input.slug ?? null}, slug),
          updated_at = now() WHERE id = ${trailId}::uuid`.execute(repository.executor);
      await sql`UPDATE trail_drafts SET
          category_id = COALESCE(${input.categoryId ?? null}::uuid, category_id),
          title = COALESCE(${input.title ?? null}, title),
          description = COALESCE(${input.description ?? null}, description),
          edited_by_user_id = ${actorId}::uuid, updated_at = now()
        WHERE trail_id = ${trailId}::uuid`.execute(repository.executor);
      if (input.targetRoleIds) await repository.replaceTrailRoles(trailId, input.targetRoleIds);
      if (input.steps) await repository.replaceTrailSteps(trailId, input.steps);
      return repository.getResource('trail', trailId);
    });
  }

  async updateCatalogDraft(
    type: Exclude<ResourceType, 'trail'>,
    id: string,
    input: CatalogDraftInput,
    actorId: string,
  ): Promise<AdminResource | null> {
    return this.transaction(async (repository) => {
      const root = await repository.getResource(type, id, true);
      if (!root) return null;
      await repository.ensureCatalogDraft(type, id, actorId);
      if (input.slug) {
        const table = sql.table(rootTables[type]);
        await sql`UPDATE ${table} SET slug = ${input.slug}, updated_at = now()
          WHERE id = ${id}::uuid`.execute(repository.executor);
      }
      if (type === 'category') {
        await sql`UPDATE category_drafts SET name = COALESCE(${input.name ?? null}, name),
          description = COALESCE(${input.description ?? null}, description),
          edited_by_user_id = ${actorId}::uuid, updated_at = now()
          WHERE category_id = ${id}::uuid`.execute(repository.executor);
      } else if (type === 'skill') {
        await sql`UPDATE skill_drafts SET category_id = COALESCE(${input.categoryId ?? null}::uuid, category_id),
          name = COALESCE(${input.name ?? null}, name),
          description = COALESCE(${input.description ?? null}, description),
          edited_by_user_id = ${actorId}::uuid, updated_at = now()
          WHERE skill_id = ${id}::uuid`.execute(repository.executor);
      } else if (type === 'certification') {
        await sql`UPDATE certification_drafts SET name = COALESCE(${input.name ?? null}, name),
          issuer = COALESCE(${input.issuer ?? null}, issuer),
          description = COALESCE(${input.description ?? null}, description),
          default_validity_months = COALESCE(${input.defaultValidityMonths ?? null}, default_validity_months),
          edited_by_user_id = ${actorId}::uuid, updated_at = now()
          WHERE certification_id = ${id}::uuid`.execute(repository.executor);
        await repository.replaceCertificationRelations(id, input, true);
      } else {
        await sql`UPDATE achievement_drafts SET title = COALESCE(${input.title ?? null}, title),
          description = COALESCE(${input.description ?? null}, description),
          icon_label = COALESCE(${input.iconLabel ?? null}, icon_label),
          criterion_type = COALESCE(${input.criterionType ?? null}::achievement_criterion_type, criterion_type),
          criterion_parameters = COALESCE(${input.criterionParameters ? JSON.stringify(input.criterionParameters) : null}::jsonb, criterion_parameters),
          edited_by_user_id = ${actorId}::uuid, updated_at = now()
          WHERE achievement_id = ${id}::uuid`.execute(repository.executor);
      }
      return repository.getResource(type, id);
    });
  }

  async getResource(type: ResourceType, id: string, lock = false): Promise<AdminResource | null> {
    const table = sql.table(rootTables[type]);
    const result = await sql<RootRow>`SELECT id, slug, status, updated_at FROM ${table}
      WHERE id = ${id}::uuid ${lock ? sql`FOR UPDATE` : sql``}`.execute(this.executor);
    return result.rows[0] ? mapRoot(result.rows[0]) : null;
  }

  async getCategoryDraft(id: string): Promise<StoredCategoryDraft | null> {
    const result = await sql<RootRow & { name: string; description: string }>`
      SELECT root.id, root.slug, root.status, root.updated_at, draft.name, draft.description
      FROM skill_categories root JOIN category_drafts draft ON draft.category_id = root.id
      WHERE root.id = ${id}::uuid`.execute(this.executor);
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          slug: row.slug,
          status: row.status,
          name: row.name,
          description: row.description,
        }
      : null;
  }

  async getSkillDraft(id: string): Promise<StoredSkillDraft | null> {
    const result = await sql<RootRow & { category_id: string; name: string; description: string }>`
      SELECT root.id, root.slug, root.status, root.updated_at, draft.category_id, draft.name, draft.description
      FROM skills root JOIN skill_drafts draft ON draft.skill_id = root.id
      WHERE root.id = ${id}::uuid`.execute(this.executor);
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          slug: row.slug,
          status: row.status,
          categoryId: row.category_id,
          name: row.name,
          description: row.description,
        }
      : null;
  }

  async getTrailDraft(id: string, lock = false): Promise<StoredTrailDraft | null> {
    const result = await sql<
      RootRow & { category_id: string | null; title: string | null; description: string | null }
    >`
      SELECT root.id, root.slug, root.status, root.updated_at, draft.category_id, draft.title, draft.description
      FROM learning_trails root JOIN trail_drafts draft ON draft.trail_id = root.id
      WHERE root.id = ${id}::uuid ${lock ? sql`FOR UPDATE OF root` : sql``}`.execute(this.executor);
    const row = result.rows[0];
    if (!row) return null;
    const roleRows = await sql<{ professional_role_id: string }>`SELECT professional_role_id
      FROM trail_draft_target_roles WHERE trail_id = ${id}::uuid ORDER BY professional_role_id`.execute(
      this.executor,
    );
    const stepRows = await sql<{
      step_id: string;
      position: number;
      title: string;
      description: string;
      required: boolean;
      skill_ids: string[];
      prerequisite_step_ids: string[];
    }>`SELECT step.step_id, step.position, step.title, step.description, step.required,
        COALESCE((SELECT array_agg(link.skill_id ORDER BY link.skill_id)
          FROM trail_draft_step_skills link WHERE link.trail_id = step.trail_id
            AND link.step_id = step.step_id), ARRAY[]::uuid[]) AS skill_ids,
        COALESCE((SELECT array_agg(link.prerequisite_step_id ORDER BY link.prerequisite_step_id)
          FROM trail_draft_step_prerequisites link WHERE link.trail_id = step.trail_id
            AND link.step_id = step.step_id), ARRAY[]::uuid[]) AS prerequisite_step_ids
      FROM trail_draft_steps step WHERE step.trail_id = ${id}::uuid ORDER BY step.position`.execute(
      this.executor,
    );
    return {
      id: row.id,
      slug: row.slug,
      status: row.status,
      categoryId: row.category_id,
      title: row.title,
      description: row.description,
      targetRoleIds: roleRows.rows.map((role) => role.professional_role_id),
      steps: stepRows.rows.map((step) => ({
        stepId: step.step_id,
        position: step.position,
        title: step.title,
        description: step.description,
        required: step.required,
        skillIds: step.skill_ids,
        prerequisiteStepIds: step.prerequisite_step_ids,
      })),
    };
  }

  async getCertificationDraft(id: string): Promise<StoredCertificationDraft | null> {
    const result = await sql<
      RootRow & {
        name: string;
        issuer: string;
        description: string;
        default_validity_months: number | null;
      }
    >`SELECT root.id, root.slug, root.status, root.updated_at, draft.name, draft.issuer,
        draft.description, draft.default_validity_months
      FROM certifications root JOIN certification_drafts draft ON draft.certification_id = root.id
      WHERE root.id = ${id}::uuid`.execute(this.executor);
    const row = result.rows[0];
    if (!row) return null;
    const skills = await sql<{ skill_id: string }>`SELECT skill_id FROM certification_draft_skills
      WHERE certification_id = ${id}::uuid ORDER BY skill_id`.execute(this.executor);
    const trails = await sql<{ trail_id: string }>`SELECT trail_id FROM certification_draft_trails
      WHERE certification_id = ${id}::uuid ORDER BY trail_id`.execute(this.executor);
    const requirements = await sql<{
      title: string;
      requirement_type: 'skill' | 'trail';
      target_id: string;
      required: boolean;
      position: number;
    }>`SELECT title, requirement_type, COALESCE(skill_id, trail_id) AS target_id, required, position
      FROM certification_draft_requirements WHERE certification_id = ${id}::uuid ORDER BY position`.execute(
      this.executor,
    );
    return {
      id: row.id,
      slug: row.slug,
      status: row.status,
      name: row.name,
      issuer: row.issuer,
      description: row.description,
      ...(row.default_validity_months === null
        ? {}
        : { defaultValidityMonths: row.default_validity_months }),
      skillIds: skills.rows.map((item) => item.skill_id),
      trailIds: trails.rows.map((item) => item.trail_id),
      requirements: requirements.rows.map((item) => ({
        title: item.title,
        type: item.requirement_type,
        targetId: item.target_id,
        required: item.required,
        position: item.position,
      })),
    };
  }

  async getAchievementDraft(id: string): Promise<StoredAchievementDraft | null> {
    const result = await sql<
      RootRow & {
        title: string;
        description: string;
        icon_label: string;
        criterion_type: AchievementInput['criterionType'];
        criterion_parameters: { minimum: number };
      }
    >`SELECT root.id, root.slug, root.status, root.updated_at, draft.title, draft.description,
        draft.icon_label, draft.criterion_type, draft.criterion_parameters
      FROM achievements root JOIN achievement_drafts draft ON draft.achievement_id = root.id
      WHERE root.id = ${id}::uuid`.execute(this.executor);
    const row = result.rows[0];
    return row
      ? {
          id: row.id,
          slug: row.slug,
          status: row.status,
          title: row.title,
          description: row.description,
          iconLabel: row.icon_label,
          criterionType: row.criterion_type,
          criterionParameters: row.criterion_parameters,
        }
      : null;
  }

  async nextRevisionNumber(type: ResourceType, resourceId: string): Promise<number> {
    const revisionTable = sql.table(
      {
        category: 'category_revisions',
        skill: 'skill_revisions',
        trail: 'trail_revisions',
        certification: 'certification_revisions',
        achievement: 'achievement_revisions',
      }[type],
    );
    const rootColumn = sql.ref(
      {
        category: 'category_id',
        skill: 'skill_id',
        trail: 'trail_id',
        certification: 'certification_id',
        achievement: 'achievement_id',
      }[type],
    );
    const result = await sql<{ next: number }>`SELECT COALESCE(max(revision_number), 0) + 1 AS next
      FROM ${revisionTable} WHERE ${rootColumn} = ${resourceId}::uuid`.execute(this.executor);
    return Number(result.rows[0]!.next);
  }

  async findPublication(idempotencyKey: string): Promise<PublicationRecord | null> {
    const result = await sql<{
      resource_type: ResourceType;
      resource_id: string;
      revision_id: string;
      revision_number: number;
      published_at: Date;
    }>`SELECT resource_type, resource_id, revision_id, revision_number, published_at
      FROM catalog_publications WHERE idempotency_key = ${idempotencyKey}::uuid`.execute(
      this.executor,
    );
    const row = result.rows[0];
    return row
      ? {
          resourceType: row.resource_type,
          resourceId: row.resource_id,
          revisionId: row.revision_id,
          revisionNumber: row.revision_number,
          publishedAt: row.published_at,
        }
      : null;
  }

  async recordPublication(
    input: Omit<PublicationRecord, 'publishedAt'> & {
      idempotencyKey: string;
      actorId: string;
    },
  ): Promise<PublicationRecord> {
    const result = await sql<{ published_at: Date }>`INSERT INTO catalog_publications
      (resource_type, resource_id, revision_id, revision_number, idempotency_key, published_by_user_id)
      VALUES (${input.resourceType}::catalog_publication_resource_type, ${input.resourceId}::uuid,
        ${input.revisionId}::uuid, ${input.revisionNumber}, ${input.idempotencyKey}::uuid,
        ${input.actorId}::uuid) RETURNING published_at`.execute(this.executor);
    return { ...input, publishedAt: result.rows[0]!.published_at };
  }

  async setPublished(type: ResourceType, id: string, revisionId: string): Promise<void> {
    const table = sql.table(rootTables[type]);
    await sql`UPDATE ${table} SET status = 'published', published_revision_id = ${revisionId}::uuid,
      updated_at = now() WHERE id = ${id}::uuid`.execute(this.executor);
  }

  async setLifecycle(
    type: ResourceType,
    id: string,
    status: 'unpublished' | 'inactive',
  ): Promise<AdminResource> {
    const table = sql.table(rootTables[type]);
    const result = await sql<RootRow>`UPDATE ${table} SET status = ${status}::catalog_root_status,
      published_revision_id = CASE WHEN ${status} = 'unpublished' THEN NULL ELSE published_revision_id END,
      updated_at = now() WHERE id = ${id}::uuid RETURNING id, slug, status, updated_at`.execute(
      this.executor,
    );
    return mapRoot(result.rows[0]!);
  }

  async markTrailUsersChanged(trailId: string): Promise<void> {
    await sql`UPDATE user_trail_states SET catalog_change_pending = true
      WHERE trail_id = ${trailId}::uuid`.execute(this.executor);
  }

  async markUsersAffectedBy(type: ResourceType, id: string): Promise<void> {
    if (type === 'trail') return this.markTrailUsersChanged(id);
    if (type === 'skill') {
      await sql`UPDATE user_trail_states state SET catalog_change_pending = true
        WHERE EXISTS (SELECT 1 FROM learning_trails trail
          JOIN trail_step_skills relation ON relation.trail_revision_id = trail.published_revision_id
          WHERE trail.id = state.trail_id AND relation.skill_id = ${id}::uuid)`.execute(
        this.executor,
      );
    } else if (type === 'category') {
      await sql`UPDATE user_trail_states state SET catalog_change_pending = true
        WHERE EXISTS (SELECT 1 FROM learning_trails trail
          JOIN trail_revisions revision ON revision.id = trail.published_revision_id
          WHERE trail.id = state.trail_id AND revision.category_id = ${id}::uuid)`.execute(
        this.executor,
      );
    }
  }

  async isReferenced(type: ResourceType, id: string): Promise<boolean> {
    const queries: Record<ResourceType, ReturnType<typeof sql<{ found: boolean }>>> = {
      category: sql`SELECT EXISTS (
        SELECT 1 FROM skill_revisions WHERE category_id = ${id}::uuid UNION ALL
        SELECT 1 FROM trail_revisions WHERE category_id = ${id}::uuid UNION ALL
        SELECT 1 FROM profile_interest_categories WHERE category_id = ${id}::uuid
      ) AS found`,
      skill: sql`SELECT EXISTS (
        SELECT 1 FROM trail_step_skills WHERE skill_id = ${id}::uuid UNION ALL
        SELECT 1 FROM certification_revision_skills WHERE skill_id = ${id}::uuid UNION ALL
        SELECT 1 FROM certification_requirements WHERE skill_id = ${id}::uuid UNION ALL
        SELECT 1 FROM profile_interest_skills WHERE skill_id = ${id}::uuid
      ) AS found`,
      trail: sql`SELECT EXISTS (
        SELECT 1 FROM user_trail_states WHERE trail_id = ${id}::uuid UNION ALL
        SELECT 1 FROM certification_revision_trails WHERE trail_id = ${id}::uuid UNION ALL
        SELECT 1 FROM certification_requirements WHERE trail_id = ${id}::uuid
      ) AS found`,
      certification: sql`SELECT EXISTS (
        SELECT 1 FROM user_certification_records WHERE certification_id = ${id}::uuid
      ) AS found`,
      achievement: sql`SELECT EXISTS (
        SELECT 1 FROM user_achievement_awards WHERE achievement_id = ${id}::uuid
      ) AS found`,
    };
    const result = await queries[type].execute(this.executor);
    return result.rows[0]?.found ?? false;
  }

  private async insertRoot(type: ResourceType, slug: string): Promise<RootRow> {
    const table = sql.table(rootTables[type]);
    const result = await sql<RootRow>`INSERT INTO ${table} (slug) VALUES (${slug})
      RETURNING id, slug, status, updated_at`.execute(this.executor);
    return result.rows[0]!;
  }

  private async ensureCatalogDraft(
    type: Exclude<ResourceType, 'trail'>,
    id: string,
    actorId: string,
  ): Promise<void> {
    const existing =
      type === 'category'
        ? await this.getCategoryDraft(id)
        : type === 'skill'
          ? await this.getSkillDraft(id)
          : type === 'certification'
            ? await this.getCertificationDraft(id)
            : await this.getAchievementDraft(id);
    if (existing) return;

    if (type === 'category') {
      await sql`INSERT INTO category_drafts (category_id, name, description, edited_by_user_id)
        SELECT root.id, revision.name, revision.description, ${actorId}::uuid
        FROM skill_categories root JOIN category_revisions revision
          ON revision.id = root.published_revision_id
        WHERE root.id = ${id}::uuid`.execute(this.executor);
    } else if (type === 'skill') {
      await sql`INSERT INTO skill_drafts
          (skill_id, category_id, name, description, edited_by_user_id)
        SELECT root.id, revision.category_id, revision.name, revision.description, ${actorId}::uuid
        FROM skills root JOIN skill_revisions revision ON revision.id = root.published_revision_id
        WHERE root.id = ${id}::uuid`.execute(this.executor);
    } else if (type === 'certification') {
      await sql`INSERT INTO certification_drafts
          (certification_id, name, issuer, description, default_validity_months, edited_by_user_id)
        SELECT root.id, revision.name, revision.issuer, revision.description,
          revision.default_validity_months, ${actorId}::uuid
        FROM certifications root JOIN certification_revisions revision
          ON revision.id = root.published_revision_id
        WHERE root.id = ${id}::uuid`.execute(this.executor);
      await sql`INSERT INTO certification_draft_skills (certification_id, skill_id)
        SELECT ${id}::uuid, relation.skill_id FROM certifications root
        JOIN certification_revision_skills relation
          ON relation.certification_revision_id = root.published_revision_id
        WHERE root.id = ${id}::uuid`.execute(this.executor);
      await sql`INSERT INTO certification_draft_trails (certification_id, trail_id)
        SELECT ${id}::uuid, relation.trail_id FROM certifications root
        JOIN certification_revision_trails relation
          ON relation.certification_revision_id = root.published_revision_id
        WHERE root.id = ${id}::uuid`.execute(this.executor);
      await sql`INSERT INTO certification_draft_requirements
          (certification_id, position, title, requirement_type, skill_id, trail_id, required)
        SELECT ${id}::uuid, requirement.position, requirement.title, requirement.requirement_type,
          requirement.skill_id, requirement.trail_id, requirement.required
        FROM certifications root JOIN certification_requirements requirement
          ON requirement.certification_revision_id = root.published_revision_id
        WHERE root.id = ${id}::uuid`.execute(this.executor);
    } else {
      await sql`INSERT INTO achievement_drafts
          (achievement_id, title, description, icon_label, criterion_type, criterion_parameters,
           edited_by_user_id)
        SELECT root.id, revision.title, revision.description, revision.icon_label,
          revision.criterion_type, revision.criterion_parameters, ${actorId}::uuid
        FROM achievements root JOIN achievement_revisions revision
          ON revision.id = root.published_revision_id
        WHERE root.id = ${id}::uuid`.execute(this.executor);
    }
  }

  private async ensureTrailDraft(id: string, actorId: string): Promise<void> {
    if (await this.getTrailDraft(id)) return;
    await sql`INSERT INTO trail_drafts
        (trail_id, category_id, title, description, edited_by_user_id)
      SELECT root.id, revision.category_id, revision.title, revision.description, ${actorId}::uuid
      FROM learning_trails root JOIN trail_revisions revision ON revision.id = root.published_revision_id
      WHERE root.id = ${id}::uuid`.execute(this.executor);
    await sql`INSERT INTO trail_draft_steps
        (trail_id, step_id, position, title, description, required)
      SELECT ${id}::uuid, step.step_id, step.position, step.title, step.description, step.required
      FROM learning_trails root JOIN trail_revision_steps step
        ON step.trail_revision_id = root.published_revision_id
      WHERE root.id = ${id}::uuid`.execute(this.executor);
    await sql`INSERT INTO trail_draft_step_skills (trail_id, step_id, skill_id)
      SELECT ${id}::uuid, relation.step_id, relation.skill_id
      FROM learning_trails root JOIN trail_step_skills relation
        ON relation.trail_revision_id = root.published_revision_id
      WHERE root.id = ${id}::uuid`.execute(this.executor);
    await sql`INSERT INTO trail_draft_step_prerequisites
        (trail_id, step_id, prerequisite_step_id)
      SELECT ${id}::uuid, relation.step_id, relation.prerequisite_step_id
      FROM learning_trails root JOIN trail_step_prerequisites relation
        ON relation.trail_revision_id = root.published_revision_id
      WHERE root.id = ${id}::uuid`.execute(this.executor);
    await sql`INSERT INTO trail_draft_target_roles (trail_id, professional_role_id)
      SELECT ${id}::uuid, relation.professional_role_id
      FROM learning_trails root JOIN trail_target_roles relation
        ON relation.trail_revision_id = root.published_revision_id
      WHERE root.id = ${id}::uuid`.execute(this.executor);
  }

  private async replaceTrailRoles(trailId: string, roleIds: readonly string[]): Promise<void> {
    await sql`DELETE FROM trail_draft_target_roles WHERE trail_id = ${trailId}::uuid`.execute(
      this.executor,
    );
    for (const roleId of roleIds) {
      await sql`INSERT INTO trail_draft_target_roles (trail_id, professional_role_id)
        VALUES (${trailId}::uuid, ${roleId}::uuid)`.execute(this.executor);
    }
  }

  private async replaceTrailSteps(
    trailId: string,
    steps: readonly TrailStepInput[],
  ): Promise<void> {
    await sql`DELETE FROM trail_draft_steps WHERE trail_id = ${trailId}::uuid`.execute(
      this.executor,
    );
    for (const step of steps) {
      await sql`INSERT INTO trail_steps (id, trail_id) VALUES (${step.stepId}::uuid, ${trailId}::uuid)
        ON CONFLICT (id) DO NOTHING`.execute(this.executor);
      await sql`INSERT INTO trail_draft_steps
        (trail_id, step_id, position, title, description, required)
        VALUES (${trailId}::uuid, ${step.stepId}::uuid, ${step.position}, ${step.title},
          ${step.description ?? ''}, ${step.required})`.execute(this.executor);
    }
    for (const step of steps) {
      for (const skillId of step.skillIds) {
        await sql`INSERT INTO trail_draft_step_skills (trail_id, step_id, skill_id)
          VALUES (${trailId}::uuid, ${step.stepId}::uuid, ${skillId}::uuid)`.execute(this.executor);
      }
      for (const prerequisiteId of step.prerequisiteStepIds) {
        await sql`INSERT INTO trail_draft_step_prerequisites
          (trail_id, step_id, prerequisite_step_id)
          VALUES (${trailId}::uuid, ${step.stepId}::uuid, ${prerequisiteId}::uuid)`.execute(
          this.executor,
        );
      }
    }
  }

  private async replaceCertificationRelations(
    id: string,
    input: Partial<CertificationInput>,
    patch = false,
  ): Promise<void> {
    if (!patch || input.skillIds) {
      await sql`DELETE FROM certification_draft_skills WHERE certification_id = ${id}::uuid`.execute(
        this.executor,
      );
      for (const skillId of input.skillIds ?? []) {
        await sql`INSERT INTO certification_draft_skills VALUES (${id}::uuid, ${skillId}::uuid)`.execute(
          this.executor,
        );
      }
    }
    if (!patch || input.trailIds) {
      await sql`DELETE FROM certification_draft_trails WHERE certification_id = ${id}::uuid`.execute(
        this.executor,
      );
      for (const trailId of input.trailIds ?? []) {
        await sql`INSERT INTO certification_draft_trails VALUES (${id}::uuid, ${trailId}::uuid)`.execute(
          this.executor,
        );
      }
    }
    if (!patch || input.requirements) {
      await sql`DELETE FROM certification_draft_requirements WHERE certification_id = ${id}::uuid`.execute(
        this.executor,
      );
      for (const requirement of input.requirements ?? []) {
        await sql`INSERT INTO certification_draft_requirements
          (certification_id, position, title, requirement_type, skill_id, trail_id, required)
          VALUES (${id}::uuid, ${requirement.position}, ${requirement.title},
            ${requirement.type}::certification_requirement_type,
            ${requirement.type === 'skill' ? requirement.targetId : null}::uuid,
            ${requirement.type === 'trail' ? requirement.targetId : null}::uuid,
            ${requirement.required})`.execute(this.executor);
      }
    }
  }
}

function mapRoot(row: RootRow): AdminResource {
  return {
    id: row.id,
    slug: row.slug,
    status: row.status,
    updatedAt: row.updated_at.toISOString(),
  };
}
