import { sql } from 'kysely';

import { HttpProblem } from '../../plugins/problem-details.js';
import {
  AdministrationRepository,
  type PublicationRecord,
  type StoredTrailDraft,
} from './repository.js';
import type { ResourceType, TrailStepInput } from './schemas.js';

export interface Publication {
  resourceId: string;
  revisionId: string;
  revisionNumber: number;
  publishedAt: string;
}

export class PublicationService {
  constructor(private readonly repository: AdministrationRepository) {}

  publishTrail(trailId: string, actorId: string, idempotencyKey: string): Promise<Publication> {
    return this.repository.transaction(async (repository) => {
      const prior = await repository.findPublication(idempotencyKey);
      if (prior) return this.replay(prior, 'trail', trailId);
      const root = await repository.getResource('trail', trailId, true);
      const draft = await repository.getTrailDraft(trailId);
      if (!root || !draft) throw notFound('TRAIL_DRAFT_NOT_FOUND');
      validateCompleteTrail(draft);
      await validateTrailReferences(repository, draft);

      const revisionNumber = await repository.nextRevisionNumber('trail', trailId);
      const revision = await sql<{ id: string }>`INSERT INTO trail_revisions
        (trail_id, revision_number, category_id, title, description, created_by_user_id)
        VALUES (${trailId}::uuid, ${revisionNumber}, ${draft.categoryId}::uuid, ${draft.title},
          ${draft.description}, ${actorId}::uuid) RETURNING id`.execute(repository.executor);
      const revisionId = revision.rows[0]!.id;
      for (const step of draft.steps) {
        await sql`INSERT INTO trail_revision_steps
          (trail_revision_id, step_id, trail_id, position, title, description, required)
          VALUES (${revisionId}::uuid, ${step.stepId}::uuid, ${trailId}::uuid, ${step.position},
            ${step.title}, ${step.description ?? ''}, ${step.required})`.execute(
          repository.executor,
        );
        for (const skillId of step.skillIds) {
          await sql`INSERT INTO trail_step_skills (trail_revision_id, step_id, skill_id)
            VALUES (${revisionId}::uuid, ${step.stepId}::uuid, ${skillId}::uuid)`.execute(
            repository.executor,
          );
        }
      }
      for (const step of draft.steps) {
        for (const prerequisiteId of step.prerequisiteStepIds) {
          await sql`INSERT INTO trail_step_prerequisites
            (trail_revision_id, step_id, prerequisite_step_id)
            VALUES (${revisionId}::uuid, ${step.stepId}::uuid, ${prerequisiteId}::uuid)`.execute(
            repository.executor,
          );
        }
      }
      for (const roleId of draft.targetRoleIds) {
        await sql`INSERT INTO trail_target_roles (trail_revision_id, professional_role_id)
          VALUES (${revisionId}::uuid, ${roleId}::uuid)`.execute(repository.executor);
      }
      const publication = await repository.recordPublication({
        resourceType: 'trail',
        resourceId: trailId,
        revisionId,
        revisionNumber,
        idempotencyKey,
        actorId,
      });
      await repository.setPublished('trail', trailId, revisionId);
      await repository.markTrailUsersChanged(trailId);
      return mapPublication(publication);
    });
  }

  publishCatalogResource(
    type: Exclude<ResourceType, 'trail'>,
    resourceId: string,
    actorId: string,
    idempotencyKey: string,
  ): Promise<Publication> {
    return this.repository.transaction(async (repository) => {
      const prior = await repository.findPublication(idempotencyKey);
      if (prior) return this.replay(prior, type, resourceId);
      const root = await repository.getResource(type, resourceId, true);
      if (!root) throw notFound('CATALOG_DRAFT_NOT_FOUND');
      const revisionNumber = await repository.nextRevisionNumber(type, resourceId);
      let revisionId: string;

      if (type === 'category') {
        const draft = await repository.getCategoryDraft(resourceId);
        if (!draft) throw notFound('CATEGORY_DRAFT_NOT_FOUND');
        const revision = await sql<{ id: string }>`INSERT INTO category_revisions
          (category_id, revision_number, name, description, created_by_user_id)
          VALUES (${resourceId}::uuid, ${revisionNumber}, ${draft.name}, ${draft.description},
            ${actorId}::uuid) RETURNING id`.execute(repository.executor);
        revisionId = revision.rows[0]!.id;
      } else if (type === 'skill') {
        const draft = await repository.getSkillDraft(resourceId);
        if (!draft) throw notFound('SKILL_DRAFT_NOT_FOUND');
        await requirePublishedIds(
          repository,
          'skill_categories',
          [draft.categoryId],
          '/categoryId',
        );
        const revision = await sql<{ id: string }>`INSERT INTO skill_revisions
          (skill_id, revision_number, category_id, name, description, created_by_user_id)
          VALUES (${resourceId}::uuid, ${revisionNumber}, ${draft.categoryId}::uuid,
            ${draft.name}, ${draft.description}, ${actorId}::uuid) RETURNING id`.execute(
          repository.executor,
        );
        revisionId = revision.rows[0]!.id;
      } else if (type === 'certification') {
        const draft = await repository.getCertificationDraft(resourceId);
        if (!draft) throw notFound('CERTIFICATION_DRAFT_NOT_FOUND');
        await requirePublishedIds(repository, 'skills', draft.skillIds ?? [], '/skillIds');
        await requirePublishedIds(repository, 'learning_trails', draft.trailIds ?? [], '/trailIds');
        validatePositions(draft.requirements ?? [], '/requirements');
        for (const requirement of draft.requirements ?? []) {
          await requirePublishedIds(
            repository,
            requirement.type === 'skill' ? 'skills' : 'learning_trails',
            [requirement.targetId],
            `/requirements/${requirement.position - 1}/targetId`,
          );
        }
        const revision = await sql<{ id: string }>`INSERT INTO certification_revisions
          (certification_id, revision_number, name, issuer, description, default_validity_months,
            created_by_user_id)
          VALUES (${resourceId}::uuid, ${revisionNumber}, ${draft.name}, ${draft.issuer},
            ${draft.description}, ${draft.defaultValidityMonths ?? null}, ${actorId}::uuid)
          RETURNING id`.execute(repository.executor);
        revisionId = revision.rows[0]!.id;
        for (const skillId of draft.skillIds ?? []) {
          await sql`INSERT INTO certification_revision_skills VALUES
            (${revisionId}::uuid, ${skillId}::uuid)`.execute(repository.executor);
        }
        for (const trailId of draft.trailIds ?? []) {
          await sql`INSERT INTO certification_revision_trails VALUES
            (${revisionId}::uuid, ${trailId}::uuid)`.execute(repository.executor);
        }
        for (const requirement of draft.requirements ?? []) {
          await sql`INSERT INTO certification_requirements
            (certification_revision_id, title, requirement_type, skill_id, trail_id, required, position)
            VALUES (${revisionId}::uuid, ${requirement.title},
              ${requirement.type}::certification_requirement_type,
              ${requirement.type === 'skill' ? requirement.targetId : null}::uuid,
              ${requirement.type === 'trail' ? requirement.targetId : null}::uuid,
              ${requirement.required}, ${requirement.position})`.execute(repository.executor);
        }
      } else {
        const draft = await repository.getAchievementDraft(resourceId);
        if (!draft) throw notFound('ACHIEVEMENT_DRAFT_NOT_FOUND');
        const revision = await sql<{ id: string }>`INSERT INTO achievement_revisions
          (achievement_id, revision_number, title, description, icon_label, criterion_type,
            criterion_parameters, created_by_user_id)
          VALUES (${resourceId}::uuid, ${revisionNumber}, ${draft.title}, ${draft.description},
            ${draft.iconLabel}, ${draft.criterionType}::achievement_criterion_type,
            ${JSON.stringify(draft.criterionParameters)}::jsonb, ${actorId}::uuid) RETURNING id`.execute(
          repository.executor,
        );
        revisionId = revision.rows[0]!.id;
      }

      const publication = await repository.recordPublication({
        resourceType: type,
        resourceId,
        revisionId,
        revisionNumber,
        idempotencyKey,
        actorId,
      });
      await repository.setPublished(type, resourceId, revisionId);
      await repository.markUsersAffectedBy(type, resourceId);
      return mapPublication(publication);
    });
  }

  private replay(prior: PublicationRecord, type: ResourceType, resourceId: string): Publication {
    if (prior.resourceType !== type || prior.resourceId !== resourceId) {
      throw conflict('IDEMPOTENCY_KEY_REUSED');
    }
    return mapPublication(prior);
  }
}

export function validateTrailGraph(steps: readonly TrailStepInput[]): void {
  validatePositions(steps, '/steps');
  const ids = new Set<string>();
  for (const [index, step] of steps.entries()) {
    if (ids.has(step.stepId)) validation(`/steps/${index}/stepId`, 'duplicate_step');
    ids.add(step.stepId);
  }
  const dependencies = new Map<string, readonly string[]>();
  for (const [index, step] of steps.entries()) {
    for (const prerequisite of step.prerequisiteStepIds) {
      if (!ids.has(prerequisite))
        validation(`/steps/${index}/prerequisiteStepIds`, 'dangling_prerequisite');
      if (prerequisite === step.stepId)
        validation(`/steps/${index}/prerequisiteStepIds`, 'self_prerequisite');
    }
    dependencies.set(step.stepId, step.prerequisiteStepIds);
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  function visit(id: string): void {
    if (visiting.has(id)) validation('/steps', 'cyclic_prerequisites');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisite of dependencies.get(id) ?? []) visit(prerequisite);
    visiting.delete(id);
    visited.add(id);
  }
  for (const id of ids) visit(id);
}

function validateCompleteTrail(draft: StoredTrailDraft): void {
  if (!draft.categoryId) validation('/categoryId', 'required');
  if (!draft.title?.trim()) validation('/title', 'required');
  if (!draft.description?.trim()) validation('/description', 'required');
  if (draft.steps.length === 0) validation('/steps', 'minimum_one_step');
  validateTrailGraph(draft.steps);
}

function validatePositions(items: readonly { position: number }[], path: string): void {
  const positions = [...items].map(({ position }) => position).sort((a, b) => a - b);
  if (positions.some((position, index) => position !== index + 1)) {
    validation(path, 'positions_must_be_contiguous');
  }
}

async function validateTrailReferences(
  repository: AdministrationRepository,
  draft: StoredTrailDraft,
): Promise<void> {
  await requirePublishedIds(repository, 'skill_categories', [draft.categoryId!], '/categoryId');
  await requirePublishedIds(
    repository,
    'professional_roles',
    draft.targetRoleIds,
    '/targetRoleIds',
    'active',
  );
  const skillIds = [...new Set(draft.steps.flatMap((step) => step.skillIds))];
  await requirePublishedIds(repository, 'skills', skillIds, '/steps/skillIds');
}

async function requirePublishedIds(
  repository: AdministrationRepository,
  tableName: 'skill_categories' | 'skills' | 'learning_trails' | 'professional_roles',
  ids: readonly string[],
  path: string,
  statusColumn: 'status' | 'active' = 'status',
): Promise<void> {
  if (ids.length === 0) return;
  const table = sql.table(tableName);
  const activeCondition =
    statusColumn === 'active' ? sql`active = true` : sql`status = 'published'`;
  const result = await sql<{ count: string }>`SELECT count(*)::text AS count FROM ${table}
    WHERE id = ANY(${ids}::uuid[]) AND ${activeCondition}`.execute(repository.executor);
  if (Number(result.rows[0]?.count) !== ids.length)
    validation(path, 'unknown_or_inactive_reference');
}

function mapPublication(publication: PublicationRecord): Publication {
  return {
    resourceId: publication.resourceId,
    revisionId: publication.revisionId,
    revisionNumber: publication.revisionNumber,
    publishedAt: publication.publishedAt.toISOString(),
  };
}

function validation(path: string, code: string): never {
  throw new HttpProblem({
    status: 422,
    title: 'Validation failed',
    code: 'CATALOG_VALIDATION_FAILED',
    extensions: { errors: [{ path, code }] },
  });
}

function notFound(code: string): HttpProblem {
  return new HttpProblem({ status: 404, title: 'Not Found', code });
}

function conflict(code: string): HttpProblem {
  return new HttpProblem({ status: 409, title: 'Conflict', code });
}
