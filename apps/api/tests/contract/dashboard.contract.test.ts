import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';

const apps = [] as ReturnType<typeof buildApp>[];

interface DashboardSchemaDocument {
  required: string[];
  properties: {
    activeTrails: { items: { required: string[] } };
    recommendations: { maxItems: number; items: { required: string[] } };
  };
}

interface OpenApiDocument {
  paths: Record<
    string,
    {
      get?: {
        operationId: string;
        security: Array<Record<string, never[]>>;
        responses: Record<
          number,
          { content: { 'application/json': { schema: DashboardSchemaDocument } } }
        >;
      };
    }
  >;
}

afterEach(async () => Promise.all(apps.splice(0).map((app) => app.close())));

describe('canonical dashboard contract', () => {
  it('publishes the sole authenticated dashboard endpoint with faithful summaries and evidence', async () => {
    const app = buildApp();
    apps.push(app);
    const response = await app.inject({ method: 'GET', url: '/documentation/json' });
    const paths = response.json<OpenApiDocument>().paths;

    expect(paths['/v1/me/dashboard']).toMatchObject({
      get: {
        operationId: 'getDashboard',
        security: [{ cookieAuth: [] }],
        responses: { 200: expect.any(Object), 401: expect.any(Object) },
      },
    });
    expect(Object.keys(paths).filter((path) => /dashboard|recommendation/.test(path))).toEqual([
      '/v1/me/dashboard',
    ]);

    const dashboardOperation = paths['/v1/me/dashboard']?.get;
    expect(dashboardOperation).toBeDefined();
    const dashboard = dashboardOperation!.responses[200]!.content['application/json'].schema;
    expect(dashboard.required).toEqual(
      expect.arrayContaining([
        'activeTrails',
        'certificationRecords',
        'achievements',
        'recommendations',
      ]),
    );
    expect(dashboard.properties.activeTrails.items.required).toEqual(
      expect.arrayContaining([
        'trailId',
        'title',
        'currentRevisionId',
        'percentage',
        'streamVersion',
        'lastActivityAt',
      ]),
    );
    expect(dashboard.properties.recommendations.maxItems).toBe(3);
    expect(dashboard.properties.recommendations.items.required).toEqual(
      expect.arrayContaining([
        'id',
        'rank',
        'targetType',
        'trailId',
        'title',
        'reasonCode',
        'evidence',
        'explanation',
        'inputVersions',
      ]),
    );
  });

  it('rejects anonymous reads before dashboard data is accessed', async () => {
    const app = buildApp();
    apps.push(app);
    expect((await app.inject({ method: 'GET', url: '/v1/me/dashboard' })).statusCode).toBe(401);
  });
});
