import { mapProblemDetails } from '../../services/api-client';

const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

async function csrfToken(): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/v1/security/csrf-token`, { credentials: 'include' });
  if (!response.ok) throw mapProblemDetails(await response.json().catch(() => undefined));
  return ((await response.json()) as { token: string }).token;
}

export async function identityRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; contentType?: string } = {},
): Promise<T | undefined> {
  const token = await csrfToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'POST',
    credentials: 'include',
    headers: {
      'X-CSRF-Token': token,
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
