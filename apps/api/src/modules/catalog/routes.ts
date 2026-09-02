import type { Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';

import { HttpProblem } from '../../plugins/problem-details.js';
import type { CertificationQueryService } from './certification-query-service.js';
import {
  CatalogPageSchema,
  CatalogSearchQuerySchema,
  CategorySchema,
  CertificationDetailSchema,
  CertificationIdParamsSchema,
  ProblemSchema,
  SkillDetailSchema,
  SkillIdParamsSchema,
  TrailDetailSchema,
  TrailIdParamsSchema,
  ValidationProblemSchema,
} from './schemas.js';
import type { CatalogSearchService } from './search-service.js';
import type { TrailQueryService } from './trail-query-service.js';

interface CatalogRouteServices {
  search?: CatalogSearchService | undefined;
  trails?: TrailQueryService | undefined;
  certifications?: CertificationQueryService | undefined;
}

function available<T>(service: T | undefined): T {
  if (!service) {
    throw new HttpProblem({
      status: 503,
      title: 'Service Unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
  }
  return service;
}

function found<T>(value: T | null): T {
  if (!value) {
    throw new HttpProblem({ status: 404, title: 'Not Found', code: 'CATALOG_ITEM_NOT_FOUND' });
  }
  return value;
}

export function registerCatalogRoutes(
  app: FastifyInstance,
  services: CatalogRouteServices = {},
): void {
  app.get<{ Querystring: Static<typeof CatalogSearchQuerySchema> }>(
    '/v1/catalog',
    {
      schema: {
        tags: ['Catalog'],
        operationId: 'searchCatalog',
        querystring: CatalogSearchQuerySchema,
        response: { 200: CatalogPageSchema, 422: ValidationProblemSchema },
      },
    },
    (request) => available(services.search).search(request.query),
  );

  app.get(
    '/v1/categories',
    {
      config: { rateLimit: { max: 120, timeWindow: '1 minute' } },
      schema: {
        tags: ['Catalog'],
        operationId: 'listCategories',
        response: {
          200: { type: 'array', items: CategorySchema },
          429: ProblemSchema,
        },
      },
    },
    () => available(services.search).listCategories(),
  );

  app.get<{ Params: Static<typeof SkillIdParamsSchema> }>(
    '/v1/skills/:skillId',
    {
      schema: {
        tags: ['Catalog'],
        operationId: 'getSkill',
        params: SkillIdParamsSchema,
        response: { 200: SkillDetailSchema, 404: ProblemSchema },
      },
    },
    async (request) => found(await available(services.trails).getSkill(request.params.skillId)),
  );

  app.get<{ Params: Static<typeof TrailIdParamsSchema> }>(
    '/v1/trails/:trailId',
    {
      schema: {
        tags: ['Catalog'],
        operationId: 'getTrail',
        params: TrailIdParamsSchema,
        response: { 200: TrailDetailSchema, 404: ProblemSchema },
      },
    },
    async (request) => found(await available(services.trails).getTrail(request.params.trailId)),
  );

  app.get<{ Params: Static<typeof CertificationIdParamsSchema> }>(
    '/v1/certifications/:certificationId',
    {
      schema: {
        tags: ['Catalog'],
        operationId: 'getCertification',
        params: CertificationIdParamsSchema,
        response: { 200: CertificationDetailSchema, 404: ProblemSchema },
      },
    },
    async (request) =>
      found(await available(services.certifications).get(request.params.certificationId)),
  );
}
