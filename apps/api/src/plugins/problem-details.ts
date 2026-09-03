import type { FastifyError, FastifyInstance, FastifyRequest } from 'fastify';

interface ProblemOptions {
  status: number;
  title: string;
  code: string;
  detail?: string;
  extensions?: Record<string, unknown>;
}

export class HttpProblem extends Error {
  readonly status: number;
  readonly title: string;
  readonly code: string;
  readonly extensions: Record<string, unknown>;

  constructor({ status, title, code, detail, extensions = {} }: ProblemOptions) {
    super(detail ?? title);
    this.name = 'HttpProblem';
    this.status = status;
    this.title = title;
    this.code = code;
    this.extensions = extensions;
  }
}

function instanceFor(request: FastifyRequest) {
  return request.url.split('?', 1)[0];
}

export function registerProblemDetails(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => {
    return reply
      .status(404)
      .type('application/problem+json')
      .send({
        type: 'about:blank',
        title: 'Not Found',
        status: 404,
        code: 'ROUTE_NOT_FOUND',
        instance: instanceFor(request),
        requestId: request.id,
      });
  });

  app.setErrorHandler((error: FastifyError | HttpProblem, request, reply) => {
    const validation = 'validation' in error ? error.validation : undefined;
    const isValidation = Array.isArray(validation);
    const status = isValidation
      ? 422
      : error instanceof HttpProblem
        ? error.status
        : (error.statusCode ?? 500);
    const title = isValidation
      ? 'Validation failed'
      : error instanceof HttpProblem
        ? error.title
        : status >= 500
          ? 'Internal Server Error'
          : 'Request failed';
    const code = isValidation
      ? 'VALIDATION_FAILED'
      : error instanceof HttpProblem
        ? error.code
        : status >= 500
          ? 'INTERNAL_ERROR'
          : 'REQUEST_FAILED';

    if (status >= 500) {
      request.log.error({ errorType: error.name }, 'Unhandled request error');
    }

    return reply
      .status(status)
      .type('application/problem+json')
      .send({
        type: 'about:blank',
        title,
        status,
        code,
        instance: instanceFor(request),
        requestId: request.id,
        ...(error instanceof HttpProblem ? error.extensions : {}),
        ...(isValidation
          ? {
              errors: validation.map((item) => ({
                path: item.instancePath || '/',
                code: item.keyword,
                message: item.message,
              })),
            }
          : {}),
      });
  });
}
