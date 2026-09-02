import type { FastifyInstance, FastifyRequest } from 'fastify';

import { HttpProblem } from './problem-details.js';

export interface AuthenticatedUser {
  id: string;
  status: 'pending_verification' | 'active' | 'suspended' | 'deletion_pending';
  roles: readonly ('user' | 'content_admin')[];
}

declare module 'fastify' {
  interface FastifyRequest {
    currentUser: AuthenticatedUser | null;
  }
}

export function registerAuthorization(app: FastifyInstance): void {
  app.decorateRequest('currentUser', null);
}

export function requireActiveUser(request: FastifyRequest): AuthenticatedUser {
  if (!request.currentUser) {
    throw new HttpProblem({ status: 401, title: 'Unauthorized', code: 'AUTHENTICATION_REQUIRED' });
  }
  if (request.currentUser.status !== 'active') {
    throw new HttpProblem({ status: 403, title: 'Forbidden', code: 'ACTIVE_ACCOUNT_REQUIRED' });
  }
  return request.currentUser;
}

export function requireOwnership(request: FastifyRequest, ownerId: string): AuthenticatedUser {
  const user = requireActiveUser(request);
  if (user.id !== ownerId) {
    throw new HttpProblem({ status: 403, title: 'Forbidden', code: 'RESOURCE_NOT_OWNED' });
  }
  return user;
}

export function requireContentAdmin(request: FastifyRequest): AuthenticatedUser {
  const user = requireActiveUser(request);
  if (!user.roles.includes('content_admin')) {
    throw new HttpProblem({ status: 403, title: 'Forbidden', code: 'CONTENT_ADMIN_REQUIRED' });
  }
  return user;
}
