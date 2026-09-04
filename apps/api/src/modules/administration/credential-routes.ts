import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';

import { HttpProblem } from '../../plugins/problem-details.js';
import {
  AchievementInputSchema,
  AdminCatalogResourceSchema,
  CertificationInputSchema,
  CsrfHeadersSchema,
  ProblemSchema,
  ValidationProblemSchema,
} from './schemas.js';
import type { AdministrationRouteDependencies } from './category-skill-routes.js';
import { auditAdministrationResult, authorizeAdministration } from './route-support.js';

const responses = {
  401: ProblemSchema,
  403: ProblemSchema,
  409: ProblemSchema,
  422: ValidationProblemSchema,
  429: ProblemSchema,
};

export function registerCredentialAdministrationRoutes(
  app: FastifyInstance,
  dependencies: AdministrationRouteDependencies = {},
): void {
  app.post<{
    Body: Static<typeof CertificationInputSchema>;
    Headers: Static<typeof CsrfHeadersSchema>;
  }>(
    '/v1/admin/certifications',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Administration'],
        operationId: 'createCertification',
        security: [{ cookieAuth: [] }],
        headers: CsrfHeadersSchema,
        body: Type.Ref(CertificationInputSchema),
        response: { 201: Type.Ref(AdminCatalogResourceSchema), ...responses },
      },
    },
    async (request, reply) => {
      const eventType = 'catalog.admin.create_certification';
      const actor = await authorizeAdministration(
        request,
        dependencies.audit,
        eventType,
        'certification',
      );
      const result = await auditAdministrationResult(
        () => available(dependencies.repository).createCertification(request.body, actor.id),
        dependencies.audit,
        { eventType, actorId: actor.id, requestId: request.id, resourceType: 'certification' },
      );
      return reply.code(201).send(result);
    },
  );

  app.post<{
    Body: Static<typeof AchievementInputSchema>;
    Headers: Static<typeof CsrfHeadersSchema>;
  }>(
    '/v1/admin/achievements',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Administration'],
        operationId: 'createAchievement',
        security: [{ cookieAuth: [] }],
        headers: CsrfHeadersSchema,
        body: Type.Ref(AchievementInputSchema),
        response: { 201: Type.Ref(AdminCatalogResourceSchema), ...responses },
      },
    },
    async (request, reply) => {
      const eventType = 'catalog.admin.create_achievement';
      const actor = await authorizeAdministration(
        request,
        dependencies.audit,
        eventType,
        'achievement',
      );
      const result = await auditAdministrationResult(
        () => available(dependencies.repository).createAchievement(request.body, actor.id),
        dependencies.audit,
        { eventType, actorId: actor.id, requestId: request.id, resourceType: 'achievement' },
      );
      return reply.code(201).send(result);
    },
  );
}

function available<T>(service: T | undefined): T {
  if (!service)
    throw new HttpProblem({
      status: 503,
      title: 'Service Unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
  return service;
}
