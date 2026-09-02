import { client } from '@skill-maps/api-contract';

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  code: string;
  requestId: string;
  detail?: string;
  errors?: Array<{ path: string; code: string; message?: string }>;
}

export class ApiProblem extends Error {
  constructor(readonly problem: ProblemDetails) {
    super(problem.title);
    this.name = 'ApiProblem';
  }
}

export function configureApiClient(apiBaseUrl: string): void {
  client.setConfig({
    baseUrl: apiBaseUrl,
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
}

export function mapProblemDetails(value: unknown): ApiProblem {
  if (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    'status' in value &&
    'code' in value &&
    'requestId' in value
  ) {
    return new ApiProblem(value as ProblemDetails);
  }
  return new ApiProblem({
    type: 'about:blank',
    title: 'Falha inesperada',
    status: 0,
    code: 'network_error',
    requestId: 'unavailable',
  });
}
