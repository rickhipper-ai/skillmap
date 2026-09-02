import { sql, type Kysely } from 'kysely';

import type { FoundationDatabase } from '../../plugins/database.js';
import type {
  CatalogItem,
  CatalogSearchCriteria,
  Category,
  CertificationRequirement,
} from './types.js';

interface CatalogRow {
  id: string;
  type: CatalogItem['type'];
  slug: string;
  title: string;
  summary: string;
  category_id: string | null;
  category_slug: string | null;
  category_name: string | null;
  category_description: string | null;
}

interface DetailRow extends CatalogRow {
  revision_id: string;
}

export interface TrailStepRow {
  id: string;
  position: number;
  title: string;
  description: string;
  required: boolean;
}

export class CatalogRepository {
  constructor(private readonly db: Kysely<FoundationDatabase>) {}

  async listCategories(): Promise<Category[]> {
    const result = await sql<{
      id: string;
      slug: string;
      name: string;
      description: string;
    }>`
      SELECT category.id, category.slug, revision.name, revision.description
      FROM skill_categories category
      JOIN category_revisions revision ON revision.id = category.published_revision_id
      WHERE category.status = 'published'
      ORDER BY lower(revision.name), category.id
    `.execute(this.db);
    return result.rows;
  }

  async search(criteria: CatalogSearchCriteria): Promise<CatalogItem[]> {
    const query = criteria.query?.trim() ?? '';
    const categoryId = criteria.categoryId ?? null;
    const itemType = criteria.type ?? null;
    const cursor = criteria.cursor ?? null;
    const result = await sql<CatalogRow>`
      WITH catalog AS (
        SELECT skill.id, 'skill'::text AS type, skill.slug,
          revision.name AS title, revision.description AS summary,
          category.id AS category_id, category.slug AS category_slug,
          category_revision.name AS category_name,
          category_revision.description AS category_description
        FROM skills skill
        JOIN skill_revisions revision ON revision.id = skill.published_revision_id
        JOIN skill_categories category
          ON category.id = revision.category_id AND category.status = 'published'
        JOIN category_revisions category_revision ON category_revision.id = category.published_revision_id
        WHERE skill.status = 'published'

        UNION ALL

        SELECT trail.id, 'trail'::text AS type, trail.slug,
          revision.title, revision.description,
          category.id, category.slug, category_revision.name, category_revision.description
        FROM learning_trails trail
        JOIN trail_revisions revision ON revision.id = trail.published_revision_id
        JOIN skill_categories category
          ON category.id = revision.category_id AND category.status = 'published'
        JOIN category_revisions category_revision ON category_revision.id = category.published_revision_id
        WHERE trail.status = 'published'

        UNION ALL

        SELECT certification.id, 'certification'::text AS type, certification.slug,
          revision.name, revision.description,
          NULL::uuid, NULL::varchar, NULL::varchar, NULL::text
        FROM certifications certification
        JOIN certification_revisions revision ON revision.id = certification.published_revision_id
        WHERE certification.status = 'published'
          AND (${categoryId}::uuid IS NULL OR EXISTS (
            SELECT 1
            FROM certification_revision_skills certification_skill
            JOIN skills related_skill
              ON related_skill.id = certification_skill.skill_id AND related_skill.status = 'published'
            JOIN skill_revisions related_skill_revision
              ON related_skill_revision.id = related_skill.published_revision_id
            WHERE certification_skill.certification_revision_id = revision.id
              AND related_skill_revision.category_id = ${categoryId}::uuid
            UNION
            SELECT 1
            FROM certification_revision_trails certification_trail
            JOIN learning_trails related_trail
              ON related_trail.id = certification_trail.trail_id AND related_trail.status = 'published'
            JOIN trail_revisions related_trail_revision
              ON related_trail_revision.id = related_trail.published_revision_id
            WHERE certification_trail.certification_revision_id = revision.id
              AND related_trail_revision.category_id = ${categoryId}::uuid
          ))
      )
      SELECT id, type, slug, title, summary, category_id, category_slug,
        category_name, category_description
      FROM catalog
      WHERE (${itemType}::text IS NULL OR type = ${itemType}::text)
        AND (${categoryId}::uuid IS NULL OR category_id = ${categoryId}::uuid OR type = 'certification')
        AND (${query}::text = '' OR title ILIKE '%' || ${query} || '%'
          OR summary ILIKE '%' || ${query} || '%' OR slug ILIKE '%' || ${query} || '%')
        AND (${cursor?.id ?? null}::uuid IS NULL OR
          (lower(title), type, id) > (${cursor?.title ?? null}::text, ${cursor?.type ?? null}::text, ${cursor?.id ?? null}::uuid))
      ORDER BY lower(title), type, id
      LIMIT ${criteria.limit}
    `.execute(this.db);
    return result.rows.map(mapCatalogRow);
  }

  async getSkill(id: string): Promise<CatalogItem | null> {
    const result = await sql<CatalogRow>`
      SELECT skill.id, 'skill'::text AS type, skill.slug,
        revision.name AS title, revision.description AS summary,
        category.id AS category_id, category.slug AS category_slug,
        category_revision.name AS category_name,
        category_revision.description AS category_description
      FROM skills skill
      JOIN skill_revisions revision ON revision.id = skill.published_revision_id
      JOIN skill_categories category
        ON category.id = revision.category_id AND category.status = 'published'
      JOIN category_revisions category_revision ON category_revision.id = category.published_revision_id
      WHERE skill.id = ${id} AND skill.status = 'published'
    `.execute(this.db);
    return result.rows[0] ? mapCatalogRow(result.rows[0]) : null;
  }

  async listTrailsForSkill(skillId: string): Promise<CatalogItem[]> {
    const result = await sql<CatalogRow>`
      SELECT DISTINCT trail.id, 'trail'::text AS type, trail.slug,
        revision.title, revision.description AS summary,
        category.id AS category_id, category.slug AS category_slug,
        category_revision.name AS category_name,
        category_revision.description AS category_description
      FROM learning_trails trail
      JOIN trail_revisions revision ON revision.id = trail.published_revision_id
      JOIN trail_step_skills step_skill ON step_skill.trail_revision_id = revision.id
      JOIN skill_categories category
        ON category.id = revision.category_id AND category.status = 'published'
      JOIN category_revisions category_revision ON category_revision.id = category.published_revision_id
      WHERE trail.status = 'published' AND step_skill.skill_id = ${skillId}
      ORDER BY title, trail.id
    `.execute(this.db);
    return result.rows.map(mapCatalogRow);
  }

  async listCertificationsForSkill(skillId: string): Promise<CatalogItem[]> {
    const result = await sql<CatalogRow>`
      SELECT DISTINCT certification.id, 'certification'::text AS type, certification.slug,
        revision.name AS title, revision.description AS summary,
        NULL::uuid AS category_id, NULL::varchar AS category_slug,
        NULL::varchar AS category_name, NULL::text AS category_description
      FROM certifications certification
      JOIN certification_revisions revision ON revision.id = certification.published_revision_id
      JOIN certification_revision_skills certification_skill
        ON certification_skill.certification_revision_id = revision.id
      WHERE certification.status = 'published' AND certification_skill.skill_id = ${skillId}
      ORDER BY title, certification.id
    `.execute(this.db);
    return result.rows.map(mapCatalogRow);
  }

  async getTrail(id: string): Promise<DetailRow | null> {
    const result = await sql<DetailRow>`
      SELECT trail.id, 'trail'::text AS type, trail.slug,
        revision.title, revision.description AS summary, revision.id AS revision_id,
        category.id AS category_id, category.slug AS category_slug,
        category_revision.name AS category_name,
        category_revision.description AS category_description
      FROM learning_trails trail
      JOIN trail_revisions revision ON revision.id = trail.published_revision_id
      JOIN skill_categories category
        ON category.id = revision.category_id AND category.status = 'published'
      JOIN category_revisions category_revision ON category_revision.id = category.published_revision_id
      WHERE trail.id = ${id} AND trail.status = 'published'
    `.execute(this.db);
    return result.rows[0] ?? null;
  }

  async listTrailSteps(revisionId: string): Promise<TrailStepRow[]> {
    const result = await sql<TrailStepRow>`
      SELECT step_id AS id, position, title, description, required
      FROM trail_revision_steps
      WHERE trail_revision_id = ${revisionId}
      ORDER BY position
    `.execute(this.db);
    return result.rows;
  }

  async listSkillsForTrailStep(revisionId: string, stepId: string): Promise<CatalogItem[]> {
    const result = await sql<CatalogRow>`
      SELECT skill.id, 'skill'::text AS type, skill.slug,
        revision.name AS title, revision.description AS summary,
        category.id AS category_id, category.slug AS category_slug,
        category_revision.name AS category_name,
        category_revision.description AS category_description
      FROM trail_step_skills step_skill
      JOIN skills skill ON skill.id = step_skill.skill_id AND skill.status = 'published'
      JOIN skill_revisions revision ON revision.id = skill.published_revision_id
      JOIN skill_categories category
        ON category.id = revision.category_id AND category.status = 'published'
      JOIN category_revisions category_revision ON category_revision.id = category.published_revision_id
      WHERE step_skill.trail_revision_id = ${revisionId} AND step_skill.step_id = ${stepId}
      ORDER BY lower(revision.name), skill.id
    `.execute(this.db);
    return result.rows.map(mapCatalogRow);
  }

  async listPrerequisites(revisionId: string, stepId: string): Promise<string[]> {
    const result = await sql<{ prerequisite_step_id: string }>`
      SELECT prerequisite_step_id
      FROM trail_step_prerequisites
      WHERE trail_revision_id = ${revisionId} AND step_id = ${stepId}
      ORDER BY prerequisite_step_id
    `.execute(this.db);
    return result.rows.map(({ prerequisite_step_id }) => prerequisite_step_id);
  }

  async listCertificationsForTrail(trailId: string): Promise<CatalogItem[]> {
    const result = await sql<CatalogRow>`
      SELECT DISTINCT certification.id, 'certification'::text AS type, certification.slug,
        revision.name AS title, revision.description AS summary,
        NULL::uuid AS category_id, NULL::varchar AS category_slug,
        NULL::varchar AS category_name, NULL::text AS category_description
      FROM certifications certification
      JOIN certification_revisions revision ON revision.id = certification.published_revision_id
      JOIN certification_revision_trails certification_trail
        ON certification_trail.certification_revision_id = revision.id
      WHERE certification.status = 'published' AND certification_trail.trail_id = ${trailId}
      ORDER BY title, certification.id
    `.execute(this.db);
    return result.rows.map(mapCatalogRow);
  }

  async getCertification(id: string): Promise<(DetailRow & { issuer: string }) | null> {
    const result = await sql<DetailRow & { issuer: string }>`
      SELECT certification.id, 'certification'::text AS type, certification.slug,
        revision.name AS title, revision.description AS summary, revision.id AS revision_id,
        revision.issuer, NULL::uuid AS category_id, NULL::varchar AS category_slug,
        NULL::varchar AS category_name, NULL::text AS category_description
      FROM certifications certification
      JOIN certification_revisions revision ON revision.id = certification.published_revision_id
      WHERE certification.id = ${id} AND certification.status = 'published'
    `.execute(this.db);
    return result.rows[0] ?? null;
  }

  async listSkillsForCertification(revisionId: string): Promise<CatalogItem[]> {
    const result = await sql<CatalogRow>`
      SELECT skill.id, 'skill'::text AS type, skill.slug,
        revision.name AS title, revision.description AS summary,
        category.id AS category_id, category.slug AS category_slug,
        category_revision.name AS category_name,
        category_revision.description AS category_description
      FROM certification_revision_skills certification_skill
      JOIN skills skill ON skill.id = certification_skill.skill_id AND skill.status = 'published'
      JOIN skill_revisions revision ON revision.id = skill.published_revision_id
      JOIN skill_categories category
        ON category.id = revision.category_id AND category.status = 'published'
      JOIN category_revisions category_revision ON category_revision.id = category.published_revision_id
      WHERE certification_skill.certification_revision_id = ${revisionId}
      ORDER BY lower(revision.name), skill.id
    `.execute(this.db);
    return result.rows.map(mapCatalogRow);
  }

  async listTrailsForCertification(revisionId: string): Promise<CatalogItem[]> {
    const result = await sql<CatalogRow>`
      SELECT trail.id, 'trail'::text AS type, trail.slug,
        revision.title, revision.description AS summary,
        category.id AS category_id, category.slug AS category_slug,
        category_revision.name AS category_name,
        category_revision.description AS category_description
      FROM certification_revision_trails certification_trail
      JOIN learning_trails trail
        ON trail.id = certification_trail.trail_id AND trail.status = 'published'
      JOIN trail_revisions revision ON revision.id = trail.published_revision_id
      JOIN skill_categories category
        ON category.id = revision.category_id AND category.status = 'published'
      JOIN category_revisions category_revision ON category_revision.id = category.published_revision_id
      WHERE certification_trail.certification_revision_id = ${revisionId}
      ORDER BY lower(revision.title), trail.id
    `.execute(this.db);
    return result.rows.map(mapCatalogRow);
  }

  async listCertificationRequirements(revisionId: string): Promise<CertificationRequirement[]> {
    const result = await sql<CertificationRequirement>`
      SELECT requirement.id, requirement.position, requirement.title,
        requirement.requirement_type AS type,
        COALESCE(requirement.skill_id, requirement.trail_id) AS "targetId",
        requirement.required
      FROM certification_requirements requirement
      LEFT JOIN skills skill ON skill.id = requirement.skill_id AND skill.status = 'published'
      LEFT JOIN learning_trails trail ON trail.id = requirement.trail_id AND trail.status = 'published'
      WHERE requirement.certification_revision_id = ${revisionId}
        AND ((requirement.requirement_type = 'skill' AND skill.id IS NOT NULL)
          OR (requirement.requirement_type = 'trail' AND trail.id IS NOT NULL))
      ORDER BY requirement.position
    `.execute(this.db);
    return result.rows;
  }
}

export function mapCatalogRow(row: CatalogRow): CatalogItem {
  return {
    id: row.id,
    type: row.type,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    category:
      row.category_id && row.category_slug && row.category_name && row.category_description !== null
        ? {
            id: row.category_id,
            slug: row.category_slug,
            name: row.category_name,
            description: row.category_description,
          }
        : null,
  };
}

export function mapDetailRow(row: DetailRow): CatalogItem {
  return mapCatalogRow(row);
}
