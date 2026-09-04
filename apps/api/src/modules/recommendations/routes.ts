import type { FastifyInstance } from 'fastify';

import { requireActiveUser } from '../../plugins/authorization.js';
import { HttpProblem } from '../../plugins/problem-details.js';
import { DashboardSchema, ProblemSchema } from './schemas.js';
import type { DashboardService } from './dashboard-service.js';

function available(service: DashboardService | undefined): DashboardService {
  if (!service) {
    throw new HttpProblem({
      status: 503,
      title: 'Service Unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
  }
  return service;
}

export function registerRecommendationRoutes(
  app: FastifyInstance,
  dashboard?: DashboardService,
): void {
  app.get(
    '/v1/me/dashboard',
    {
      schema: {
        tags: ['Dashboard'],
        operationId: 'getDashboard',
        security: [{ cookieAuth: [] }],
        response: { 200: DashboardSchema, 401: ProblemSchema },
      },
    },
    (request) => {
      const user = requireActiveUser(request);
      return available(dashboard).get(user.id);
    },
  );
}
