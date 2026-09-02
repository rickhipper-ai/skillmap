export interface WebEnvironment {
  apiBaseUrl: string;
}

export function readWebEnvironment(
  source: Record<string, string | boolean | undefined> = import.meta.env,
): WebEnvironment {
  const value = source.VITE_API_BASE_URL;
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('Invalid web environment: VITE_API_BASE_URL');
  }
  try {
    return { apiBaseUrl: new URL(value).toString().replace(/\/$/, '') };
  } catch {
    throw new Error('Invalid web environment: VITE_API_BASE_URL');
  }
}
