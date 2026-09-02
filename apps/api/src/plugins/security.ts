import { randomBytes, timingSafeEqual } from 'node:crypto';

import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { Type } from '@sinclair/typebox';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { HttpProblem } from './problem-details.js';

const csrfCookieName = '__Host-skillmaps-csrf';
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

function equalTokens(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right) return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function readCsrfHeader(request: FastifyRequest): string | undefined {
  const value = request.headers['x-csrf-token'];
  return Array.isArray(value) ? value[0] : value;
}

export function registerSecurity(app: FastifyInstance, webOrigin: string): void {
  app.register(cookie);
  app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      callback(null, !origin || origin === webOrigin);
    },
  });
  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  });
  app.register(rateLimit, { global: false });

  app.addHook('onRequest', async (request) => {
    if (safeMethods.has(request.method)) return;
    if (request.headers.origin !== webOrigin) {
      throw new HttpProblem({
        status: 403,
        title: 'Forbidden',
        code: 'ORIGIN_NOT_ALLOWED',
      });
    }
    if (!equalTokens(readCsrfHeader(request), request.cookies[csrfCookieName])) {
      throw new HttpProblem({
        status: 403,
        title: 'Forbidden',
        code: 'INVALID_CSRF_TOKEN',
      });
    }
  });
}

export function registerSecurityRoutes(app: FastifyInstance): void {
  app.get(
    '/v1/security/csrf-token',
    {
      config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
      schema: {
        response: {
          200: Type.Object({ token: Type.String({ minLength: 32 }) }),
        },
      },
    },
    async (_request, reply) => {
      const token = randomBytes(32).toString('base64url');
      reply.setCookie(csrfCookieName, token, {
        path: '/',
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
      });
      return { token };
    },
  );
}

export function sensitiveRouteLimit(max: number, timeWindow = '1 minute') {
  return { config: { rateLimit: { max, timeWindow } } };
}
