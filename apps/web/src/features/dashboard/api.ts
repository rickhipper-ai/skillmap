import type { Dashboard } from '@skill-maps/api-contract';
import { useQuery } from '@tanstack/react-query';

import { mapProblemDetails } from '../../services/api-client';

const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    retry: false,
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/v1/me/dashboard`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw mapProblemDetails(await response.json().catch(() => undefined));
      return (await response.json()) as Dashboard;
    },
  });
}
