import { apiBaseUrl, mapProblemDetails } from '../../services/api-client';

export interface AdminResource {
  id: string;
  slug: string;
  status: 'draft' | 'published' | 'unpublished' | 'inactive';
  updatedAt: string;
}

export interface Publication {
  resourceId: string;
  revisionId: string;
  revisionNumber: number;
  publishedAt: string;
}

export async function adminMutation<T>(
  path: string,
  method: 'POST' | 'PATCH',
  body?: unknown,
  idempotent = false,
): Promise<T> {
  const csrfResponse = await fetch(`${apiBaseUrl}/v1/security/csrf-token`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!csrfResponse.ok) throw mapProblemDetails(await csrfResponse.json().catch(() => undefined));
  const { token } = (await csrfResponse.json()) as { token: string };
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': method === 'PATCH' ? 'application/merge-patch+json' : 'application/json',
      'X-CSRF-Token': token,
      ...(idempotent ? { 'Idempotency-Key': crypto.randomUUID() } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw mapProblemDetails(await response.json().catch(() => undefined));
  return (await response.json()) as T;
}
