import type { Static } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';

import { requireActiveUser } from '../../plugins/authorization.js';
import { HttpProblem } from '../../plugins/problem-details.js';
import {
  CertificationRecordInputSchema,
  CertificationRecordSchema,
  CredentialWriteHeadersSchema,
  ProblemSchema,
  ValidationProblemSchema,
} from './schemas.js';
import type { CertificationService } from './service.js';

function available(service: CertificationService | undefined): CertificationService {
  if (!service) {
    throw new HttpProblem({
      status: 503,
      title: 'Service Unavailable',
      code: 'SERVICE_UNAVAILABLE',
    });
  }
  return service;
}

export function registerCredentialRoutes(
  app: FastifyInstance,
  certifications?: CertificationService,
): void {
  app.get(
    '/v1/me/certification-records',
    {
      schema: {
        tags: ['Credentials'],
        operationId: 'listCertificationRecords',
        security: [{ cookieAuth: [] }],
        response: { 200: { type: 'array', items: CertificationRecordSchema }, 401: ProblemSchema },
      },
    },
    (request) => {
      const user = requireActiveUser(request);
      return available(certifications).list(user.id);
    },
  );

  app.post<{
    Headers: Static<typeof CredentialWriteHeadersSchema>;
    Body: Static<typeof CertificationRecordInputSchema>;
  }>(
    '/v1/me/certification-records',
    {
      schema: {
        tags: ['Credentials'],
        operationId: 'createCertificationRecord',
        security: [{ cookieAuth: [] }],
        headers: CredentialWriteHeadersSchema,
        body: CertificationRecordInputSchema,
        response: {
          201: CertificationRecordSchema,
          409: ProblemSchema,
          422: ValidationProblemSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await available(certifications).create(
        requireActiveUser(request).id,
        request.headers['idempotency-key'],
        request.body,
      );
      return reply.code(201).send(result);
    },
  );
}
