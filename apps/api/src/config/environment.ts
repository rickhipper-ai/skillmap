import { z } from 'zod';

const postgresUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), {
    message: 'must use the PostgreSQL protocol',
  });

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  WEB_ORIGIN: z.string().url(),
  DATABASE_URL: postgresUrl,
  MIGRATION_DATABASE_URL: postgresUrl,
  AUTH_SECRET: z.string().min(32),
  SMTP_HOST: z.string().min(1).default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
  SMTP_FROM: z.string().email().default('nao-responda@skill-maps.test'),
  OTEL_SERVICE_NAME: z.string().min(1).default('skill-maps-api'),
});

export interface Environment {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  webOrigin: string;
  databaseUrl: string;
  migrationDatabaseUrl: string;
  authSecret: string;
  smtpHost: string;
  smtpPort: number;
  emailFrom: string;
  otelServiceName: string;
}

export function readEnvironment(source: NodeJS.ProcessEnv = process.env): Environment {
  const parsed = environmentSchema.safeParse(source);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid API environment: ${fields}`);
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    host: parsed.data.HOST,
    port: parsed.data.PORT,
    webOrigin: parsed.data.WEB_ORIGIN,
    databaseUrl: parsed.data.DATABASE_URL,
    migrationDatabaseUrl: parsed.data.MIGRATION_DATABASE_URL,
    authSecret: parsed.data.AUTH_SECRET,
    smtpHost: parsed.data.SMTP_HOST,
    smtpPort: parsed.data.SMTP_PORT,
    emailFrom: parsed.data.SMTP_FROM,
    otelServiceName: parsed.data.OTEL_SERVICE_NAME,
  };
}
