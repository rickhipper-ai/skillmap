import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';

const apps = [] as ReturnType<typeof buildApp>[];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('canonical public catalog contract', () => {
  it('publishes search, categories, skill, trail, and certification reads', async () => {
    const app = buildApp();
    apps.push(app);

    const document = await app.inject({ method: 'GET', url: '/documentation/json' });
    const paths = document.json<{ paths: Record<string, Record<string, unknown>> }>().paths;

    expect(Object.keys(paths['/v1/catalog'] ?? {})).toContain('get');
    expect(Object.keys(paths['/v1/categories'] ?? {})).toContain('get');
    expect(Object.keys(paths['/v1/skills/{skillId}'] ?? {})).toContain('get');
    expect(Object.keys(paths['/v1/trails/{trailId}'] ?? {})).toContain('get');
    expect(Object.keys(paths['/v1/certifications/{certificationId}'] ?? {})).toContain('get');
    expect(paths['/v1/catalog']?.get).toMatchObject({
      operationId: 'searchCatalog',
      responses: { 200: expect.any(Object), 422: expect.any(Object) },
    });
    expect(paths['/v1/skills/{skillId}']?.get).toMatchObject({
      operationId: 'getSkill',
      responses: { 200: expect.any(Object), 404: expect.any(Object) },
    });
  });

  it('validates canonical catalog query parameters without requiring authentication', async () => {
    const app = buildApp();
    apps.push(app);

    const invalidType = await app.inject({ method: 'GET', url: '/v1/catalog?type=course' });
    const invalidCategory = await app.inject({
      method: 'GET',
      url: '/v1/catalog?categoryId=not-a-uuid',
    });
    const anonymousDetail = await app.inject({
      method: 'GET',
      url: '/v1/skills/00000000-0000-4000-8000-000000000001',
    });

    expect(invalidType.statusCode).toBe(422);
    expect(invalidCategory.statusCode).toBe(422);
    expect(anonymousDetail.statusCode).not.toBe(401);
    expect(anonymousDetail.statusCode).not.toBe(404);
  });
});
