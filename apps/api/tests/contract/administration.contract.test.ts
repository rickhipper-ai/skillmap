import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';

const apps = [] as ReturnType<typeof buildApp>[];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe('canonical administration contract', () => {
  it('publishes every canonical creation, draft, publication, and lifecycle operation', async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/documentation/json' });
    const paths = response.json<{ paths: Record<string, Record<string, unknown>> }>().paths;

    expect(paths).toMatchObject({
      '/v1/admin/categories': { post: { operationId: 'createCategory' } },
      '/v1/admin/skills': { post: { operationId: 'createSkill' } },
      '/v1/admin/trails': { post: { operationId: 'createTrail' } },
      '/v1/admin/trails/{trailId}': { patch: { operationId: 'updateTrailDraft' } },
      '/v1/admin/trails/{trailId}/publications': { post: { operationId: 'publishTrail' } },
      '/v1/admin/certifications': { post: { operationId: 'createCertification' } },
      '/v1/admin/achievements': { post: { operationId: 'createAchievement' } },
      '/v1/admin/catalog/{resourceType}/{resourceId}': {
        patch: { operationId: 'updateCatalogDraft' },
      },
      '/v1/admin/catalog/{resourceType}/{resourceId}/publications': {
        post: { operationId: 'publishCatalogResource' },
      },
      '/v1/admin/catalog/{resourceType}/{resourceId}/status': {
        patch: { operationId: 'updateCatalogResourceStatus' },
      },
    });
  });

  it('documents closed inputs, bounded criteria and requirements, and protected responses', async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/documentation/json' });
    const document = response.json<{
      components: { schemas: Record<string, Record<string, unknown>> };
      paths: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
    }>();

    for (const name of [
      'CategoryInput',
      'SkillInput',
      'TrailDraftInput',
      'CertificationInput',
      'AchievementInput',
    ]) {
      expect(document.components.schemas[name]).toMatchObject({ additionalProperties: false });
    }
    expect(document.components.schemas.AchievementCriterionParameters).toMatchObject({
      additionalProperties: false,
      required: ['minimum'],
      properties: { minimum: { minimum: 1, maximum: 1000 } },
    });
    expect(document.components.schemas.CertificationRequirementInput).toMatchObject({
      additionalProperties: false,
      required: ['title', 'type', 'targetId', 'required', 'position'],
    });

    for (const path of [
      '/v1/admin/categories',
      '/v1/admin/skills',
      '/v1/admin/trails',
      '/v1/admin/certifications',
      '/v1/admin/achievements',
    ]) {
      expect(document.paths[path]?.post?.responses).toMatchObject({
        401: expect.any(Object),
        403: expect.any(Object),
        422: expect.any(Object),
        429: expect.any(Object),
      });
    }
  });
});
