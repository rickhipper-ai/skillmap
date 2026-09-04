import swagger from '@fastify/swagger';
import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';

export const HealthSchema = Type.Object({ status: Type.String() }, { additionalProperties: false });

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    refResolver: {
      buildLocalReference(json, _baseUri, _fragment, index) {
        return typeof json.$id === 'string' ? json.$id : `def-${index}`;
      },
    },
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'SKILL MAPS API',
        description: 'API do mapa de aprendizagem e desenvolvimento profissional.',
        version: '1.0.0',
      },
      servers: [{ url: '/api' }],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: '__Host-skillmaps-session',
          },
        },
      },
    },
  });

  app.get('/documentation/json', { schema: { hide: true } }, async () => app.swagger());
}
