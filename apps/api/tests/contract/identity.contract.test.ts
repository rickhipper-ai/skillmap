import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';
import { csrf } from '../support/identity.js';

const apps = [] as ReturnType<typeof buildApp>[];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('canonical identity contract', () => {
  it('publishes every identity operation with the canonical methods and media types', async () => {
    const app = buildApp();
    apps.push(app);
    const document = await app.inject({ method: 'GET', url: '/documentation/json' });
    const paths = document.json<{ paths: Record<string, Record<string, unknown>> }>().paths;

    expect(Object.keys(paths['/v1/registrations'] ?? {})).toContain('post');
    expect(Object.keys(paths['/v1/email-verification-requests'] ?? {})).toContain('post');
    expect(Object.keys(paths['/v1/email-verifications'] ?? {})).toContain('post');
    expect(Object.keys(paths['/v1/sessions'] ?? {})).toContain('post');
    expect(Object.keys(paths['/v1/sessions/current'] ?? {})).toContain('delete');
    expect(Object.keys(paths['/v1/password-reset-requests'] ?? {})).toContain('post');
    expect(Object.keys(paths['/v1/password-resets'] ?? {})).toContain('post');
    expect(Object.keys(paths['/v1/users/me'] ?? {}).sort()).toEqual(['delete', 'get', 'patch']);
    expect(JSON.stringify(paths['/v1/users/me']?.patch)).toContain('application/merge-patch+json');
  });

  it('never issues a session for a registration response', async () => {
    const app = buildApp();
    apps.push(app);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/registrations',
      headers: { origin: 'http://localhost:5173' },
      payload: {
        name: 'Ana Ficticia',
        email: 'ana.ficticia@example.test',
        password: 'Senha-ficticia-123!',
        acceptTerms: true,
      },
    });

    expect(response.statusCode).not.toBe(404);
    expect(response.headers['set-cookie'] ?? '').not.toContain('__Host-skillmaps-session');
  });

  it('rejects registration passwords outside the existing policy', async () => {
    const app = buildApp();
    apps.push(app);
    const proof = await csrf(app);
    const response = await app.inject({
      method: 'POST',
      url: '/v1/registrations',
      headers: {
        origin: 'http://localhost:5173',
        'x-csrf-token': proof.token,
        cookie: proof.cookie,
      },
      payload: {
        name: 'Ana Ficticia',
        email: 'ana.ficticia@example.test',
        password: 'curta',
        acceptTerms: true,
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
