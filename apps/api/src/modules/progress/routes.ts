import type { Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';

import { requireActiveUser } from '../../plugins/authorization.js';
import { HttpProblem } from '../../plugins/problem-details.js';
import {
  ProblemSchema,
  ProgressCommandResultSchema,
  ProgressCommandSchema,
  ProgressStepParamsSchema,
  ProgressTrailParamsSchema,
  ProgressValidationProblemSchema,
  ProgressWriteHeadersSchema,
  TrailProgressSchema,
} from './schemas.js';
import type { ProgressService } from './service.js';

function available(service: ProgressService | undefined): ProgressService {
  if (!service) {
    throw new HttpProblem({
      status: 503,
      title: 'Service Unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
  }
  return service;
}

export function registerProgressRoutes(app: FastifyInstance, progress?: ProgressService): void {
  app.put<{
    Params: Static<typeof ProgressTrailParamsSchema>;
    Headers: Static<typeof ProgressWriteHeadersSchema>;
  }>(
    '/v1/me/trails/:trailId',
    {
      schema: {
        tags: ['Progress'],
        operationId: 'startTrail',
        security: [{ cookieAuth: [] }],
        params: ProgressTrailParamsSchema,
        headers: ProgressWriteHeadersSchema,
        response: { 200: TrailProgressSchema, 404: ProblemSchema },
      },
    },
    (request) => {
      const user = requireActiveUser(request);
      return available(progress).start(
        user.id,
        request.params.trailId,
        request.headers['idempotency-key'],
      );
    },
  );

  app.get<{ Params: Static<typeof ProgressTrailParamsSchema> }>(
    '/v1/me/trails/:trailId',
    {
      schema: {
        tags: ['Progress'],
        operationId: 'getTrailProgress',
        security: [{ cookieAuth: [] }],
        params: ProgressTrailParamsSchema,
        response: { 200: TrailProgressSchema, 404: ProblemSchema },
      },
    },
    (request) => {
      const user = requireActiveUser(request);
      return available(progress).get(user.id, request.params.trailId);
    },
  );

  app.post<{
    Params: Static<typeof ProgressStepParamsSchema>;
    Headers: Static<typeof ProgressWriteHeadersSchema>;
    Body: Static<typeof ProgressCommandSchema>;
  }>(
    '/v1/me/trails/:trailId/steps/:stepId/events',
    {
      schema: {
        tags: ['Progress'],
        operationId: 'appendProgressEvent',
        security: [{ cookieAuth: [] }],
        params: ProgressStepParamsSchema,
        headers: ProgressWriteHeadersSchema,
        body: ProgressCommandSchema,
        response: {
          201: ProgressCommandResultSchema,
          409: ProblemSchema,
          422: ProgressValidationProblemSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await available(progress).append(
        requireActiveUser(request).id,
        request.params.trailId,
        request.params.stepId,
        request.headers['idempotency-key'],
        request.body,
      );
      return reply.code(201).send(result);
    },
  );
}
