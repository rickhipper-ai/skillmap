import type { FastifyRequest } from 'fastify';

import type { AuditService } from '../audit/service.js';
import { requireContentAdmin, type AuthenticatedUser } from '../../plugins/authorization.js';
import { HttpProblem } from '../../plugins/problem-details.js';

export async function authorizeAdministration(
  request: FastifyRequest,
  audit: AuditService | undefined,
  eventType: string,
  resourceType?: string,
  resourceId?: string,
): Promise<AuthenticatedUser> {
  try {
    return requireContentAdmin(request);
  } catch (error) {
    await audit?.record({
      eventType,
      ...(request.currentUser ? { actorId: request.currentUser.id } : {}),
      outcome: 'denied',
      requestId: request.id,
      ...(resourceType ? { resourceType } : {}),
      ...(resourceId ? { resourceId } : {}),
      metadata: { reason: error instanceof HttpProblem ? error.code : 'authorization_denied' },
    });
    throw error;
  }
}

export async function auditAdministrationResult<T>(
  run: () => Promise<T>,
  audit: AuditService | undefined,
  input: {
    eventType: string;
    actorId: string;
    requestId: string;
    resourceType?: string;
    resourceId?: string;
  },
): Promise<T> {
  try {
    const result = await run();
    await audit?.record({ ...input, outcome: 'success' });
    return result;
  } catch (error) {
    await audit?.record({
      ...input,
      outcome: 'failure',
      metadata: { reason: safeErrorCode(error) },
    });
    throw translateAdministrationError(error);
  }
}

function safeErrorCode(error: unknown): string {
  if (error instanceof HttpProblem) return error.code;
  if (typeof error === 'object' && error !== null && 'code' in error)
    return String(error.code).slice(0, 40);
  return 'operation_failed';
}

function translateAdministrationError(error: unknown): unknown {
  if (error instanceof HttpProblem) return error;
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
  if (code === '23505') {
    return new HttpProblem({ status: 409, title: 'Conflict', code: 'CANONICAL_RESOURCE_CONFLICT' });
  }
  if (code === '23503' || code === '23514' || code === '22P02' || code === '22001') {
    return new HttpProblem({
      status: 422,
      title: 'Validation failed',
      code: 'CATALOG_VALIDATION_FAILED',
      extensions: { errors: [{ path: '/', code: 'invalid_relationship' }] },
    });
  }
  return error;
}
