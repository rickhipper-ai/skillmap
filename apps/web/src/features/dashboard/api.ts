import type { Dashboard } from '@skill-maps/api-contract';
import { useQuery } from '@tanstack/react-query';

import { apiBaseUrl, mapProblemDetails } from '../../services/api-client';

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
