import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';

const apps = [] as ReturnType<typeof buildApp>[];
const certificationId = '50000000-0000-4000-8000-000000000001';

afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe('canonical credentials contract', () => {
  it('publishes certification create/list and achievement list with canonical schemas', async () => {
    const app = buildApp();
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/documentation/json' });
    const paths = response.json<{ paths: Record<string, Record<string, unknown>> }>().paths;

    expect(paths['/v1/me/certification-records']).toMatchObject({
      get: { operationId: 'listCertificationRecords', responses: { 200: expect.any(Object) } },
      post: {
        operationId: 'createCertificationRecord',
        responses: { 201: expect.any(Object), 409: expect.any(Object), 422: expect.any(Object) },
      },
    });
    expect(paths['/v1/me/achievements']).toMatchObject({
      get: { operationId: 'listAchievements', responses: { 200: expect.any(Object) } },
    });

    const post = paths['/v1/me/certification-records']?.post as {
      requestBody?: {
        content?: {
          'application/json'?: {
            schema?: { required?: string[]; properties?: Record<string, unknown> };
          };
        };
      };
    };
    const body = post.requestBody?.content?.['application/json']?.schema;
    expect(body?.required).toEqual(['certificationId', 'obtainedOn']);
    expect(body?.properties).toHaveProperty('externalIdentifier');
    expect(body?.properties).toHaveProperty('expiresOn');
  });

  it('requires authentication, CSRF, and UUID idempotency at the HTTP boundary', async () => {
    const app = buildApp();
    apps.push(app);

    expect(
      (await app.inject({ method: 'GET', url: '/v1/me/certification-records' })).statusCode,
    ).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/v1/me/achievements' })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/v1/me/certification-records',
          payload: { certificationId, obtainedOn: '2026-09-03' },
        })
      ).statusCode,
    ).toBe(403);

    const invalid = await app.inject({
      method: 'POST',
      url: '/v1/me/certification-records',
      headers: {
        origin: 'http://localhost:5173',
        'x-csrf-token': 'x'.repeat(32),
        cookie: `__Host-skillmaps-csrf=${'x'.repeat(32)}`,
        'idempotency-key': 'not-a-uuid',
      },
      payload: { certificationId: 'not-a-uuid', obtainedOn: 'not-a-date' },
    });
    expect(invalid.statusCode).toBe(422);
  });
});
