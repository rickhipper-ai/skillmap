import { readFile } from 'node:fs/promises';

import { getSchema } from 'better-auth/db';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import type { AuditService } from '../../src/modules/audit/service.js';
import { NullEmailAdapter } from '../../src/modules/identity/email.js';
import type { IdentityRepository } from '../../src/modules/identity/repository.js';
import { IdentityService } from '../../src/modules/identity/service.js';
import { createAuth, type SkillMapsAuth } from '../../src/plugins/auth.js';
import type { FoundationDatabase } from '../../src/plugins/database.js';

function dependencies() {
  const api = {
    signUpEmail: vi.fn().mockResolvedValue({ user: { id: 'user-1' }, token: null }),
    signInEmail: vi.fn().mockResolvedValue({
      response: { token: 'opaque-session-token', user: { id: 'user-1' } },
      headers: new Headers({
        'set-cookie':
          '__Host-skillmaps-session=signed-session; Path=/; HttpOnly; Secure; SameSite=Lax',
      }),
    }),
    verifyEmailOTP: vi.fn().mockResolvedValue({ status: true, token: null, user: {} }),
  };
  const repository = {
    emailExists: vi.fn().mockResolvedValue(false),
    findRoles: vi.fn().mockResolvedValue(['user']),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  return {
    api,
    service: new IdentityService(
      repository as unknown as IdentityRepository,
      { api } as unknown as SkillMapsAuth,
      audit as unknown as AuditService,
    ),
  };
}

describe('Better Auth identity facade', () => {
  it('keeps the reviewed migration aligned with the Better Auth schema mapping', async () => {
    const db = new Kysely<FoundationDatabase>({
      dialect: new PostgresDialect({ pool: new Pool() }),
    });
    try {
      const auth = createAuth(
        db,
        'fictitious_schema_secret_at_least_32_chars',
        'https://app.skill-maps.test',
        new NullEmailAdapter(),
      );
      const schema = getSchema(auth.options);
      const expected = {
        users: [
          'auth_image',
          'auth_name',
          'created_at',
          'deletion_requested_at',
          'email_normalized',
          'email_verified',
          'email_verified_at',
          'status',
          'terms_accepted_at',
          'updated_at',
        ],
        auth_accounts: [
          'access_token',
          'access_token_expires_at',
          'account_id',
          'created_at',
          'id_token',
          'issuer',
          'password',
          'provider_id',
          'refresh_token',
          'refresh_token_expires_at',
          'scope',
          'updated_at',
          'user_id',
        ],
        auth_sessions: [
          'created_at',
          'expires_at',
          'ip_address',
          'token_hash',
          'updated_at',
          'user_agent',
          'user_id',
        ],
        auth_tokens: ['created_at', 'expires_at', 'identifier_hash', 'token_value', 'updated_at'],
      };

      expect(Object.keys(schema).sort()).toEqual(Object.keys(expected).sort());
      for (const [table, columns] of Object.entries(expected)) {
        expect(Object.keys(schema[table]?.fields ?? {}).sort()).toEqual(columns);
      }

      const migration = await readFile(
        new URL('../../../../database/migrations/0002_identity.sql', import.meta.url),
        'utf8',
      );
      for (const [table, columns] of Object.entries(expected)) {
        expect(migration).toContain(`CREATE TABLE ${table} (`);
        for (const column of columns) expect(migration).toMatch(new RegExp(`\\b${column}\\b`));
      }
      expect(migration).not.toContain('CREATE TABLE auth_credentials');
    } finally {
      await db.destroy();
    }
  });

  it('delegates registration and login to Better Auth server APIs', async () => {
    const { api, service } = dependencies();

    await service.register({ email: ' PESSOA@example.test ', password: 'Senha-ficticia-123!' });
    const session = await service.login(' PESSOA@example.test ', 'Senha-ficticia-123!');

    expect(api.signUpEmail).toHaveBeenCalledWith({
      body: { name: '', email: 'pessoa@example.test', password: 'Senha-ficticia-123!' },
    });
    expect(api.signInEmail).toHaveBeenCalledWith({
      body: {
        email: 'pessoa@example.test',
        password: 'Senha-ficticia-123!',
        rememberMe: true,
      },
      returnHeaders: true,
    });
    expect(session).toMatchObject({
      cookie: expect.stringContaining('__Host-skillmaps-session=signed-session'),
      userId: 'user-1',
    });
  });

  it('delegates the opaque e-mail token to the Better Auth OTP verifier', async () => {
    const { api, service } = dependencies();
    const token = Buffer.from(
      JSON.stringify(['pessoa@example.test', 'fictitious-opaque-otp']),
      'utf8',
    ).toString('base64url');

    await service.verifyEmail(token);

    expect(api.verifyEmailOTP).toHaveBeenCalledWith({
      body: { email: 'pessoa@example.test', otp: 'fictitious-opaque-otp' },
    });
  });
});
