import type { FastifyInstance, FastifyRequest } from 'fastify';

import { requireActiveUser } from '../../plugins/authorization.js';
import { HttpProblem } from '../../plugins/problem-details.js';
import type { ErasureService } from '../erasure/service.js';
import type { ProfileService } from '../profiles/service.js';
import type { LiveSession } from './repository.js';
import {
  CurrentUserSchema,
  CsrfHeadersSchema,
  DeleteAccountSchema,
  DeletionReceiptSchema,
  EmailRequestSchema,
  PasswordResetSchema,
  RegistrationResultSchema,
  RegistrationSchema,
  SessionSchema,
  TokenSchema,
} from './schemas.js';
import type { IdentityService } from './service.js';

const sessionCookieName = '__Host-skillmaps-session';

declare module 'fastify' {
  interface FastifyRequest {
    currentSession: LiveSession | null;
  }
}

export function sessionCookie(token: string): string {
  return `${sessionCookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function expiredSessionCookie(): string {
  return `${sessionCookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

function identityOrUnavailable(identity: IdentityService | undefined): IdentityService {
  if (!identity) {
    throw new HttpProblem({
      status: 503,
      title: 'Service Unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
  }
  return identity;
}

function currentSession(request: FastifyRequest): LiveSession {
  requireActiveUser(request);
  if (!request.currentSession) {
    throw new HttpProblem({ status: 401, title: 'Unauthorized', code: 'AUTHENTICATION_REQUIRED' });
  }
  return request.currentSession;
}

export function registerIdentityRoutes(
  app: FastifyInstance,
  dependencies: {
    identity?: IdentityService | undefined;
    profiles?: ProfileService | undefined;
    erasure?: ErasureService | undefined;
  } = {},
): void {
  app.decorateRequest('currentSession', null);
  app.addHook('onRequest', async (request) => {
    request.currentUser = null;
    request.currentSession = null;
    const token = request.cookies[sessionCookieName];
    if (!token || !dependencies.identity) return;
    const session = await dependencies.identity.findLiveSession(token);
    if (!session) return;
    request.currentSession = session;
    request.currentUser = { id: session.userId, status: session.status, roles: session.roles };
  });

  app.post<{ Body: { name: string; email: string; password: string; acceptTerms: true } }>(
    '/v1/registrations',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      schema: {
        tags: ['Identity'],
        operationId: 'registerUser',
        headers: CsrfHeadersSchema,
        body: RegistrationSchema,
        response: { 201: RegistrationResultSchema },
      },
    },
    async (request, reply) => {
      const result = await identityOrUnavailable(dependencies.identity).register(request.body);
      return reply.code(201).send(result);
    },
  );

  app.post<{ Body: { email: string } }>(
    '/v1/email-verification-requests',
    {
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
      schema: {
        tags: ['Identity'],
        operationId: 'requestEmailVerification',
        headers: CsrfHeadersSchema,
        body: EmailRequestSchema,
      },
    },
    async (request, reply) => {
      await identityOrUnavailable(dependencies.identity).requestVerification(request.body.email);
      return reply.code(202).send();
    },
  );

  app.post<{ Body: { token: string } }>(
    '/v1/email-verifications',
    {
      config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
      schema: {
        tags: ['Identity'],
        operationId: 'verifyEmail',
        headers: CsrfHeadersSchema,
        body: TokenSchema,
      },
    },
    async (request, reply) => {
      await identityOrUnavailable(dependencies.identity).verifyEmail(request.body.token);
      return reply.code(204).send();
    },
  );

  app.post<{ Body: { email: string; password: string } }>(
    '/v1/sessions',
    {
      config: { rateLimit: { max: 8, timeWindow: '15 minutes' } },
      schema: {
        tags: ['Identity'],
        operationId: 'createSession',
        headers: CsrfHeadersSchema,
        body: SessionSchema,
        response: { 201: CurrentUserSchema },
      },
    },
    async (request, reply) => {
      const session = await identityOrUnavailable(dependencies.identity).login(
        request.body.email,
        request.body.password,
      );
      const profile = dependencies.profiles
        ? await dependencies.profiles.get(session.userId)
        : null;
      reply.header('set-cookie', session.cookie);
      return reply.code(201).send({
        id: session.userId,
        status: 'active',
        roles: session.roles,
        profile,
      });
    },
  );

  app.delete(
    '/v1/sessions/current',
    {
      schema: {
        tags: ['Identity'],
        operationId: 'deleteCurrentSession',
        headers: CsrfHeadersSchema,
        security: [{ cookieAuth: [] }],
      },
    },
    async (request, reply) => {
      const session = currentSession(request);
      await identityOrUnavailable(dependencies.identity).logout(session.token);
      reply.header('set-cookie', expiredSessionCookie());
      return reply.code(204).send();
    },
  );

  app.post<{ Body: { email: string } }>(
    '/v1/password-reset-requests',
    {
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
      schema: {
        tags: ['Identity'],
        operationId: 'requestPasswordReset',
        headers: CsrfHeadersSchema,
        body: EmailRequestSchema,
      },
    },
    async (request, reply) => {
      await identityOrUnavailable(dependencies.identity).requestPasswordReset(request.body.email);
      return reply.code(202).send();
    },
  );

  app.post<{ Body: { token: string; newPassword: string } }>(
    '/v1/password-resets',
    {
      config: { rateLimit: { max: 8, timeWindow: '15 minutes' } },
      schema: {
        tags: ['Identity'],
        operationId: 'resetPassword',
        headers: CsrfHeadersSchema,
        body: PasswordResetSchema,
      },
    },
    async (request, reply) => {
      await identityOrUnavailable(dependencies.identity).resetPassword(
        request.body.token,
        request.body.newPassword,
      );
      reply.header('set-cookie', expiredSessionCookie());
      return reply.code(204).send();
    },
  );

  app.delete<{ Body: { password: string } }>(
    '/v1/users/me',
    {
      config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
      schema: {
        tags: ['Identity'],
        operationId: 'requestCurrentUserDeletion',
        headers: CsrfHeadersSchema,
        security: [{ cookieAuth: [] }],
        body: DeleteAccountSchema,
        response: { 202: DeletionReceiptSchema },
      },
    },
    async (request, reply) => {
      if (!dependencies.erasure) {
        throw new HttpProblem({
          status: 503,
          title: 'Service Unavailable',
          code: 'SERVICE_UNAVAILABLE',
        });
      }
      const receipt = await dependencies.erasure.request(
        currentSession(request),
        request.body.password,
      );
      reply.header('set-cookie', expiredSessionCookie());
      return reply.code(202).send(receipt);
    },
  );
}
