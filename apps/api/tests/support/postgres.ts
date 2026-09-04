import { fileURLToPath } from 'node:url';

import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool, type PoolClient } from 'pg';

import { runMigrations } from '../../src/commands/migrate.js';
import type { FoundationDatabase, OwnedDatabase } from '../../src/plugins/database.js';

export interface PostgresContext {
  admin: Pool;
  connectionString: string;
  runtime: PoolClient;
  database: OwnedDatabase;
}

const migrationsDirectory = fileURLToPath(
  new URL('../../../../database/migrations/', import.meta.url),
);

export async function withPostgres(
  run: (context: PostgresContext) => Promise<void>,
): Promise<void> {
  const container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('skill_maps_test')
    .withUsername('skill_maps_test_admin')
    .withPassword('fictitious_test_password')
    .start();
  const admin = new Pool({ connectionString: container.getConnectionUri(), max: 4 });
  let runtime: PoolClient | undefined;

  try {
    await runMigrations(admin, migrationsDirectory);
    const db = new Kysely<FoundationDatabase>({ dialect: new PostgresDialect({ pool: admin }) });
    runtime = await admin.connect();
    await runtime.query('SET ROLE skill_maps_runtime');
    await run({
      admin,
      connectionString: container.getConnectionUri(),
      runtime,
      database: { db, pool: admin, async destroy() {} },
    });
  } finally {
    runtime?.release();
    await admin.end();
    await container.stop();
  }
}
