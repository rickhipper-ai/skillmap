import { z } from 'zod';

const postgresUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), {
    message: 'must use the PostgreSQL protocol',
  });

const booleanFlag = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('127.0.0.1'),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
    WEB_ORIGIN: z.string().url(),
    DATABASE_URL: postgresUrl,
    MIGRATION_DATABASE_URL: postgresUrl.optional(),
    DATABASE_RUNTIME_ROLE: z
      .string()
      .regex(/^[a-z_][a-z0-9_]*$/)
      .optional(),
    DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5_000),
    DATABASE_QUERY_TIMEOUT_MS: z.coerce.number().int().min(100).max(120_000).default(10_000),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    JOB_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60_000).default(1_000),
    AUTH_SECRET: z.string().min(32),
    DEMO_AUTO_VERIFY_EMAIL: booleanFlag,
    SMTP_HOST: z.string().min(1).default('127.0.0.1'),
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
    SMTP_FROM: z.string().email().default('nao-responda@skill-maps.test'),
    OTEL_SERVICE_NAME: z.string().min(1).default('skill-maps-api'),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV === 'production' && value.DEMO_AUTO_VERIFY_EMAIL) {
      context.addIssue({
        code: 'custom',
        path: ['DEMO_AUTO_VERIFY_EMAIL'],
        message: 'must be false in production',
      });
    }
  });

export interface Environment {
  nodeEnv: 'development' | 'test' | 'production';
  host: string;
  port: number;
  webOrigin: string;
  databaseUrl: string;
  migrationDatabaseUrl?: string | undefined;
  databaseRuntimeRole?: string | undefined;
  databaseConnectionTimeoutMs: number;
  databaseQueryTimeoutMs: number;
  databasePoolMax: number;
  jobPollIntervalMs: number;
  authSecret: string;
  demoAutoVerifyEmail: boolean;
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
    databaseRuntimeRole: parsed.data.DATABASE_RUNTIME_ROLE,
    databaseConnectionTimeoutMs: parsed.data.DATABASE_CONNECTION_TIMEOUT_MS,
    databaseQueryTimeoutMs: parsed.data.DATABASE_QUERY_TIMEOUT_MS,
    databasePoolMax: parsed.data.DATABASE_POOL_MAX,
    jobPollIntervalMs: parsed.data.JOB_POLL_INTERVAL_MS,
    authSecret: parsed.data.AUTH_SECRET,
    demoAutoVerifyEmail: parsed.data.DEMO_AUTO_VERIFY_EMAIL,
    smtpHost: parsed.data.SMTP_HOST,
    smtpPort: parsed.data.SMTP_PORT,
    emailFrom: parsed.data.SMTP_FROM,
    otelServiceName: parsed.data.OTEL_SERVICE_NAME,
  };
}

export function readMigrationDatabaseUrl(source: NodeJS.ProcessEnv = process.env): string {
  const parsed = postgresUrl.safeParse(source.MIGRATION_DATABASE_URL);
  if (!parsed.success) throw new Error('Invalid API environment: MIGRATION_DATABASE_URL');
  return parsed.data;
}
