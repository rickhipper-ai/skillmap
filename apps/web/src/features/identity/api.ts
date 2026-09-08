import type { CurrentUser } from '@skill-maps/api-contract';

import { apiBaseUrl, mapProblemDetails } from '../../services/api-client';

export const currentUserQueryKey = ['current-user'] as const;

async function csrfToken(): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/v1/security/csrf-token`, { credentials: 'include' });
  if (!response.ok) throw mapProblemDetails(await response.json().catch(() => undefined));
  return ((await response.json()) as { token: string }).token;
}

export async function identityRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; contentType?: string } = {},
): Promise<T | undefined> {
  const method = options.method ?? 'POST';
  const token = ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
    ? undefined
    : await csrfToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...(token ? { 'X-CSRF-Token': token } : {}),
      ...(options.body === undefined
        ? {}
        : { 'Content-Type': options.contentType ?? 'application/json' }),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  if (!response.ok) throw mapProblemDetails(await response.json().catch(() => undefined));
  const responseType = response.headers.get('content-type') ?? '';
  if (
    response.status === 204 ||
    (response.status === 202 && !responseType.includes('application/json'))
  ) {
    return undefined;
  }
  return (await response.json()) as T;
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const user = await identityRequest<CurrentUser>('/v1/users/me', { method: 'GET' });
  if (!user) throw new Error('Current user response is empty');
  return user;
}
