import { Type, type Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';

import type { AuditService } from '../audit/service.js';
import { HttpProblem } from '../../plugins/problem-details.js';
import type { AdministrationRepository } from './repository.js';
import type { LifecycleService } from './lifecycle-service.js';
import type { PublicationService } from './publication-service.js';
import {
  AdminCatalogResourceSchema,
  CatalogDraftInputSchema,
  CategoryInputSchema,
  CsrfHeadersSchema,
  ProblemSchema,
  PublicationHeadersSchema,
  PublicationSchema,
  ResourceParamsSchema,
  SkillInputSchema,
  StatusInputSchema,
  ValidationProblemSchema,
  type ResourceType,
} from './schemas.js';
import { auditAdministrationResult, authorizeAdministration } from './route-support.js';

export interface AdministrationRouteDependencies {
  repository?: AdministrationRepository | undefined;
  publication?: PublicationService | undefined;
  lifecycle?: LifecycleService | undefined;
  audit?: AuditService | undefined;
}

const responses = {
  401: ProblemSchema,
  403: ProblemSchema,
  409: ProblemSchema,
  422: ValidationProblemSchema,
  429: ProblemSchema,
};

export function registerCategorySkillRoutes(
  app: FastifyInstance,
  dependencies: AdministrationRouteDependencies = {},
): void {
  app.post<{ Body: Static<typeof CategoryInputSchema>; Headers: Static<typeof CsrfHeadersSchema> }>(
    '/v1/admin/categories',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Administration'],
        operationId: 'createCategory',
        security: [{ cookieAuth: [] }],
        headers: CsrfHeadersSchema,
        body: Type.Ref(CategoryInputSchema),
        response: { 201: Type.Ref(AdminCatalogResourceSchema), ...responses },
      },
    },
    async (request, reply) => {
      const eventType = 'catalog.admin.create_category';
      const actor = await authorizeAdministration(
        request,
        dependencies.audit,
        eventType,
        'category',
      );
      const result = await auditAdministrationResult(
        () => available(dependencies.repository).createCategory(request.body, actor.id),
        dependencies.audit,
        { eventType, actorId: actor.id, requestId: request.id, resourceType: 'category' },
      );
      return reply.code(201).send(result);
    },
  );

  app.post<{ Body: Static<typeof SkillInputSchema>; Headers: Static<typeof CsrfHeadersSchema> }>(
    '/v1/admin/skills',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Administration'],
        operationId: 'createSkill',
        security: [{ cookieAuth: [] }],
        headers: CsrfHeadersSchema,
        body: Type.Ref(SkillInputSchema),
        response: { 201: Type.Ref(AdminCatalogResourceSchema), ...responses },
      },
    },
    async (request, reply) => {
      const eventType = 'catalog.admin.create_skill';
      const actor = await authorizeAdministration(request, dependencies.audit, eventType, 'skill');
      const result = await auditAdministrationResult(
        () => available(dependencies.repository).createSkill(request.body, actor.id),
        dependencies.audit,
        { eventType, actorId: actor.id, requestId: request.id, resourceType: 'skill' },
      );
      return reply.code(201).send(result);
    },
  );

  app.patch<{
    Params: Static<typeof ResourceParamsSchema>;
    Headers: Static<typeof CsrfHeadersSchema>;
    Body: Static<typeof CatalogDraftInputSchema>;
  }>(
    '/v1/admin/catalog/:resourceType/:resourceId',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Administration'],
        operationId: 'updateCatalogDraft',
        security: [{ cookieAuth: [] }],
        params: ResourceParamsSchema,
        headers: CsrfHeadersSchema,
        body: Type.Ref(CatalogDraftInputSchema),
        response: { 200: Type.Ref(AdminCatalogResourceSchema), 404: ProblemSchema, ...responses },
      },
    },
    async (request) => {
      const { resourceType, resourceId } = request.params;
      if (resourceType === 'trail') throw notFound();
      validatePatch(resourceType, request.body);
      const eventType = 'catalog.admin.update_draft';
      const actor = await authorizeAdministration(
        request,
        dependencies.audit,
        eventType,
        resourceType,
        resourceId,
      );
      return auditAdministrationResult(
        async () => {
          const result = await available(dependencies.repository).updateCatalogDraft(
            resourceType,
            resourceId,
            request.body,
            actor.id,
          );
          if (!result) throw notFound();
          return result;
        },
        dependencies.audit,
        {
          eventType,
          actorId: actor.id,
          requestId: request.id,
          resourceType,
          resourceId,
        },
      );
    },
  );

  app.post<{
    Params: Static<typeof ResourceParamsSchema>;
    Headers: Static<typeof PublicationHeadersSchema>;
  }>(
    '/v1/admin/catalog/:resourceType/:resourceId/publications',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Administration'],
        operationId: 'publishCatalogResource',
        security: [{ cookieAuth: [] }],
        params: ResourceParamsSchema,
        headers: PublicationHeadersSchema,
        response: { 201: Type.Ref(PublicationSchema), 404: ProblemSchema, ...responses },
      },
    },
    async (request, reply) => {
      const { resourceType, resourceId } = request.params;
      if (resourceType === 'trail') throw notFound();
      const eventType = 'catalog.admin.publish';
      const actor = await authorizeAdministration(
        request,
        dependencies.audit,
        eventType,
        resourceType,
        resourceId,
      );
      const result = await auditAdministrationResult(
        () =>
          available(dependencies.publication).publishCatalogResource(
            resourceType,
            resourceId,
            actor.id,
            request.headers['idempotency-key'],
          ),
        dependencies.audit,
        { eventType, actorId: actor.id, requestId: request.id, resourceType, resourceId },
      );
      return reply.code(201).send(result);
    },
  );

  app.patch<{
    Params: Static<typeof ResourceParamsSchema>;
    Headers: Static<typeof CsrfHeadersSchema>;
    Body: Static<typeof StatusInputSchema>;
  }>(
    '/v1/admin/catalog/:resourceType/:resourceId/status',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      schema: {
        tags: ['Administration'],
        operationId: 'updateCatalogResourceStatus',
        security: [{ cookieAuth: [] }],
        params: ResourceParamsSchema,
        headers: CsrfHeadersSchema,
        body: StatusInputSchema,
        response: { 200: Type.Ref(AdminCatalogResourceSchema), 404: ProblemSchema, ...responses },
      },
    },
    async (request) => {
      const { resourceType, resourceId } = request.params;
      const eventType = `catalog.admin.${request.body.status}`;
      const actor = await authorizeAdministration(
        request,
        dependencies.audit,
        eventType,
        resourceType,
        resourceId,
      );
      return auditAdministrationResult(
        () =>
          available(dependencies.lifecycle).updateStatus(
            resourceType,
            resourceId,
            request.body.status,
          ),
        dependencies.audit,
        { eventType, actorId: actor.id, requestId: request.id, resourceType, resourceId },
      );
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

function notFound(): HttpProblem {
  return new HttpProblem({ status: 404, title: 'Not Found', code: 'CATALOG_RESOURCE_NOT_FOUND' });
}

function validatePatch(type: Exclude<ResourceType, 'trail'>, body: Record<string, unknown>): void {
  const allowed: Record<Exclude<ResourceType, 'trail'>, ReadonlySet<string>> = {
    category: new Set(['slug', 'name', 'description']),
    skill: new Set(['slug', 'categoryId', 'name', 'description']),
    certification: new Set([
      'slug',
      'name',
      'issuer',
      'description',
      'defaultValidityMonths',
      'skillIds',
      'trailIds',
      'requirements',
    ]),
    achievement: new Set([
      'slug',
      'title',
      'description',
      'iconLabel',
      'criterionType',
      'criterionParameters',
    ]),
  };
  const invalid = Object.keys(body).find((key) => !allowed[type].has(key));
  const descriptionLimit = type === 'skill' ? 4000 : type === 'certification' ? 8000 : 2000;
  if (
    invalid ||
    (typeof body.description === 'string' && body.description.length > descriptionLimit) ||
    (type === 'category' && typeof body.name === 'string' && body.name.length > 160)
  ) {
    throw new HttpProblem({
      status: 422,
      title: 'Validation failed',
      code: 'CATALOG_VALIDATION_FAILED',
      extensions: { errors: [{ path: invalid ? `/${invalid}` : '/', code: 'invalid_field' }] },
    });
  }
}
