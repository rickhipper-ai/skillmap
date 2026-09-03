import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { mapProblemDetails } from '../../services/api-client';

const apiBaseUrl =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

export type StepState = 'not_started' | 'in_progress' | 'completed';

export interface ProgressHistoryEvent {
  eventId: number;
  stepId: string;
  state: StepState;
  occurredAt: string;
  source: 'user' | 'admin_correction' | 'system';
  supersedesEventId?: number;
  observedRevisionId: string;
}

export interface TrailProgress {
  trailId: string;
  currentRevisionId: string;
  status: 'in_progress' | 'completed';
  percentage: number;
  streamVersion: number;
  catalogChanged?: boolean;
  reviewRequired?: boolean;
  steps: Array<{
    stepId: string;
    state: StepState;
    eligible: boolean;
    pendingPrerequisiteStepIds?: string[];
  }>;
  history: ProgressHistoryEvent[];
}

export interface ProgressCommand {
  stepId: string;
  state: StepState;
  baseStreamVersion: number;
  supersedesEventId?: number;
  commandId?: string;
}

async function responseJson<T>(response: Response): Promise<T> {
  if (!response.ok) throw mapProblemDetails(await response.json().catch(() => undefined));
  return (await response.json()) as T;
}

async function csrfToken(): Promise<string> {
  const response = await fetch(`${apiBaseUrl}/v1/security/csrf-token`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  return (await responseJson<{ token: string }>(response)).token;
}

async function progressWrite<T>(
  path: string,
  method: 'PUT' | 'POST',
  body?: unknown,
  commandId?: string,
) {
  const csrf = await csrfToken();
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrf,
      'Idempotency-Key': commandId ?? crypto.randomUUID(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return responseJson<T>(response);
}

export function useTrailProgress(trailId: string) {
  return useQuery({
    queryKey: ['trail-progress', trailId],
    retry: false,
    queryFn: async () => {
      const response = await fetch(`${apiBaseUrl}/v1/me/trails/${trailId}`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      return responseJson<TrailProgress>(response);
    },
  });
}

export function useStartTrail(trailId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commandId?: string) =>
      progressWrite<TrailProgress>(`/v1/me/trails/${trailId}`, 'PUT', undefined, commandId),
    onSuccess: (progress) => queryClient.setQueryData(['trail-progress', trailId], progress),
  });
}

export function useAppendProgress(trailId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ stepId, commandId, ...command }: ProgressCommand) =>
      progressWrite<{ trailProgress: TrailProgress }>(
        `/v1/me/trails/${trailId}/steps/${stepId}/events`,
        'POST',
        command,
        commandId,
      ),
    onSuccess: ({ trailProgress }) =>
      queryClient.setQueryData(['trail-progress', trailId], trailProgress),
  });
}
