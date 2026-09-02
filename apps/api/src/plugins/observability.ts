import { randomUUID } from 'node:crypto';

import { NodeSDK } from '@opentelemetry/sdk-node';
import type { FastifyServerOptions } from 'fastify';

const redactedPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers.set-cookie',
  '*.password',
  '*.secret',
  '*.token',
  '*.email',
  '*.email_normalized',
];

export function createLoggerOptions(): NonNullable<FastifyServerOptions['logger']> {
  return {
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: redactedPaths,
      censor: '[REDACTED]',
    },
  };
}

export function createRequestId(requestId?: string): string {
  return requestId && requestId.length <= 128 ? requestId : randomUUID();
}

export function startTelemetry(serviceName: string): NodeSDK {
  const sdk = new NodeSDK({ serviceName });
  sdk.start();
  return sdk;
}
