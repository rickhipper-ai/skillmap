import { sql } from 'kysely';
import { describe, expect, it, vi } from 'vitest';

import { buildApp } from '../../src/app.js';
import { createDatabase } from '../../src/plugins/database.js';
import { JobRunner } from '../../src/plugins/jobs.js';
import { createGracefulShutdown } from '../../src/plugins/lifecycle.js';
import { withPostgres } from '../support/postgres.js';

describe('reliability boundaries', () => {
  it('returns detail-free unavailable readiness during a database outage', async () => {
    const app = buildApp({
      environment: {
        nodeEnv: 'test',
        host: '127.0.0.1',
        port: 3000,
        webOrigin: 'https://app.skill-maps.test',
        databaseUrl: 'postgresql://unavailable:unavailable@127.0.0.1:1/unavailable',
        databaseConnectionTimeoutMs: 100,
        databaseQueryTimeoutMs: 100,
      },
    });
    try {
      const response = await app.inject({ method: 'GET', url: '/health/ready' });
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ status: 'unavailable' });
      expect(response.body).not.toMatch(/postgres|connect|127\.0\.0\.1|stack|password/i);
    } finally {
      await app.close();
    }
  });

  it('closes the application once and telemetry last during concurrent shutdown signals', async () => {
    const order: string[] = [];
    const app = { close: vi.fn(async () => void order.push('app')) };
    const telemetry = { close: vi.fn(async () => void order.push('telemetry')) };
    const shutdown = createGracefulShutdown(app, telemetry);

    await Promise.all([shutdown(), shutdown(), shutdown()]);

    expect(app.close).toHaveBeenCalledTimes(1);
    expect(telemetry.close).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['app', 'telemetry']);
  });

  it('still closes telemetry when application shutdown fails', async () => {
    const telemetry = { close: vi.fn(async () => undefined) };
    const shutdown = createGracefulShutdown(
      { close: async () => Promise.reject(new Error('injected close failure')) },
      telemetry,
    );

    await expect(shutdown()).rejects.toThrow('injected close failure');
    expect(telemetry.close).toHaveBeenCalledOnce();
  });
});

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')('PostgreSQL reliability', () => {
  it('bounds query timeout and pool-exhaustion waits', async () => {
    await withPostgres(async ({ connectionString }) => {
      const database = createDatabase(connectionString, {
        max: 1,
        connectionTimeoutMillis: 150,
        queryTimeoutMillis: 150,
      });
      try {
        const queryStarted = performance.now();
        await expect(sql`SELECT pg_sleep(2)`.execute(database.db)).rejects.toThrow();
        expect(performance.now() - queryStarted).toBeLessThan(1_500);

        const held = await database.pool.connect();
        try {
          const poolStarted = performance.now();
          await expect(database.pool.connect()).rejects.toThrow(/timeout/i);
          expect(performance.now() - poolStarted).toBeLessThan(1_500);
        } finally {
          held.release();
        }
      } finally {
        await database.destroy();
      }
    });
  }, 120_000);

  it('retries failed handlers and records deterministic attempt outcomes', async () => {
    await withPostgres(async ({ admin, database }) => {
      const runner = new JobRunner(database.db);
      let calls = 0;
      runner.register('reliability_retry', async () => {
        calls += 1;
        if (calls === 1) throw new Error('injected handler failure');
      });
      const id = await runner.enqueue('reliability_retry', 'retry-once', { safe: true });

      expect(await runner.runOne()).toBe(true);
      await admin.query('UPDATE background_jobs SET available_at = now() WHERE id = $1', [id]);
      expect(await runner.runOne()).toBe(true);

      const job = await admin.query<{ status: string; attempts: number }>(
        'SELECT status, attempts FROM background_jobs WHERE id = $1',
        [id],
      );
      const attempts = await admin.query<{ attempt_number: number; outcome: string }>(
        'SELECT attempt_number, outcome FROM background_job_attempts WHERE job_id = $1 ORDER BY attempt_number',
        [id],
      );
      expect(job.rows[0]).toMatchObject({ status: 'completed', attempts: 2 });
      expect(attempts.rows).toEqual([
        { attempt_number: 1, outcome: 'retry' },
        { attempt_number: 2, outcome: 'completed' },
      ]);
    });
  }, 120_000);

  it('reclaims an abandoned running job after its worker lease expires', async () => {
    await withPostgres(async ({ admin, database }) => {
      const runner = new JobRunner(database.db, 100);
      const handled = vi.fn(async () => undefined);
      runner.register('worker_crash', handled);
      const id = await runner.enqueue('worker_crash', 'abandoned', { safe: true });
      await admin.query(
        `UPDATE background_jobs
         SET status = 'running', attempts = 1, locked_at = now() - interval '1 second'
         WHERE id = $1`,
        [id],
      );
      await admin.query(
        `INSERT INTO background_job_attempts (job_id, attempt_number, started_at)
         VALUES ($1, 1, now() - interval '1 second')`,
        [id],
      );

      expect(await runner.runOne()).toBe(true);
      expect(handled).toHaveBeenCalledOnce();
      const attempts = await admin.query<{
        attempt_number: number;
        outcome: string;
        error_code: string | null;
      }>(
        `SELECT attempt_number, outcome, error_code
         FROM background_job_attempts WHERE job_id = $1 ORDER BY attempt_number`,
        [id],
      );
      expect(attempts.rows).toEqual([
        { attempt_number: 1, outcome: 'retry', error_code: 'worker_lease_expired' },
        { attempt_number: 2, outcome: 'completed', error_code: null },
      ]);
    });
  }, 120_000);
});
