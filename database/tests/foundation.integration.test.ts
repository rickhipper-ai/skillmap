import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { withPostgres } from '../../apps/api/tests/support/postgres.js';
import { runMigrations } from '../../apps/api/src/commands/migrate.js';

const migrationUrl = new URL('../migrations/0001_foundation.sql', import.meta.url);

describe('foundation migration', () => {
  it('declares extensions, isolated roles, primary keys, foreign keys, and append-only primitives', async () => {
    const sql = await readFile(migrationUrl, 'utf8');

    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS pgcrypto/i);
    expect(sql).toMatch(/CREATE ROLE skill_maps_migration/i);
    expect(sql).toMatch(/CREATE ROLE skill_maps_runtime/i);
    expect(sql).toMatch(/CREATE TABLE schema_migrations[\s\S]+PRIMARY KEY/i);
    expect(sql).toMatch(/CREATE TABLE audit_events[\s\S]+PRIMARY KEY/i);
    expect(sql).toMatch(/REFERENCES background_jobs/i);
    expect(sql).toMatch(/REVOKE (UPDATE|DELETE|TRUNCATE)[\s\S]+audit_events/i);
  });
});

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')(
  'foundation PostgreSQL invariants',
  () => {
    it('applies with separate roles and enforces foreign keys', async () => {
      await withPostgres(async ({ admin, runtime }) => {
        const roles = await admin.query<{ rolname: string }>(
          "SELECT rolname FROM pg_roles WHERE rolname IN ('skill_maps_migration', 'skill_maps_runtime')",
        );
        expect(roles.rows.map(({ rolname }) => rolname).sort()).toEqual([
          'skill_maps_migration',
          'skill_maps_runtime',
        ]);

        await expect(
          runtime.query(
            "INSERT INTO background_job_attempts (job_id, attempt_number, started_at) VALUES ('00000000-0000-0000-0000-000000000000', 1, now())",
          ),
        ).rejects.toMatchObject({ code: '23503' });
      });
    });

    it('applies all reviewed migrations to a clean database and can be rerun', async () => {
      await withPostgres(async ({ admin }) => {
        await runMigrations(admin);
        const migrations = await admin.query<{ count: string }>(
          'SELECT count(*)::text AS count FROM schema_migrations',
        );
        expect(migrations.rows[0]?.count).toBe('8');
      });
    });

    it('rolls back a failed migration unit without leaving partial objects', async () => {
      await withPostgres(async ({ admin }) => {
        await expect(
          admin.query(
            'BEGIN; CREATE TABLE rollback_probe (id integer PRIMARY KEY); SELECT missing(); COMMIT;',
          ),
        ).rejects.toBeDefined();
        await admin.query('ROLLBACK');

        const result = await admin.query<{ table_name: string }>(
          "SELECT table_name FROM information_schema.tables WHERE table_name = 'rollback_probe'",
        );
        expect(result.rowCount).toBe(0);
      });
    });
  },
);
