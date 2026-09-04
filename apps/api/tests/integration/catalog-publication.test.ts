import { describe, expect, it } from 'vitest';

import { withPostgres } from '../support/postgres.js';
import {
  CapturingEmail,
  createDatabaseApp,
  csrf,
  mutate,
  registerVerifyAndLogin,
} from '../support/identity.js';

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')(
  'catalog publication and lifecycle',
  () => {
    it('atomically swaps immutable revisions and recalculates current-user progress', async () => {
      await withPostgres(async ({ admin, database }) => {
        await seedBaseCatalog(admin);
        const email = new CapturingEmail();
        const app = createDatabaseApp(database, email);
        const proof = await csrf(app);
        const session = await registerVerifyAndLogin(app, email, proof, 'publisher@example.test');
        const user = await admin.query<{ id: string }>(
          "SELECT id FROM users WHERE email_normalized = 'publisher@example.test'",
        );
        const actorId = user.rows[0]!.id;
        await admin.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'content_admin')", [
          actorId,
        ]);
        try {
          const created = await mutate(
            app,
            proof,
            {
              method: 'POST',
              url: '/v1/admin/trails',
              payload: trailInput('trilha-administrada', 2),
            },
            session,
          );
          expect(created.statusCode).toBe(201);
          const trailId = created.json<{ id: string }>().id;
          const firstPublication = await mutate(
            app,
            proof,
            {
              method: 'POST',
              url: `/v1/admin/trails/${trailId}/publications`,
              headers: { 'idempotency-key': '90000000-0000-4000-8000-000000000001' },
            },
            session,
          );
          expect(firstPublication.statusCode).toBe(201);
          const first = firstPublication.json<{ revisionId: string }>();

          await admin.query(
            `INSERT INTO user_trail_states
              (user_id, trail_id, last_seen_revision_id, start_command_id)
             VALUES ($1, $2, $3, '90000000-0000-4000-8000-000000000010')`,
            [actorId, trailId, first.revisionId],
          );
          const updated = await mutate(
            app,
            proof,
            {
              method: 'PATCH',
              url: `/v1/admin/trails/${trailId}`,
              headers: { 'content-type': 'application/merge-patch+json' },
              payload: trailInput('trilha-administrada', 3),
            },
            session,
          );
          expect(updated.statusCode).toBe(200);
          const secondPublication = await mutate(
            app,
            proof,
            {
              method: 'POST',
              url: `/v1/admin/trails/${trailId}/publications`,
              headers: { 'idempotency-key': '90000000-0000-4000-8000-000000000002' },
            },
            session,
          );
          expect(secondPublication.statusCode).toBe(201);
          const second = secondPublication.json<{ revisionId: string; revisionNumber: number }>();
          expect(second.revisionId).not.toBe(first.revisionId);
          expect(second.revisionNumber).toBe(2);

          const root = await admin.query<{ published_revision_id: string }>(
            'SELECT published_revision_id FROM learning_trails WHERE id = $1',
            [trailId],
          );
          const progress = await admin.query<{ catalog_change_pending: boolean }>(
            'SELECT catalog_change_pending FROM user_trail_states WHERE user_id = $1 AND trail_id = $2',
            [actorId, trailId],
          );
          expect(root.rows[0]?.published_revision_id).toBe(second.revisionId);
          expect(progress.rows[0]?.catalog_change_pending).toBe(true);
          await expect(
            admin.query('UPDATE trail_revisions SET title = $1 WHERE id = $2', [
              'Mutacao proibida',
              first.revisionId,
            ]),
          ).rejects.toMatchObject({ code: '55000' });
        } finally {
          await app.close();
        }
      });
    }, 120_000);

    it('unpublishes safely, blocks referenced unpublication, and deactivates non-destructively', async () => {
      await withPostgres(async ({ admin, database }) => {
        await seedBaseCatalog(admin);
        const email = new CapturingEmail();
        const app = createDatabaseApp(database, email);
        const proof = await csrf(app);
        const session = await registerVerifyAndLogin(app, email, proof, 'lifecycle@example.test');
        const actor = await admin.query<{ id: string }>(
          "SELECT id FROM users WHERE email_normalized = 'lifecycle@example.test'",
        );
        await admin.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'content_admin')", [
          actor.rows[0]!.id,
        ]);
        try {
          const editedSeed = await mutate(
            app,
            proof,
            {
              method: 'PATCH',
              url: '/v1/admin/catalog/skill/30000000-0000-4000-8000-000000000001',
              headers: { 'content-type': 'application/merge-patch+json' },
              payload: { description: 'Consultas SQL administradas' },
            },
            session,
          );
          expect(editedSeed.statusCode).toBe(200);
          const republishedSeed = await mutate(
            app,
            proof,
            {
              method: 'POST',
              url: '/v1/admin/catalog/skill/30000000-0000-4000-8000-000000000001/publications',
              headers: { 'idempotency-key': '90000000-0000-4000-8000-000000000020' },
            },
            session,
          );
          expect(republishedSeed.statusCode).toBe(201);
          expect(republishedSeed.json()).toMatchObject({ revisionNumber: 2 });

          const protectedUnpublish = await mutate(
            app,
            proof,
            {
              method: 'PATCH',
              url: '/v1/admin/catalog/skill/30000000-0000-4000-8000-000000000001/status',
              headers: { 'content-type': 'application/merge-patch+json' },
              payload: { status: 'unpublished' },
            },
            session,
          );
          expect(protectedUnpublish.statusCode).toBe(409);
          expect(protectedUnpublish.json()).toMatchObject({ allowedStatus: 'inactive' });

          const deactivate = await mutate(
            app,
            proof,
            {
              method: 'PATCH',
              url: '/v1/admin/catalog/skill/30000000-0000-4000-8000-000000000001/status',
              headers: { 'content-type': 'application/merge-patch+json' },
              payload: { status: 'inactive' },
            },
            session,
          );
          expect(deactivate.statusCode).toBe(200);
          const retained = await admin.query<{ revisions: string; relations: string }>(`
            SELECT
              (SELECT count(*)::text FROM skill_revisions
                WHERE skill_id = '30000000-0000-4000-8000-000000000001') AS revisions,
              (SELECT count(*)::text FROM trail_step_skills
                WHERE skill_id = '30000000-0000-4000-8000-000000000001') AS relations
          `);
          expect(Number(retained.rows[0]?.revisions)).toBeGreaterThan(0);
          expect(Number(retained.rows[0]?.relations)).toBeGreaterThan(0);
          const publicRead = await app.inject({
            method: 'GET',
            url: '/v1/skills/30000000-0000-4000-8000-000000000001',
          });
          expect(publicRead.statusCode).toBe(404);
        } finally {
          await app.close();
        }
      });
    }, 120_000);
  },
);

function trailInput(slug: string, count: number) {
  return {
    slug,
    categoryId: '20000000-0000-4000-8000-000000000001',
    title: 'Trilha administrada',
    description: 'Publicacao atomica criada em teste.',
    targetRoleIds: [],
    steps: Array.from({ length: count }, (_, index) => ({
      stepId: `82000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      position: index + 1,
      title: `Etapa ${index + 1}`,
      description: `Descricao ${index + 1}`,
      required: true,
      skillIds: ['30000000-0000-4000-8000-000000000001'],
      prerequisiteStepIds:
        index === 0 ? [] : [`82000000-0000-4000-8000-${String(index).padStart(12, '0')}`],
    })),
  };
}

async function seedBaseCatalog(admin: { query(query: string): Promise<unknown> }) {
  await admin.query(`
    INSERT INTO users (id, email_normalized, email_verified, status, email_verified_at, terms_accepted_at)
    VALUES ('10000000-0000-4000-8000-000000000001', 'fixture.admin@example.test', true, 'active', now(), now());
    INSERT INTO skill_categories (id, slug, status)
    VALUES ('20000000-0000-4000-8000-000000000001', 'dados', 'published');
    INSERT INTO category_revisions (id, category_id, revision_number, name, description, created_by_user_id)
    VALUES ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001',
      1, 'Dados', 'Categoria publicada', '10000000-0000-4000-8000-000000000001');
    UPDATE skill_categories SET published_revision_id = '21000000-0000-4000-8000-000000000001';
    INSERT INTO skills (id, slug, status)
    VALUES ('30000000-0000-4000-8000-000000000001', 'sql', 'published');
    INSERT INTO skill_revisions (id, skill_id, revision_number, category_id, name, description, created_by_user_id)
    VALUES ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
      1, '20000000-0000-4000-8000-000000000001', 'SQL', 'Consultas SQL',
      '10000000-0000-4000-8000-000000000001');
    UPDATE skills SET published_revision_id = '31000000-0000-4000-8000-000000000001';
    INSERT INTO learning_trails (id, slug, status)
    VALUES ('40000000-0000-4000-8000-000000000001', 'trilha-base', 'published');
    INSERT INTO trail_revisions (id, trail_id, revision_number, category_id, title, description, created_by_user_id)
    VALUES ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001',
      1, '20000000-0000-4000-8000-000000000001', 'Trilha base', 'Trilha publicada',
      '10000000-0000-4000-8000-000000000001');
    INSERT INTO trail_steps (id, trail_id)
    VALUES ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001');
    INSERT INTO trail_revision_steps (trail_revision_id, step_id, trail_id, position, title)
    VALUES ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001', 1, 'Fundamentos');
    INSERT INTO trail_step_skills (trail_revision_id, step_id, skill_id)
    VALUES ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000001');
    UPDATE learning_trails SET published_revision_id = '41000000-0000-4000-8000-000000000001';
  `);
}
