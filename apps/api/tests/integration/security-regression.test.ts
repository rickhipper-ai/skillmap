import { describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import { withPostgres } from '../support/postgres.js';
import {
  CapturingEmail,
  createDatabaseApp,
  csrf,
  mutate,
  registerVerifyAndLogin,
  testOrigin,
} from '../support/identity.js';

const userIdPattern = '00000000-0000-4000-8000-000000000001';

describe('cross-story security regression', () => {
  it('keeps internal failures and submitted secrets out of problem responses', async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/sessions',
        headers: {
          origin: 'http://localhost:5173',
          'x-csrf-token': 'submitted-secret-token-at-least-thirty-two-characters',
          cookie: '__Host-skillmaps-csrf=submitted-secret-token-at-least-thirty-two-characters',
        },
        payload: { email: 'private@example.test', password: 'Submitted-secret-password-123!' },
      });

      expect(response.statusCode).toBe(503);
      expect(response.headers['content-type']).toContain('application/problem+json');
      expect(response.json()).toMatchObject({ code: 'SERVICE_UNAVAILABLE', status: 503 });
      expect(response.body).not.toMatch(/private@example|Submitted-secret|stack|database|sql/i);
    } finally {
      await app.close();
    }
  });
});

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')(
  'cross-story database security regression',
  () => {
    it('denies anonymous, unverified, expired, and deletion-pending access on every private story', async () => {
      await withPostgres(async ({ admin, database }) => {
        const email = new CapturingEmail();
        const app = createDatabaseApp(database, email);
        const proof = await csrf(app);
        const protectedReads = [
          '/v1/users/me',
          `/v1/me/trails/${userIdPattern}`,
          '/v1/me/dashboard',
          '/v1/me/certification-records',
          '/v1/me/achievements',
        ];

        try {
          for (const url of protectedReads) {
            const response = await app.inject({ method: 'GET', url });
            expect(response.statusCode, url).toBe(401);
            expect(response.json()).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
          }

          await mutate(app, proof, {
            method: 'POST',
            url: '/v1/registrations',
            payload: {
              name: 'Pessoa Pendente',
              email: 'pending-security@example.test',
              password: 'Senha-ficticia-123!',
              acceptTerms: true,
            },
          });
          const pendingLogin = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/sessions',
            payload: {
              email: 'pending-security@example.test',
              password: 'Senha-ficticia-123!',
            },
          });
          expect(pendingLogin.statusCode).toBe(401);
          expect(pendingLogin.body).not.toMatch(/pending-security|pending_verification/i);

          const expiredCookie = await registerVerifyAndLogin(
            app,
            email,
            proof,
            'expired-security@example.test',
          );
          await admin.query(
            `UPDATE auth_sessions
             SET created_at = now() - interval '2 minutes', expires_at = now() - interval '1 minute'
             WHERE user_id = (SELECT id FROM users WHERE email_normalized = $1)`,
            ['expired-security@example.test'],
          );
          expect(
            (
              await app.inject({
                method: 'GET',
                url: '/v1/users/me',
                headers: { cookie: expiredCookie },
              })
            ).statusCode,
          ).toBe(401);

          const deletingCookie = await registerVerifyAndLogin(
            app,
            email,
            proof,
            'deleting-security@example.test',
          );
          await admin.query(
            `UPDATE users SET status = 'deletion_pending', deletion_requested_at = now()
             WHERE email_normalized = $1`,
            ['deleting-security@example.test'],
          );
          const deletionPending = await app.inject({
            method: 'GET',
            url: '/v1/users/me',
            headers: { cookie: deletingCookie },
          });
          expect(deletionPending.statusCode).toBe(401);
          expect(deletionPending.json()).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
          expect(deletionPending.body).not.toMatch(/deletion_pending|deleting-security/i);
        } finally {
          await app.close();
        }
      });
    }, 120_000);

    it('isolates users and rejects privilege escalation, invalid origins, CSRF, and open input', async () => {
      await withPostgres(async ({ admin, database }) => {
        const email = new CapturingEmail();
        const app = createDatabaseApp(database, email);
        const proof = await csrf(app);
        const sessionA = await registerVerifyAndLogin(app, email, proof, 'user-a@example.test');
        const sessionB = await registerVerifyAndLogin(app, email, proof, 'user-b@example.test');

        try {
          for (const [session, displayName] of [
            [sessionA, 'Pessoa A'],
            [sessionB, 'Pessoa B'],
          ] as const) {
            const update = await mutate(
              app,
              proof,
              {
                method: 'PATCH',
                url: '/v1/users/me',
                headers: { 'content-type': 'application/merge-patch+json' },
                payload: { displayName, experienceLevel: 'beginner' },
              },
              session,
            );
            expect(update.statusCode).toBe(200);
          }

          const profileA = await app.inject({
            method: 'GET',
            url: '/v1/users/me',
            headers: { cookie: sessionA },
          });
          expect(profileA.body).toContain('Pessoa A');
          expect(profileA.body).not.toContain('Pessoa B');

          const adminDenied = await mutate(
            app,
            proof,
            {
              method: 'POST',
              url: '/v1/admin/categories',
              payload: { slug: 'denied-security', name: 'Denied', description: 'Must not persist' },
            },
            sessionA,
          );
          expect(adminDenied.statusCode).toBe(403);
          expect(adminDenied.json()).toMatchObject({ code: 'CONTENT_ADMIN_REQUIRED' });

          const noCsrf = await app.inject({
            method: 'PATCH',
            url: '/v1/users/me',
            headers: {
              origin: testOrigin,
              cookie: sessionA,
              'content-type': 'application/merge-patch+json',
            },
            payload: { displayName: 'CSRF changed', experienceLevel: 'beginner' },
          });
          expect(noCsrf.statusCode).toBe(403);
          expect(noCsrf.json()).toMatchObject({ code: 'INVALID_CSRF_TOKEN' });

          const badOrigin = await app.inject({
            method: 'PATCH',
            url: '/v1/users/me',
            headers: {
              origin: 'https://evil.example.test',
              'x-csrf-token': proof.token,
              cookie: `${proof.cookie}; ${sessionA}`,
              'content-type': 'application/merge-patch+json',
            },
            payload: { displayName: 'Origin changed', experienceLevel: 'beginner' },
          });
          expect(badOrigin.statusCode).toBe(403);
          expect(badOrigin.json()).toMatchObject({ code: 'ORIGIN_NOT_ALLOWED' });

          const massAssignment = await mutate(
            app,
            proof,
            {
              method: 'PATCH',
              url: '/v1/users/me',
              headers: { 'content-type': 'application/merge-patch+json' },
              payload: {
                displayName: '<script>not executable</script>',
                experienceLevel: 'beginner',
                roles: ['content_admin'],
                userId: userIdPattern,
              },
            },
            sessionA,
          );
          expect(massAssignment.statusCode).toBe(422);
          expect(massAssignment.body).not.toMatch(/content_admin.*granted|stack|sql/i);

          const role = await admin.query<{ role: string }>(
            `SELECT role::text FROM user_roles
             WHERE user_id = (SELECT id FROM users WHERE email_normalized = 'user-a@example.test')`,
          );
          expect(role.rows.map(({ role: value }) => value)).toEqual(['user']);
          const forbiddenWrites = await admin.query<{ count: string }>(
            "SELECT count(*)::text AS count FROM skill_categories WHERE slug = 'denied-security'",
          );
          expect(forbiddenWrites.rows[0]?.count).toBe('0');
        } finally {
          await app.close();
        }
      });
    }, 120_000);

    it('rate limits enumeration-safe recovery and keeps submitted identity data out of audit metadata', async () => {
      await withPostgres(async ({ admin, database }) => {
        const app = createDatabaseApp(database, new CapturingEmail());
        const proof = await csrf(app);
        try {
          const responses = [];
          for (let attempt = 0; attempt < 6; attempt += 1) {
            responses.push(
              await mutate(app, proof, {
                method: 'POST',
                url: '/v1/password-reset-requests',
                headers: { authorization: 'Bearer submitted-secret-token' },
                payload: { email: `unknown-private-${attempt}@example.test` },
              }),
            );
          }
          expect(responses.slice(0, 5).every(({ statusCode }) => statusCode === 202)).toBe(true);
          expect(new Set(responses.slice(0, 5).map(({ body }) => body))).toEqual(new Set(['']));
          expect(responses[5]?.statusCode).toBe(429);
          expect(responses[5]?.body).not.toMatch(/unknown-private|submitted-secret|stack|sql/i);

          const audit = await admin.query<{ metadata: unknown }>(
            'SELECT metadata FROM audit_events',
          );
          expect(JSON.stringify(audit.rows)).not.toMatch(
            /unknown-private|submitted-secret|password|authorization|cookie/i,
          );
        } finally {
          await app.close();
        }
      });
    }, 120_000);
  },
);
