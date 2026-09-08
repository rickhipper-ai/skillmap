import { describe, expect, it } from 'vitest';

import { hashOpaqueToken, hashPassword, verifyPassword } from '../../src/plugins/auth.js';
import { withPostgres } from '../support/postgres.js';
import {
  CapturingEmail,
  createDatabaseApp,
  csrf,
  mutate,
  registerVerifyAndLogin,
} from '../support/identity.js';

describe('identity lifecycle policies', () => {
  it('uses non-reversible hashes for one-time and session tokens', () => {
    const token = 'verification-token-with-at-least-thirty-two-characters';

    expect(hashOpaqueToken(token)).not.toContain(token);
    expect(hashOpaqueToken(token)).toBe(hashOpaqueToken(token));
    expect(hashOpaqueToken(`${token}-different`)).not.toBe(hashOpaqueToken(token));
  });

  it('stores and verifies passwords with Argon2id', async () => {
    const encoded = await hashPassword('Senha-ficticia-123!');

    expect(encoded).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(encoded, 'Senha-ficticia-123!')).resolves.toBe(true);
    await expect(verifyPassword(encoded, 'Senha-incorreta-123!')).resolves.toBe(false);
  });
});

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')(
  'identity lifecycle with PostgreSQL',
  () => {
    it('blocks pending access, consumes purpose-bound tokens once, and revokes sessions', async () => {
      await withPostgres(async ({ database }) => {
        const email = new CapturingEmail();
        const app = createDatabaseApp(database, email);
        const proof = await csrf(app);
        const address = 'ciclo.ficticio@example.test';
        const password = 'Senha-ficticia-123!';
        try {
          const registration = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/registrations',
            payload: { name: 'Pessoa Ciclo', email: address, password, acceptTerms: true },
          });
          expect(registration.statusCode).toBe(201);
          expect(registration.json()).toEqual({
            status: 'pending_verification',
            emailVerification: 'required',
          });
          expect(registration.headers['set-cookie'] ?? '').not.toContain('skillmaps-session');

          const duplicateRegistration = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/registrations',
            payload: { name: 'Pessoa Ciclo', email: address, password, acceptTerms: true },
          });
          expect(duplicateRegistration.statusCode).toBe(409);
          expect(duplicateRegistration.json()).toMatchObject({
            code: 'EMAIL_ALREADY_REGISTERED',
          });
          expect(duplicateRegistration.headers['set-cookie'] ?? '').not.toContain(
            'skillmaps-session',
          );

          const pendingLogin = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/sessions',
            payload: { email: address, password },
          });
          expect(pendingLogin.statusCode).toBe(401);

          const verificationToken = email.latestToken();
          const verification = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/email-verifications',
            payload: { token: verificationToken },
          });
          const replay = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/email-verifications',
            payload: { token: verificationToken },
          });
          expect(verification.statusCode).toBe(204);
          expect(replay.statusCode).toBe(410);

          const firstLogin = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/sessions',
            payload: { email: address, password },
          });
          const firstRawCookie = firstLogin.headers['set-cookie'];
          expect(String(firstRawCookie)).toContain('__Host-skillmaps-session=');
          expect(String(firstRawCookie)).not.toContain('__Secure-__Host-');
          const firstCookie =
            (Array.isArray(firstRawCookie) ? firstRawCookie[0] : firstRawCookie)?.split(
              ';',
              1,
            )[0] ?? '';
          const logout = await mutate(
            app,
            proof,
            {
              method: 'DELETE',
              url: '/v1/sessions/current',
            },
            firstCookie,
          );
          expect(logout.statusCode).toBe(204);
          expect(
            (
              await app.inject({
                method: 'GET',
                url: '/v1/users/me',
                headers: { cookie: firstCookie },
              })
            ).statusCode,
          ).toBe(401);

          const sessionOne = await registerVerifyAndLogin(
            app,
            email,
            proof,
            'segunda.ficticia@example.test',
          );
          const secondLogin = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/sessions',
            payload: { email: 'segunda.ficticia@example.test', password },
          });
          const rawCookie = secondLogin.headers['set-cookie'];
          const sessionTwo =
            (Array.isArray(rawCookie) ? rawCookie[0] : rawCookie)?.split(';', 1)[0] ?? '';
          expect(
            (
              await app.inject({
                method: 'GET',
                url: '/v1/users/me',
                headers: { cookie: sessionOne },
              })
            ).statusCode,
          ).toBe(200);

          const resetRequest = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/password-reset-requests',
            payload: { email: 'segunda.ficticia@example.test' },
          });
          expect(resetRequest.statusCode).toBe(202);
          const resetToken = email.latestToken();
          const reset = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/password-resets',
            payload: { token: resetToken, newPassword: 'Nova-senha-ficticia-456!' },
          });
          expect(reset.statusCode).toBe(204);
          expect(
            (
              await app.inject({
                method: 'GET',
                url: '/v1/users/me',
                headers: { cookie: sessionOne },
              })
            ).statusCode,
          ).toBe(401);
          expect(
            (
              await app.inject({
                method: 'GET',
                url: '/v1/users/me',
                headers: { cookie: sessionTwo },
              })
            ).statusCode,
          ).toBe(401);
        } finally {
          await app.close();
        }
      });
    }, 120_000);

    it('auto-verifies and creates the initial profile only when demo mode is enabled', async () => {
      await withPostgres(async ({ admin, database }) => {
        const email = new CapturingEmail();
        const app = createDatabaseApp(database, email, undefined, true);
        const proof = await csrf(app);
        const address = 'cadastro.demo@example.test';
        const password = 'Senha-ficticia-123!';
        try {
          const registration = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/registrations',
            payload: { name: 'Pessoa Demo', email: address, password, acceptTerms: true },
          });
          expect(registration.statusCode).toBe(201);
          expect(registration.json()).toEqual({
            status: 'active',
            emailVerification: 'automatic',
          });
          expect(email.messages).toHaveLength(0);

          const persisted = await admin.query<{
            email_verified: boolean;
            status: string;
            display_name: string;
            password: string;
          }>(
            `SELECT users.email_verified, users.status, profile.display_name, account.password
             FROM users
             JOIN professional_profiles profile ON profile.user_id = users.id
             JOIN auth_accounts account ON account.user_id = users.id
             WHERE users.email_normalized = $1 AND account.provider_id = 'credential'`,
            [address],
          );
          expect(persisted.rows[0]).toMatchObject({
            email_verified: true,
            status: 'active',
            display_name: 'Pessoa Demo',
          });
          expect(persisted.rows[0]?.password).toMatch(/^\$argon2id\$/);

          const login = await mutate(app, proof, {
            method: 'POST',
            url: '/v1/sessions',
            payload: { email: address, password },
          });
          expect(login.statusCode).toBe(201);
          expect(String(login.headers['set-cookie'])).toContain('__Host-skillmaps-session=');
        } finally {
          await app.close();
        }
      });
    }, 120_000);
  },
);
