import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { createDatabaseApp, csrf, mutate } from '../../apps/api/tests/support/identity.js';
import { withPostgres } from '../../apps/api/tests/support/postgres.js';
import { demoUserId, seedMvpCatalog } from '../seeds/mvp-catalog.js';

const migrationUrl = new URL('../migrations/0003_catalog.sql', import.meta.url);

describe('catalog migration ownership', () => {
  it('extends identity roots rather than recreating them', async () => {
    const sql = await readFile(migrationUrl, 'utf8');

    expect(sql).not.toMatch(/CREATE TABLE (professional_roles|skill_categories|skills)\b/i);
    expect(sql).toMatch(/ALTER TABLE skill_categories[\s\S]+published_revision_id/i);
    expect(sql).toMatch(/ALTER TABLE skills[\s\S]+published_revision_id/i);
    expect(sql).toMatch(/CREATE CONSTRAINT TRIGGER[\s\S]+DEFERRABLE INITIALLY DEFERRED/i);
  });
});

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')(
  'catalog PostgreSQL invariants',
  () => {
    it('enforces canonical slugs, root-owned pointers, ordered same-trail steps, targets, and acyclicity', async () => {
      await withPostgres(async ({ admin }) => {
        await admin.query(`
          INSERT INTO users (id, email_normalized, email_verified, status, email_verified_at, terms_accepted_at)
          VALUES ('10000000-0000-4000-8000-000000000001', 'catalog.admin@example.test', true, 'active', now(), now());
          INSERT INTO skill_categories (id, slug) VALUES
            ('20000000-0000-4000-8000-000000000001', 'engenharia-dados'),
            ('20000000-0000-4000-8000-000000000002', 'plataforma');
          INSERT INTO category_revisions (id, category_id, revision_number, name, description, created_by_user_id)
          VALUES
            ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'Engenharia de dados', 'Dados', '10000000-0000-4000-8000-000000000001'),
            ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 1, 'Plataforma', 'Plataforma', '10000000-0000-4000-8000-000000000001');
          INSERT INTO skills (id, slug) VALUES ('30000000-0000-4000-8000-000000000001', 'sql-canonico');
          INSERT INTO skill_revisions (id, skill_id, revision_number, category_id, name, description, created_by_user_id)
          VALUES ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 1, '20000000-0000-4000-8000-000000000001', 'SQL', 'Consulta de dados', '10000000-0000-4000-8000-000000000001');
          INSERT INTO learning_trails (id, slug) VALUES
            ('40000000-0000-4000-8000-000000000001', 'trilha-dados'),
            ('40000000-0000-4000-8000-000000000002', 'trilha-plataforma');
          INSERT INTO trail_revisions (id, trail_id, revision_number, category_id, title, description, created_by_user_id)
          VALUES
            ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, '20000000-0000-4000-8000-000000000001', 'Trilha de dados', 'Aprenda dados', '10000000-0000-4000-8000-000000000001'),
            ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 1, '20000000-0000-4000-8000-000000000002', 'Trilha de plataforma', 'Aprenda plataforma', '10000000-0000-4000-8000-000000000001');
          INSERT INTO trail_steps (id, trail_id) VALUES
            ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001'),
            ('42000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001'),
            ('42000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002');
          INSERT INTO trail_revision_steps (trail_revision_id, step_id, trail_id, position, title, description)
          VALUES
            ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, 'Fundamentos', 'Comece aqui'),
            ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 2, 'Pratica', 'Pratique');
          INSERT INTO certifications (id, slug) VALUES ('50000000-0000-4000-8000-000000000001', 'certificacao-dados');
          INSERT INTO certification_revisions (id, certification_id, revision_number, name, issuer, description, created_by_user_id)
          VALUES ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 1, 'Certificacao de dados', 'Instituto Ficticio', 'Valida fundamentos', '10000000-0000-4000-8000-000000000001');
        `);

        await expect(
          admin.query("INSERT INTO skills (slug) VALUES ('sql-canonico')"),
        ).rejects.toMatchObject({ code: '23505' });
        await expect(
          admin.query(
            "UPDATE skill_categories SET published_revision_id = '21000000-0000-4000-8000-000000000002' WHERE id = '20000000-0000-4000-8000-000000000001'",
          ),
        ).rejects.toMatchObject({ code: '23503' });
        await expect(
          admin.query(
            "INSERT INTO trail_revision_steps (trail_revision_id, step_id, trail_id, position, title) VALUES ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 3, 'Invalida')",
          ),
        ).rejects.toMatchObject({ code: '23503' });
        await expect(
          admin.query(
            "INSERT INTO trail_revision_steps (trail_revision_id, step_id, trail_id, position, title) VALUES ('41000000-0000-4000-8000-000000000001', gen_random_uuid(), '40000000-0000-4000-8000-000000000001', 2, 'Duplicada')",
          ),
        ).rejects.toBeDefined();
        await expect(
          admin.query(
            "INSERT INTO certification_requirements (certification_revision_id, title, requirement_type, skill_id, trail_id, position) VALUES ('51000000-0000-4000-8000-000000000001', 'Alvo ambiguo', 'skill', '30000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1)",
          ),
        ).rejects.toMatchObject({ code: '23514' });

        await expect(
          admin.query(`
            BEGIN;
            INSERT INTO trail_step_prerequisites (trail_revision_id, step_id, prerequisite_step_id)
            VALUES
              ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001'),
              ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002');
            COMMIT;
          `),
        ).rejects.toMatchObject({ code: '23514' });
        await admin.query('ROLLBACK');
      });
    });

    it('seeds an idempotent demo with catalog, authentication, progress, and dashboard data', async () => {
      await withPostgres(async ({ admin, database }) => {
        const demo = {
          email: 'demo.integration@example.test',
          password: 'Senha-demo-ficticia-123!',
        };
        await seedMvpCatalog(admin, demo);
        await seedMvpCatalog(admin, demo);

        const steps = await admin.query<{ count: string }>(`
          SELECT count(*)::text AS count
          FROM trail_revision_steps
          WHERE trail_revision_id = '41000000-0000-4000-8000-000000000001'
        `);
        const sharedSkills = await admin.query<{ count: string }>(`
          SELECT count(DISTINCT revision.trail_id)::text AS count
          FROM trail_step_skills relation
          JOIN trail_revisions revision ON revision.id = relation.trail_revision_id
          WHERE relation.skill_id = '30000000-0000-4000-8000-000000000001'
        `);
        const certifications = await admin.query<{ count: string }>(
          "SELECT count(*)::text AS count FROM certifications WHERE status = 'published'",
        );
        const demoData = await admin.query<{
          accounts: string;
          achievements: string;
          certification_records: string;
          completed_trails: string;
          progress_events: string;
          recommendations: string;
        }>(
          `SELECT
             (SELECT count(*) FROM auth_accounts WHERE user_id = $1)::text AS accounts,
             (SELECT count(*) FROM progress_events WHERE user_id = $1)::text AS progress_events,
             (SELECT count(*) FROM user_trail_states WHERE user_id = $1 AND status = 'completed')::text AS completed_trails,
             (SELECT count(*) FROM user_certification_records WHERE user_id = $1)::text AS certification_records,
             (SELECT count(*) FROM user_achievement_awards WHERE user_id = $1)::text AS achievements,
             (SELECT count(*) FROM learning_recommendations WHERE user_id = $1)::text AS recommendations`,
          [demoUserId],
        );

        expect(steps.rows[0]?.count).toBe('5');
        expect(sharedSkills.rows[0]?.count).toBe('2');
        expect(certifications.rows[0]?.count).toBe('2');
        expect(demoData.rows[0]).toEqual({
          accounts: '1',
          achievements: '2',
          certification_records: '1',
          completed_trails: '1',
          progress_events: '6',
          recommendations: '1',
        });

        const app = createDatabaseApp(database);
        try {
          const proof = await csrf(app);
          const login = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/sessions',
            payload: demo,
          });
          expect(login.statusCode).toBe(201);
          const rawCookie = login.headers['set-cookie'];
          const cookie =
            (Array.isArray(rawCookie) ? rawCookie[0] : rawCookie)?.split(';', 1)[0] ?? '';
          const dashboard = await app.inject({
            method: 'GET',
            url: '/v1/me/dashboard',
            headers: { cookie },
          });
          expect(dashboard.statusCode).toBe(200);
          expect(dashboard.json()).toMatchObject({
            activeTrails: [{ trailId: '40000000-0000-4000-8000-000000000002' }],
            certificationRecords: [{ certificationId: '50000000-0000-4000-8000-000000000001' }],
            achievements: [{ achievementId: '70000000-0000-4000-8000-000000000001' }],
            recommendations: [{ trailId: '40000000-0000-4000-8000-000000000002' }],
          });
        } finally {
          await app.close();
        }
      });
    }, 120_000);
  },
);
