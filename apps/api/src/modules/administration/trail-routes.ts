import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';

import { HttpProblem } from '../../plugins/problem-details.js';
import {
  AdminCatalogResourceSchema,
  CsrfHeadersSchema,
  ProblemSchema,
  PublicationHeadersSchema,
  PublicationSchema,
  TrailDraftInputSchema,
  TrailParamsSchema,
  ValidationProblemSchema,
} from './schemas.js';
import type { AdministrationRouteDependencies } from './category-skill-routes.js';
import { auditAdministrationResult, authorizeAdministration } from './route-support.js';
import { validateTrailGraph } from './publication-service.js';

const responses = {
  401: ProblemSchema,
  403: ProblemSchema,
  409: ProblemSchema,
  422: ValidationProblemSchema,
  429: ProblemSchema,
};

export function registerTrailRoutes(
  app: FastifyInstance,
  dependencies: AdministrationRouteDependencies = {},
): void {
  app.post<{
    Body: Static<typeof TrailDraftInputSchema>;
    Headers: Static<typeof CsrfHeadersSchema>;
  }>(
    '/v1/admin/trails',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Administration'],
        operationId: 'createTrail',
        security: [{ cookieAuth: [] }],
        headers: CsrfHeadersSchema,
        body: Type.Ref(TrailDraftInputSchema),
        response: { 201: Type.Ref(AdminCatalogResourceSchema), ...responses },
      },
    },
    async (request, reply) => {
      const eventType = 'catalog.admin.create_trail';
      const actor = await authorizeAdministration(request, dependencies.audit, eventType, 'trail');
      if (!request.body.slug) throw validation('/slug', 'required');
      if (request.body.steps) validateTrailGraph(request.body.steps);
      const result = await auditAdministrationResult(
        () => available(dependencies.repository).createTrail(request.body, actor.id),
        dependencies.audit,
        { eventType, actorId: actor.id, requestId: request.id, resourceType: 'trail' },
      );
      return reply.code(201).send(result);
    },
  );

  app.patch<{
    Params: Static<typeof TrailParamsSchema>;
    Headers: Static<typeof CsrfHeadersSchema>;
    Body: Static<typeof TrailDraftInputSchema>;
  }>(
    '/v1/admin/trails/:trailId',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Administration'],
        operationId: 'updateTrailDraft',
        security: [{ cookieAuth: [] }],
        params: TrailParamsSchema,
        headers: CsrfHeadersSchema,
        body: Type.Ref(TrailDraftInputSchema),
        response: { 200: Type.Ref(AdminCatalogResourceSchema), 404: ProblemSchema, ...responses },
      },
    },
    async (request) => {
      const eventType = 'catalog.admin.update_trail_draft';
      const actor = await authorizeAdministration(
        request,
        dependencies.audit,
        eventType,
        'trail',
        request.params.trailId,
      );
      if (request.body.steps) validateTrailGraph(request.body.steps);
      return auditAdministrationResult(
        async () => {
          const result = await available(dependencies.repository).updateTrail(
            request.params.trailId,
            request.body,
            actor.id,
          );
          if (!result)
            throw new HttpProblem({
              status: 404,
              title: 'Not Found',
              code: 'TRAIL_DRAFT_NOT_FOUND',
            });
          return result;
        },
        dependencies.audit,
        {
          eventType,
          actorId: actor.id,
          requestId: request.id,
          resourceType: 'trail',
          resourceId: request.params.trailId,
        },
      );
    },
  );

  app.post<{
    Params: Static<typeof TrailParamsSchema>;
    Headers: Static<typeof PublicationHeadersSchema>;
  }>(
    '/v1/admin/trails/:trailId/publications',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Administration'],
        operationId: 'publishTrail',
        security: [{ cookieAuth: [] }],
        params: TrailParamsSchema,
        headers: PublicationHeadersSchema,
        response: { 201: Type.Ref(PublicationSchema), 404: ProblemSchema, ...responses },
      },
    },
    async (request, reply) => {
      const eventType = 'catalog.admin.publish_trail';
      const actor = await authorizeAdministration(
        request,
        dependencies.audit,
        eventType,
        'trail',
        request.params.trailId,
      );
      const result = await auditAdministrationResult(
        () =>
          available(dependencies.publication).publishTrail(
            request.params.trailId,
            actor.id,
            request.headers['idempotency-key'],
          ),
        dependencies.audit,
        {
          eventType,
          actorId: actor.id,
          requestId: request.id,
          resourceType: 'trail',
          resourceId: request.params.trailId,
        },
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

function validation(path: string, code: string): HttpProblem {
  return new HttpProblem({
    status: 422,
    title: 'Validation failed',
    code: 'CATALOG_VALIDATION_FAILED',
    extensions: { errors: [{ path, code }] },
  });
}
