import type {
  AchievementAward,
  CertificationRecord,
  CertificationRecordInput,
} from '@skill-maps/api-contract';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { mapProblemDetails } from '../../services/api-client';

const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw mapProblemDetails(await response.json().catch(() => undefined));
  return (await response.json()) as T;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return responseJson<T>(response);
}

export function useCertificationRecords() {
  return useQuery({
    queryKey: ['certification-records'],
    retry: false,
    queryFn: () => getJson<CertificationRecord[]>('/v1/me/certification-records'),
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    retry: false,
    queryFn: () => getJson<AchievementAward[]>('/v1/me/achievements'),
  });
}

export function useCreateCertificationRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CertificationRecordInput) => {
      const csrfResponse = await fetch(`${apiBaseUrl}/v1/security/csrf-token`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const { token } = await responseJson<{ token: string }>(csrfResponse);
      const response = await fetch(`${apiBaseUrl}/v1/me/certification-records`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': token,
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(input),
      });
      return responseJson<CertificationRecord>(response);
    },
    onSuccess: (record) => {
      queryClient.setQueryData<CertificationRecord[]>(['certification-records'], (current = []) => [
        record,
        ...current.filter((item) => item.id !== record.id),
      ]);
      void queryClient.invalidateQueries({ queryKey: ['achievements'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export type { AchievementAward, CertificationRecord, CertificationRecordInput };
