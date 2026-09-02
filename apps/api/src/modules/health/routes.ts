import type { FastifyInstance } from 'fastify';

import { HealthSchema } from '../../plugins/openapi.js';

interface HealthOptions {
  ready?: () => Promise<boolean>;
}

export function registerHealthRoutes(app: FastifyInstance, options: HealthOptions = {}): void {
  app.get('/health/live', { schema: { response: { 200: HealthSchema } } }, async () => ({
    status: 'ok',
  }));
  app.get(
    '/health/ready',
    { schema: { response: { 200: HealthSchema, 503: HealthSchema } } },
    async (_request, reply) => {
      const ready = options.ready ? await options.ready() : true;
      if (!ready) reply.status(503);
      return { status: ready ? 'ready' : 'unavailable' };
    },
  );
}
