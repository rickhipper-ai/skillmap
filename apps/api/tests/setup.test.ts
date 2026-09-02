import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';

const apps = [] as ReturnType<typeof buildApp>[];

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('API workspace', () => {
  it('runs a placeholder Fastify application', async () => {
    const app = buildApp();
    apps.push(app);

    const response = await app.inject({ method: 'GET', url: '/' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ name: 'SKILL MAPS API', status: 'setup' });
  });
});
