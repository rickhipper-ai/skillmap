import { describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import { withPostgres } from '../support/postgres.js';

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')('public catalog reads', () => {
  it('searches and filters current publications with stable cursor pagination', async () => {
    await withPostgres(async ({ admin, database }) => {
      await seedCatalog(admin);
      const app = buildApp({ database });
      try {
        const first = await app.inject({ method: 'GET', url: '/v1/catalog?limit=1' });
        expect(first.statusCode).toBe(200);
        const firstPage = first.json<{ items: Array<{ id: string }>; nextCursor: string | null }>();
        expect(firstPage.items).toHaveLength(1);
        expect(firstPage.nextCursor).toEqual(expect.any(String));

        const second = await app.inject({
          method: 'GET',
          url: `/v1/catalog?limit=10&cursor=${encodeURIComponent(firstPage.nextCursor!)}`,
        });
        expect(second.json<{ items: Array<{ id: string }> }>().items).not.toContainEqual(
          expect.objectContaining({ id: firstPage.items[0]?.id }),
        );

        const filtered = await app.inject({
          method: 'GET',
          url: '/v1/catalog?q=sql&type=skill&categoryId=20000000-0000-4000-8000-000000000001',
        });
        expect(filtered.json()).toMatchObject({
          items: [{ id: '30000000-0000-4000-8000-000000000001', type: 'skill' }],
        });
      } finally {
        await app.close();
      }
    });
  });

  it('returns canonical relationships once and excludes unpublished or inactive content', async () => {
    await withPostgres(async ({ admin, database }) => {
      await seedCatalog(admin);
      const app = buildApp({ database });
      try {
        const categories = await app.inject({ method: 'GET', url: '/v1/categories' });
        expect(categories.json<Array<{ id: string }>>().map(({ id }) => id)).toEqual([
          '20000000-0000-4000-8000-000000000001',
        ]);

        const skill = await app.inject({
          method: 'GET',
          url: '/v1/skills/30000000-0000-4000-8000-000000000001',
        });
        const skillDetail = skill.json<{
          relatedTrails: Array<{ id: string }>;
          relatedCertifications: Array<{ id: string }>;
        }>();
        expect(skillDetail.relatedTrails.map(({ id }) => id).sort()).toEqual([
          '40000000-0000-4000-8000-000000000001',
          '40000000-0000-4000-8000-000000000002',
        ]);
        expect(skillDetail.relatedCertifications).toEqual([
          expect.objectContaining({ id: '50000000-0000-4000-8000-000000000001' }),
        ]);

        const trail = await app.inject({
          method: 'GET',
          url: '/v1/trails/40000000-0000-4000-8000-000000000001',
        });
        expect(
          trail.json<{ steps: Array<{ position: number }> }>().steps.map((step) => step.position),
        ).toEqual([1, 2]);

        const certification = await app.inject({
          method: 'GET',
          url: '/v1/certifications/50000000-0000-4000-8000-000000000001',
        });
        expect(certification.json()).toMatchObject({
          issuer: 'Instituto Ficticio de Tecnologia',
          requirements: [
            { type: 'skill', targetId: '30000000-0000-4000-8000-000000000001' },
            { type: 'trail', targetId: '40000000-0000-4000-8000-000000000001' },
          ],
        });

        const hidden = await app.inject({
          method: 'GET',
          url: '/v1/skills/30000000-0000-4000-8000-000000000099',
        });
        expect(hidden.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
});

async function seedCatalog(admin: { query(query: string): Promise<unknown> }) {
  await admin.query(`
    INSERT INTO users (id, email_normalized, email_verified, status, email_verified_at, terms_accepted_at)
    VALUES ('10000000-0000-4000-8000-000000000001', 'reader.admin@example.test', true, 'active', now(), now());
    INSERT INTO skill_categories (id, slug, status) VALUES
      ('20000000-0000-4000-8000-000000000001', 'dados', 'published'),
      ('20000000-0000-4000-8000-000000000099', 'oculta', 'inactive');
    INSERT INTO category_revisions (id, category_id, revision_number, name, description, created_by_user_id) VALUES
      ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'Dados', 'Trabalho com dados', '10000000-0000-4000-8000-000000000001'),
      ('21000000-0000-4000-8000-000000000099', '20000000-0000-4000-8000-000000000099', 1, 'Oculta', 'Conteudo inativo', '10000000-0000-4000-8000-000000000001');
    UPDATE skill_categories SET published_revision_id = CASE id
      WHEN '20000000-0000-4000-8000-000000000001' THEN '21000000-0000-4000-8000-000000000001'::uuid
      ELSE '21000000-0000-4000-8000-000000000099'::uuid END;
    INSERT INTO skills (id, slug, status) VALUES
      ('30000000-0000-4000-8000-000000000001', 'sql', 'published'),
      ('30000000-0000-4000-8000-000000000099', 'legada', 'inactive');
    INSERT INTO skill_revisions (id, skill_id, revision_number, category_id, name, description, created_by_user_id) VALUES
      ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 1, '20000000-0000-4000-8000-000000000001', 'SQL', 'Consultas SQL canonicas', '10000000-0000-4000-8000-000000000001'),
      ('31000000-0000-4000-8000-000000000099', '30000000-0000-4000-8000-000000000099', 1, '20000000-0000-4000-8000-000000000099', 'Legada', 'Nao mostrar', '10000000-0000-4000-8000-000000000001');
    UPDATE skills SET published_revision_id = CASE id
      WHEN '30000000-0000-4000-8000-000000000001' THEN '31000000-0000-4000-8000-000000000001'::uuid
      ELSE '31000000-0000-4000-8000-000000000099'::uuid END;
    INSERT INTO learning_trails (id, slug, status) VALUES
      ('40000000-0000-4000-8000-000000000001', 'dados-essenciais', 'published'),
      ('40000000-0000-4000-8000-000000000002', 'analytics', 'published');
    INSERT INTO trail_revisions (id, trail_id, revision_number, category_id, title, description, created_by_user_id) VALUES
      ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, '20000000-0000-4000-8000-000000000001', 'Dados essenciais', 'Cinco fundamentos', '10000000-0000-4000-8000-000000000001'),
      ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 1, '20000000-0000-4000-8000-000000000001', 'Analytics', 'Analise aplicada', '10000000-0000-4000-8000-000000000001');
    INSERT INTO trail_steps (id, trail_id) VALUES
      ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001'),
      ('42000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001'),
      ('42000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002');
    INSERT INTO trail_revision_steps (trail_revision_id, step_id, trail_id, position, title, required) VALUES
      ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, 'Fundamentos', true),
      ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 2, 'Consultas', true),
      ('41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002', 1, 'Analise', true);
    INSERT INTO trail_step_skills (trail_revision_id, step_id, skill_id) VALUES
      ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001'),
      ('41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000001');
    INSERT INTO trail_step_prerequisites (trail_revision_id, step_id, prerequisite_step_id)
    VALUES ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001');
    UPDATE learning_trails SET published_revision_id = CASE id
      WHEN '40000000-0000-4000-8000-000000000001' THEN '41000000-0000-4000-8000-000000000001'::uuid
      ELSE '41000000-0000-4000-8000-000000000002'::uuid END;
    INSERT INTO certifications (id, slug, status) VALUES ('50000000-0000-4000-8000-000000000001', 'fundamentos-dados', 'published');
    INSERT INTO certification_revisions (id, certification_id, revision_number, name, issuer, description, created_by_user_id)
    VALUES ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 1, 'Fundamentos de dados', 'Instituto Ficticio de Tecnologia', 'Certificacao introdutoria', '10000000-0000-4000-8000-000000000001');
    INSERT INTO certification_revision_skills VALUES ('51000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
    INSERT INTO certification_revision_trails VALUES ('51000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001');
    INSERT INTO certification_requirements (id, certification_revision_id, title, requirement_type, skill_id, position) VALUES
      ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'Conhecer SQL', 'skill', '30000000-0000-4000-8000-000000000001', 1);
    INSERT INTO certification_requirements (id, certification_revision_id, title, requirement_type, trail_id, position) VALUES
      ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', 'Concluir dados essenciais', 'trail', '40000000-0000-4000-8000-000000000001', 2);
    UPDATE certifications SET published_revision_id = '51000000-0000-4000-8000-000000000001';
  `);
}
