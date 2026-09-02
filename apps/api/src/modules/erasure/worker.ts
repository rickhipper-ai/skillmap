import { sql, type Kysely } from 'kysely';

import type { FoundationDatabase } from '../../plugins/database.js';

export interface ProviderCleanupPort {
  cleanup(input: { requestId: string; userId: string; email: string }): Promise<void>;
}

export class NoopProviderCleanup implements ProviderCleanupPort {
  async cleanup(): Promise<void> {}
}

export function retryDelaySeconds(attempt: number): number {
  return Math.min(86_400, Math.max(1, 2 ** Math.min(attempt, 16)));
}

export class AccountErasureWorker {
  constructor(
    private readonly db: Kysely<FoundationDatabase>,
    private readonly providers: ProviderCleanupPort,
  ) {}

  async process(requestId: string): Promise<void> {
    const result = await sql<{
      state: 'requested' | 'processing' | 'completed' | 'failed';
      user_id: string | null;
      email_normalized: string | null;
      attempts: number;
    }>`
      SELECT r.state, r.user_id, u.email_normalized, r.attempts
      FROM account_deletion_requests r
      LEFT JOIN users u ON u.id = r.user_id
      WHERE r.id = ${requestId}
    `.execute(this.db);
    const request = result.rows[0];
    if (!request) throw new Error('ERASURE_REQUEST_NOT_FOUND');
    if (request.state === 'completed' || request.user_id === null) return;

    const attempt = request.attempts + 1;
    await sql`
      UPDATE account_deletion_requests
      SET state = 'processing', attempts = ${attempt}, next_attempt_at = NULL, last_error_code = NULL
      WHERE id = ${requestId}
    `.execute(this.db);
    try {
      await this.providers.cleanup({
        requestId,
        userId: request.user_id,
        email: request.email_normalized ?? '',
      });
      await sql`SELECT complete_account_erasure(${requestId}::uuid)`.execute(this.db);
    } catch {
      const delay = retryDelaySeconds(attempt);
      await sql`
        UPDATE account_deletion_requests
        SET state = 'failed', next_attempt_at = now() + (${delay} * interval '1 second'),
            last_error_code = 'PROVIDER_OR_PRIMARY_CLEANUP_FAILED'
        WHERE id = ${requestId} AND state <> 'completed'
      `.execute(this.db);
      throw new Error('ACCOUNT_ERASURE_RETRY_REQUIRED');
    }
  }
}
