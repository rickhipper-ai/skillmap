import { describe, expect, it } from 'vitest';

import { createLoggerOptions } from '../../src/plugins/observability.js';
import { sessionCookie } from '../../src/modules/identity/routes.js';
import { withPostgres } from '../support/postgres.js';
import {
  CapturingEmail,
  createDatabaseApp,
  csrf,
  mutate,
  registerVerifyAndLogin,
  testOrigin,
} from '../support/identity.js';

describe('identity security boundary', () => {
  it('uses the required host-only secure session cookie', () => {
    const serialized = sessionCookie('opaque-fictitious-session');

    expect(serialized).toContain('__Host-skillmaps-session=opaque-fictitious-session');
    expect(serialized).toContain('HttpOnly');
    expect(serialized).toContain('Secure');
    expect(serialized).toContain('SameSite=Lax');
    expect(serialized).toContain('Path=/');
    expect(serialized).not.toMatch(/Domain=/i);
  });

  it('redacts credentials, tokens, cookies, and e-mail fields from structured logs', () => {
    const options = createLoggerOptions();
    expect(typeof options).toBe('object');
    const paths = JSON.stringify(
      typeof options === 'object' && 'redact' in options ? options.redact : '',
    );

    expect(paths).toContain('password');
    expect(paths).toContain('token');
    expect(paths).toContain('cookie');
    expect(paths).toContain('email');
  });
});

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')('identity HTTP security', () => {
  it('resists enumeration, enforces CSRF/rate limits, and persists only secure hashes', async () => {
    await withPostgres(async ({ admin, database }) => {
      const email = new CapturingEmail();
      const app = createDatabaseApp(database, email);
      const proof = await csrf(app);
      try {
        const noCsrf = await app.inject({
          method: 'POST',
          url: '/v1/password-reset-requests',
          headers: { origin: testOrigin },
          payload: { email: 'ninguem@example.test' },
        });
        expect(noCsrf.statusCode).toBe(403);

        const cookie = await registerVerifyAndLogin(
          app,
          email,
          proof,
          'seguranca.ficticia@example.test',
        );
        const login = await mutate(app, proof, {
          method: 'POST',
          url: '/v1/sessions',
          payload: { email: 'seguranca.ficticia@example.test', password: 'Senha-ficticia-123!' },
        });
        const setCookie = String(login.headers['set-cookie']);
        expect(setCookie).toContain('__Host-skillmaps-session=');
        expect(setCookie).toContain('HttpOnly');
        expect(setCookie).toContain('Secure');
        expect(setCookie).toContain('SameSite=Lax');
        expect(setCookie).not.toMatch(/Domain=/i);

        const responses = [];
        for (let attempt = 0; attempt < 6; attempt += 1) {
          responses.push(
            await mutate(app, proof, {
              method: 'POST',
              url: '/v1/password-reset-requests',
              payload: { email: `desconhecido-${attempt}@example.test` },
            }),
          );
        }
        expect(responses.slice(0, 5).every((response) => response.statusCode === 202)).toBe(true);
        expect(responses[5]?.statusCode).toBe(429);
        expect(new Set(responses.slice(0, 5).map((response) => response.body))).toEqual(
          new Set(['']),
        );

        const stored = await admin.query<{ password: string; token_hash: string }>(
          `SELECT a.password, s.token_hash FROM auth_accounts a
           JOIN auth_sessions s ON s.user_id = a.user_id
           JOIN users u ON u.id = a.user_id
           WHERE a.provider_id = 'credential' AND u.email_normalized = $1 LIMIT 1`,
          ['seguranca.ficticia@example.test'],
        );
        expect(stored.rows[0]?.password).toMatch(/^\$argon2id\$/);
        expect(stored.rows[0]?.token_hash).toMatch(/^[0-9a-f]{64}$/);
        expect(stored.rows[0]?.token_hash).not.toContain(cookie.split('=', 2)[1] ?? 'not-present');
      } finally {
        await app.close();
      }
    });
  }, 120_000);
});
