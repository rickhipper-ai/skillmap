import type { FastifyInstance } from 'fastify';

import { requireActiveUser } from '../../plugins/authorization.js';
import { HttpProblem } from '../../plugins/problem-details.js';
import { CsrfHeadersSchema, CurrentUserSchema, ProfileInputSchema } from '../identity/schemas.js';
import type { ProfileService, ProfilePatch } from './service.js';

function serviceOrUnavailable(service: ProfileService | undefined): ProfileService {
  if (!service) {
    throw new HttpProblem({
      status: 503,
      title: 'Service Unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
  }
  return service;
}

export function registerProfileRoutes(app: FastifyInstance, profiles?: ProfileService): void {
  app.addContentTypeParser(
    'application/merge-patch+json',
    { parseAs: 'string' },
    app.getDefaultJsonParser('ignore', 'ignore'),
  );

  app.get(
    '/v1/users/me',
    {
      schema: {
        tags: ['Identity'],
        operationId: 'getCurrentUser',
        security: [{ cookieAuth: [] }],
        response: { 200: CurrentUserSchema },
      },
    },
    async (request) => {
      const user = requireActiveUser(request);
      return {
        id: user.id,
        status: 'active' as const,
        roles: [...user.roles],
        profile: await serviceOrUnavailable(profiles).get(user.id),
      };
    },
  );

  app.patch<{ Body: ProfilePatch }>(
    '/v1/users/me',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      schema: {
        tags: ['Identity'],
        operationId: 'updateCurrentUserProfile',
        headers: CsrfHeadersSchema,
        security: [{ cookieAuth: [] }],
        consumes: ['application/merge-patch+json'],
        body: ProfileInputSchema,
        response: { 200: CurrentUserSchema },
      },
    },
    async (request) => {
      const user = requireActiveUser(request);
      const profile = await serviceOrUnavailable(profiles).update(user.id, request.body);
      return { id: user.id, status: 'active' as const, roles: [...user.roles], profile };
    },
  );
}
