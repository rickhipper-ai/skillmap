import { Type } from '@sinclair/typebox';
import { afterEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app.js';

const apps = [] as ReturnType<typeof buildApp>[];
const webOrigin = 'https://app.skill-maps.test';

function createApp() {
  const app = buildApp({
    environment: {
      nodeEnv: 'test',
      host: '127.0.0.1',
      port: 3000,
      webOrigin,
    },
  });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.splice(0).map(async (app) => app.close()));
});

describe('API foundation', () => {
  it('exposes detail-free liveness and readiness responses', async () => {
    const app = createApp();

    const live = await app.inject({ method: 'GET', url: '/health/live' });
    const ready = await app.inject({ method: 'GET', url: '/health/ready' });

    expect(live.statusCode).toBe(200);
    expect(live.json()).toEqual({ status: 'ok' });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: 'ready' });
  });

  it('translates unexpected and validation errors to RFC 9457', async () => {
    const app = createApp();
    app.get('/__test/error', async () => {
      throw new Error('database password must never escape');
    });
    app.post(
      '/__test/validation',
      { schema: { body: Type.Object({ name: Type.String({ minLength: 2 }) }) } },
      async () => ({ ok: true }),
    );

    const unexpected = await app.inject({ method: 'GET', url: '/__test/error' });
    const tokenResponse = await app.inject({
      method: 'GET',
      url: '/v1/security/csrf-token',
      headers: { origin: webOrigin },
    });
    const token = tokenResponse.json<{ token: string }>().token;
    const setCookie = tokenResponse.headers['set-cookie'];
    const cookie = (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';', 1)[0];
    const validation = await app.inject({
      method: 'POST',
      url: '/__test/validation',
      headers: {
        cookie,
        origin: webOrigin,
        'x-csrf-token': token,
      },
      payload: { name: '' },
    });

    expect(unexpected.statusCode).toBe(500);
    expect(unexpected.headers['content-type']).toContain('application/problem+json');
    expect(unexpected.body).not.toContain('database password');
    expect(unexpected.json()).toMatchObject({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    });
    expect(validation.statusCode).toBe(422);
    expect(validation.json()).toMatchObject({ status: 422, title: 'Validation failed' });
    expect(validation.json<{ errors: unknown[] }>().errors.length).toBeGreaterThan(0);
  });

  it('exposes generated OpenAPI 3.1 documentation', async () => {
    const response = await createApp().inject({ method: 'GET', url: '/documentation/json' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      openapi: '3.1.0',
      info: { title: 'SKILL MAPS API' },
    });
  });

  it('allows only the configured exact CORS origin', async () => {
    const app = createApp();
    const allowed = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { origin: webOrigin },
    });
    const denied = await app.inject({
      method: 'GET',
      url: '/health/live',
      headers: { origin: 'https://evil.example' },
    });

    expect(allowed.headers['access-control-allow-origin']).toBe(webOrigin);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rejects state changes without a valid same-origin CSRF token', async () => {
    const response = await createApp().inject({
      method: 'POST',
      url: '/__test/mutation',
      headers: { origin: webOrigin },
    });

    expect(response.statusCode).toBe(403);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });
});
