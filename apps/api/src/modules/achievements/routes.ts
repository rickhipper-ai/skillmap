import type { FastifyInstance } from 'fastify';

import { requireActiveUser } from '../../plugins/authorization.js';
import { HttpProblem } from '../../plugins/problem-details.js';
import { AchievementAwardSchema, ProblemSchema } from '../credentials/schemas.js';
import type { AchievementService } from './service.js';

function available(service: AchievementService | undefined): AchievementService {
  if (!service) {
    throw new HttpProblem({
      status: 503,
      title: 'Service Unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
  }
  return service;
}

export function registerAchievementRoutes(
  app: FastifyInstance,
  achievements?: AchievementService,
): void {
  app.get(
    '/v1/me/achievements',
    {
      schema: {
        tags: ['Credentials'],
        operationId: 'listAchievements',
        security: [{ cookieAuth: [] }],
        response: { 200: { type: 'array', items: AchievementAwardSchema }, 401: ProblemSchema },
      },
    },
    (request) => {
      const user = requireActiveUser(request);
      return available(achievements).list(user.id);
    },
  );
}
