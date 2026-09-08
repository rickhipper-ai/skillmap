export interface WebEnvironment {
  apiBaseUrl: string;
}

export function readWebEnvironment(
  source: Record<string, string | boolean | undefined> = import.meta.env,
): WebEnvironment {
  const value = source.VITE_API_BASE_URL || '/api';
  if (typeof value !== 'string') throw new Error('Invalid web environment: VITE_API_BASE_URL');
  if (value.startsWith('/')) return { apiBaseUrl: value.replace(/\/$/, '') };
  try {
    return { apiBaseUrl: new URL(value).toString().replace(/\/$/, '') };
  } catch {
    throw new Error('Invalid web environment: VITE_API_BASE_URL');
  }
}
