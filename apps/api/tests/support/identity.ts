import type { FastifyInstance, InjectOptions } from 'fastify';

import { buildApp } from '../../src/app.js';
import type { EmailPort, TransactionalEmail } from '../../src/modules/identity/email.js';
import type { ProviderCleanupPort } from '../../src/modules/erasure/worker.js';
import type { OwnedDatabase } from '../../src/plugins/database.js';

export const testOrigin = 'https://app.skill-maps.test';

export class CapturingEmail implements EmailPort {
  readonly messages: TransactionalEmail[] = [];

  async send(message: TransactionalEmail): Promise<void> {
    this.messages.push(message);
  }

  latestToken(): string {
    const text = this.messages.at(-1)?.text ?? '';
    const match = /[?&]token=([^\s]+)/.exec(text);
    if (!match?.[1]) throw new Error('E-mail did not contain a token');
    return decodeURIComponent(match[1]);
  }
}

export function createDatabaseApp(
  database: OwnedDatabase,
  email: EmailPort = new CapturingEmail(),
  providerCleanup?: ProviderCleanupPort,
) {
  return buildApp({
    database,
    email,
    ...(providerCleanup ? { providerCleanup } : {}),
    environment: {
      nodeEnv: 'test',
      host: '127.0.0.1',
      port: 3000,
      webOrigin: testOrigin,
      authSecret: 'fictitious_test_auth_secret_at_least_32_chars',
    },
  });
}

export async function csrf(app: FastifyInstance) {
  const response = await app.inject({ method: 'GET', url: '/v1/security/csrf-token' });
  const setCookie = response.headers['set-cookie'];
  return {
    token: response.json<{ token: string }>().token,
    cookie: (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';', 1)[0] ?? '',
  };
}

export async function mutate(
  app: FastifyInstance,
  proof: Awaited<ReturnType<typeof csrf>>,
  options: InjectOptions,
  sessionCookie?: string,
) {
  return app.inject({
    ...options,
    headers: {
      origin: testOrigin,
      'x-csrf-token': proof.token,
      cookie: [proof.cookie, sessionCookie].filter(Boolean).join('; '),
      ...options.headers,
    },
  });
}

export async function registerVerifyAndLogin(
  app: FastifyInstance,
  email: CapturingEmail,
  proof: Awaited<ReturnType<typeof csrf>>,
  address: string,
  password = 'Senha-ficticia-123!',
) {
  const registration = await mutate(app, proof, {
    method: 'POST',
    url: '/v1/registrations',
    payload: { email: address, password, acceptTerms: true },
  });
  if (registration.statusCode !== 201) throw new Error(`Registration failed: ${registration.body}`);
  const verification = await mutate(app, proof, {
    method: 'POST',
    url: '/v1/email-verifications',
    payload: { token: email.latestToken() },
  });
  if (verification.statusCode !== 204) throw new Error(`Verification failed: ${verification.body}`);
  const login = await mutate(app, proof, {
    method: 'POST',
    url: '/v1/sessions',
    payload: { email: address, password },
  });
  const setCookie = login.headers['set-cookie'];
  return (Array.isArray(setCookie) ? setCookie[0] : setCookie)?.split(';', 1)[0] ?? '';
}
