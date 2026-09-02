import { sql, type Kysely } from 'kysely';

import type { LiveSession } from '../identity/repository.js';
import type { IdentityService } from '../identity/service.js';
import { HttpProblem } from '../../plugins/problem-details.js';
import type { FoundationDatabase } from '../../plugins/database.js';
import type { AuditService } from '../audit/service.js';

const recentAuthenticationMs = 15 * 60 * 1000;

export interface DeletionReceipt {
  requestId: string;
  status: 'requested';
  requestedAt: string;
  deadlineAt: string;
}

export class ErasureService {
  constructor(
    private readonly db: Kysely<FoundationDatabase>,
    private readonly identities: IdentityService,
    private readonly audit: AuditService,
  ) {}

  async request(session: LiveSession, password: string): Promise<DeletionReceipt> {
    const recent = Date.now() - session.authenticatedAt.getTime() <= recentAuthenticationMs;
    if (!recent) {
      throw new HttpProblem({ status: 401, title: 'Unauthorized', code: 'RECENT_AUTH_REQUIRED' });
    }
    await this.identities.verifyCurrentPassword(session.token, password);

    const receipt = await this.db.transaction().execute(async (transaction) => {
      const locked = await sql<{ id: string }>`
        SELECT id FROM users WHERE id = ${session.userId} AND status = 'active' FOR UPDATE
      `.execute(transaction);
      if (!locked.rows[0]) {
        throw new HttpProblem({
          status: 401,
          title: 'Unauthorized',
          code: 'AUTHENTICATION_REQUIRED',
        });
      }
      await sql`
        UPDATE users SET status = 'deletion_pending', deletion_requested_at = now(), updated_at = now()
        WHERE id = ${session.userId}
      `.execute(transaction);
      await sql`DELETE FROM auth_sessions WHERE user_id = ${session.userId}`.execute(transaction);
      await sql`DELETE FROM auth_tokens WHERE token_value = ${session.userId}`.execute(transaction);
      const created = await sql<{
        id: string;
        requested_at: Date;
        deadline_at: Date;
      }>`
        INSERT INTO account_deletion_requests (user_id) VALUES (${session.userId})
        RETURNING id, requested_at, deadline_at
      `.execute(transaction);
      const row = created.rows[0];
      if (!row) throw new Error('Deletion request was not created');
      await sql`
        INSERT INTO background_jobs (job_type, idempotency_key, payload)
        VALUES ('account_erasure', ${row.id}, ${JSON.stringify({ requestId: row.id })}::jsonb)
      `.execute(transaction);
      return {
        requestId: row.id,
        status: 'requested' as const,
        requestedAt: row.requested_at.toISOString(),
        deadlineAt: row.deadline_at.toISOString(),
      };
    });
    await this.audit.record({
      eventType: 'account_deletion_requested',
      actorId: session.userId,
      subjectId: session.userId,
      outcome: 'success',
      resourceType: 'account_deletion_request',
      resourceId: receipt.requestId,
    });
    return receipt;
  }
}
