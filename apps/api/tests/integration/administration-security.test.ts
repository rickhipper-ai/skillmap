import { describe, expect, it } from 'vitest';

import { withPostgres } from '../support/postgres.js';
import {
  CapturingEmail,
  createDatabaseApp,
  csrf,
  mutate,
  registerVerifyAndLogin,
  testOrigin,
} from '../support/identity.js';

const input = { slug: 'seguranca', name: 'Seguranca', description: 'Categoria segura' };

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')(
  'administration security boundary',
  () => {
    it('requires active content admins, CSRF, closed inputs, and records redacted denials', async () => {
      await withPostgres(async ({ admin, database }) => {
        const email = new CapturingEmail();
        const app = createDatabaseApp(database, email);
        const proof = await csrf(app);
        const normalSession = await registerVerifyAndLogin(
          app,
          email,
          proof,
          'normal@example.test',
        );
        try {
          const unauthenticated = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/admin/categories',
            payload: input,
          });
          expect(unauthenticated.statusCode).toBe(401);

          const noCsrf = await app.inject({
            method: 'POST',
            url: '/v1/admin/categories',
            headers: { origin: testOrigin, cookie: normalSession },
            payload: input,
          });
          expect(noCsrf.statusCode).toBe(403);

          const denied = await mutate(
            app,
            proof,
            {
              method: 'POST',
              url: '/v1/admin/categories',
              headers: { authorization: 'Bearer must-not-be-audited' },
              payload: input,
            },
            normalSession,
          );
          expect(denied.statusCode).toBe(403);
          expect(denied.json()).toMatchObject({ code: 'CONTENT_ADMIN_REQUIRED' });

          const actor = await admin.query<{ id: string }>(
            "SELECT id FROM users WHERE email_normalized = 'normal@example.test'",
          );
          await admin.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'content_admin')", [
            actor.rows[0]!.id,
          ]);
          const massAssignment = await mutate(
            app,
            proof,
            {
              method: 'POST',
              url: '/v1/admin/categories',
              payload: {
                ...input,
                status: 'published',
                role: 'content_admin',
                publishedRevisionId: crypto.randomUUID(),
              },
            },
            normalSession,
          );
          expect(massAssignment.statusCode).toBe(422);

          const audit = await admin.query<{ outcome: string; metadata: unknown }>(`
            SELECT outcome, metadata FROM audit_events
            WHERE event_type = 'catalog.admin.create_category'
            ORDER BY id DESC LIMIT 1
          `);
          expect(audit.rows[0]?.outcome).toBe('denied');
          const metadata = JSON.stringify(audit.rows[0]?.metadata);
          expect(metadata.length).toBeLessThan(1000);
          expect(metadata).not.toMatch(/must-not-be-audited|normal@example|token|authorization/i);
        } finally {
          await app.close();
        }
      });
    }, 120_000);

    it('rate limits administrative mutations without partially creating excess roots', async () => {
      await withPostgres(async ({ admin, database }) => {
        const email = new CapturingEmail();
        const app = createDatabaseApp(database, email);
        const proof = await csrf(app);
        const session = await registerVerifyAndLogin(app, email, proof, 'limited@example.test');
        const actor = await admin.query<{ id: string }>(
          "SELECT id FROM users WHERE email_normalized = 'limited@example.test'",
        );
        await admin.query("INSERT INTO user_roles (user_id, role) VALUES ($1, 'content_admin')", [
          actor.rows[0]!.id,
        ]);
        try {
          const responses = [];
          for (let attempt = 0; attempt < 21; attempt += 1) {
            responses.push(
              await mutate(
                app,
                proof,
                {
                  method: 'POST',
                  url: '/v1/admin/categories',
                  payload: { ...input, slug: `seguranca-${attempt}` },
                },
                session,
              ),
            );
          }
          expect(responses.slice(0, 20).every(({ statusCode }) => statusCode === 201)).toBe(true);
          expect(responses[20]?.statusCode).toBe(429);
          const count = await admin.query<{ count: string }>(
            "SELECT count(*)::text AS count FROM skill_categories WHERE slug LIKE 'seguranca-%'",
          );
          expect(count.rows[0]?.count).toBe('20');
        } finally {
          await app.close();
        }
      });
    }, 120_000);
  },
);
