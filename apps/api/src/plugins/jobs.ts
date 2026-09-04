import { sql, type Kysely } from 'kysely';

import type { FoundationDatabase } from './database.js';

export type JobHandler = (payload: unknown) => Promise<void>;

interface ClaimedJob {
  id: string;
  job_type: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
  status: 'pending' | 'retry' | 'running';
}

export class JobRunner {
  private readonly handlers = new Map<string, JobHandler>();

  constructor(
    private readonly db: Kysely<FoundationDatabase>,
    private readonly leaseTimeoutMillis = 5 * 60_000,
  ) {}

  register(jobType: string, handler: JobHandler): void {
    if (this.handlers.has(jobType)) throw new Error(`Handler already registered for ${jobType}`);
    this.handlers.set(jobType, handler);
  }

  async enqueue(jobType: string, idempotencyKey: string, payload: unknown): Promise<string> {
    const result = await sql<{ id: string }>`
      INSERT INTO background_jobs (job_type, idempotency_key, payload)
      VALUES (${jobType}, ${idempotencyKey}, ${JSON.stringify(payload)}::jsonb)
      ON CONFLICT (job_type, idempotency_key)
      DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
      RETURNING id
    `.execute(this.db);
    const id = result.rows[0]?.id;
    if (!id) throw new Error('Job enqueue did not return an identifier');
    return id;
  }

  async runOne(): Promise<boolean> {
    const claimed = await this.db.transaction().execute(async (transaction) => {
      const result = await sql<ClaimedJob>`
        SELECT id, job_type, payload, attempts, max_attempts, status
        FROM background_jobs
        WHERE (status IN ('pending', 'retry') AND available_at <= now())
           OR (status = 'running' AND locked_at <= now() - (${this.leaseTimeoutMillis} * interval '1 millisecond'))
        ORDER BY available_at, created_at
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `.execute(transaction);
      const job = result.rows[0];
      if (!job) return undefined;

      const attempt = job.attempts + 1;
      if (job.status === 'running') {
        await sql`
          UPDATE background_job_attempts
          SET outcome = 'retry', error_code = 'worker_lease_expired', finished_at = now()
          WHERE job_id = ${job.id} AND attempt_number = ${job.attempts} AND finished_at IS NULL
        `.execute(transaction);
      }
      await sql`
        UPDATE background_jobs
        SET status = 'running', attempts = ${attempt}, locked_at = now(), updated_at = now()
        WHERE id = ${job.id}
      `.execute(transaction);
      await sql`
        INSERT INTO background_job_attempts (job_id, attempt_number, started_at)
        VALUES (${job.id}, ${attempt}, now())
      `.execute(transaction);
      return { ...job, attempts: attempt };
    });

    if (!claimed) return false;
    const handler = this.handlers.get(claimed.job_type);
    if (!handler) {
      await this.finishFailure(claimed, 'handler_not_registered');
      return true;
    }

    try {
      await handler(claimed.payload);
      await sql`
        UPDATE background_jobs
        SET status = 'completed', completed_at = now(), locked_at = NULL, updated_at = now()
        WHERE id = ${claimed.id}
      `.execute(this.db);
      await sql`
        UPDATE background_job_attempts
        SET outcome = 'completed', finished_at = now()
        WHERE job_id = ${claimed.id} AND attempt_number = ${claimed.attempts}
      `.execute(this.db);
    } catch {
      await this.finishFailure(claimed, 'handler_failed');
    }
    return true;
  }

  private async finishFailure(job: ClaimedJob, errorCode: string): Promise<void> {
    const exhausted = job.attempts >= job.max_attempts;
    const retrySeconds = Math.min(300, 2 ** job.attempts);
    await sql`
      UPDATE background_jobs
      SET status = ${exhausted ? 'failed' : 'retry'}::background_job_status,
          available_at = CASE WHEN ${exhausted} THEN available_at ELSE now() + (${retrySeconds} * interval '1 second') END,
          last_error_code = ${errorCode}, locked_at = NULL, updated_at = now()
      WHERE id = ${job.id}
    `.execute(this.db);
    await sql`
      UPDATE background_job_attempts
      SET outcome = ${exhausted ? 'failed' : 'retry'}, error_code = ${errorCode}, finished_at = now()
      WHERE job_id = ${job.id} AND attempt_number = ${job.attempts}
    `.execute(this.db);
  }
}
