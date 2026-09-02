import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { Pool } from 'pg';

import { readEnvironment } from '../config/environment.js';

const defaultMigrationsDirectory = fileURLToPath(
  new URL('../../../../database/migrations/', import.meta.url),
);

export async function runMigrations(
  pool: Pool,
  migrationsDirectory = defaultMigrationsDirectory,
): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', ['skill-maps-migrations']);
    const files = (await readdir(migrationsDirectory))
      .filter((file) => /^\d+_[a-z0-9_]+\.sql$/i.test(file))
      .sort();

    for (const file of files) {
      const sql = await readFile(new URL(file, pathToFileURL(`${migrationsDirectory}/`)), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const ledgerExists = await client.query<{ exists: string | null }>(
        "SELECT to_regclass('public.schema_migrations')::text AS exists",
      );
      const applied = ledgerExists.rows[0]?.exists
        ? await client.query<{ checksum: string }>(
            'SELECT checksum FROM schema_migrations WHERE version = $1',
            [file],
          )
        : { rows: [] };

      if (applied.rows[0]) {
        if (applied.rows[0].checksum !== checksum) {
          throw new Error(`Checksum mismatch for applied migration ${file}`);
        }
        continue;
      }

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [
          file,
          checksum,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', ['skill-maps-migrations']);
    client.release();
  }
}

async function main() {
  const environment = readEnvironment();
  const pool = new Pool({ connectionString: environment.migrationDatabaseUrl });
  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
