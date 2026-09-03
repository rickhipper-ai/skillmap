import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';

const apps = [] as ReturnType<typeof buildApp>[];
const uuid = '40000000-0000-4000-8000-000000000001';

afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe('canonical progress contract', () => {
  it('publishes only the canonical start, read, and event operations', async () => {
    const app = buildApp();
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/documentation/json' });
    const paths = response.json<{ paths: Record<string, Record<string, unknown>> }>().paths;

    expect(paths['/v1/me/trails/{trailId}']).toMatchObject({
      put: { operationId: 'startTrail' },
      get: { operationId: 'getTrailProgress' },
    });
    expect(paths['/v1/me/trails/{trailId}/steps/{stepId}/events']).toMatchObject({
      post: {
        operationId: 'appendProgressEvent',
        responses: { 201: expect.any(Object), 409: expect.any(Object), 422: expect.any(Object) },
      },
    });

    const progressSchema = paths['/v1/me/trails/{trailId}']?.get as {
      responses?: {
        200?: {
          content?: {
            'application/json'?: {
              schema?: {
                properties?: {
                  history?: {
                    items?: { required?: string[]; properties?: Record<string, unknown> };
                  };
                };
              };
            };
          };
        };
      };
    };
    const historySchema =
      progressSchema.responses?.[200]?.content?.['application/json']?.schema?.properties?.history
        ?.items;
    expect(historySchema?.required).toContain('observedRevisionId');
    expect(historySchema?.properties).toHaveProperty('supersedesEventId');
  });

  it('requires authentication, CSRF and UUID idempotency for protected writes', async () => {
    const app = buildApp();
    apps.push(app);

    expect((await app.inject({ method: 'GET', url: `/v1/me/trails/${uuid}` })).statusCode).toBe(
      401,
    );
    expect((await app.inject({ method: 'PUT', url: `/v1/me/trails/${uuid}` })).statusCode).toBe(
      403,
    );
    const invalid = await app.inject({
      method: 'POST',
      url: `/v1/me/trails/${uuid}/steps/${uuid}/events`,
      headers: {
        origin: 'http://localhost:5173',
        'x-csrf-token': 'x'.repeat(32),
        cookie: `__Host-skillmaps-csrf=${'x'.repeat(32)}`,
        'idempotency-key': 'not-a-uuid',
      },
      payload: { state: 'invalid', baseStreamVersion: -1 },
    });
    expect(invalid.statusCode).toBe(422);
  });
});
