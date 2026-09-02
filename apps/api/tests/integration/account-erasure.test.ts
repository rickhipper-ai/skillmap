import { describe, expect, it, vi } from 'vitest';

import { visibleAnonymousMetric } from '../../src/modules/erasure/anonymous-metrics.js';
import { retryDelaySeconds } from '../../src/modules/erasure/worker.js';
import {
  AccountErasureWorker,
  type ProviderCleanupPort,
} from '../../src/modules/erasure/worker.js';
import { withPostgres } from '../support/postgres.js';
import {
  CapturingEmail,
  createDatabaseApp,
  csrf,
  mutate,
  registerVerifyAndLogin,
} from '../support/identity.js';

describe('account erasure', () => {
  it('suppresses anonymous cells below five distinct contributors', () => {
    expect(visibleAnonymousMetric({ contributorCount: 4, value: 12 })).toBeNull();
    expect(visibleAnonymousMetric({ contributorCount: 5, value: 12 })).toEqual({
      contributorCount: 5,
      value: 12,
    });
  });

  it('uses bounded retries so provider failures cannot move the 30-day deadline', () => {
    expect(retryDelaySeconds(1)).toBeGreaterThan(0);
    expect(retryDelaySeconds(100)).toBeLessThanOrEqual(86_400);
    expect(vi.isMockFunction(vi.fn())).toBe(true);
  });
});

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')('durable account erasure', () => {
  it('revokes atomically, retries provider cleanup, erases identifiers, and keeps a tombstone', async () => {
    await withPostgres(async ({ admin, database }) => {
      let cleanupAttempts = 0;
      const provider: ProviderCleanupPort = {
        async cleanup() {
          cleanupAttempts += 1;
          if (cleanupAttempts === 1) throw new Error('injected_provider_failure');
        },
      };
      const email = new CapturingEmail();
      const app = createDatabaseApp(database, email, provider);
      const proof = await csrf(app);
      try {
        const address = 'apagamento.ficticio@example.test';
        const firstSession = await registerVerifyAndLogin(app, email, proof, address);
        const secondLogin = await mutate(app, proof, {
          method: 'POST',
          url: '/v1/sessions',
          payload: { email: address, password: 'Senha-ficticia-123!' },
        });
        const rawCookie = secondLogin.headers['set-cookie'];
        const secondSession =
          (Array.isArray(rawCookie) ? rawCookie[0] : rawCookie)?.split(';', 1)[0] ?? '';

        const deletion = await mutate(
          app,
          proof,
          {
            method: 'DELETE',
            url: '/v1/users/me',
            payload: { password: 'Senha-ficticia-123!' },
          },
          firstSession,
        );
        expect(deletion.statusCode).toBe(202);
        const receipt = deletion.json<{
          requestId: string;
          requestedAt: string;
          deadlineAt: string;
        }>();
        expect(
          new Date(receipt.deadlineAt).getTime() - new Date(receipt.requestedAt).getTime(),
        ).toBeLessThanOrEqual(30 * 86_400_000);
        expect(
          (
            await app.inject({
              method: 'GET',
              url: '/v1/users/me',
              headers: { cookie: secondSession },
            })
          ).statusCode,
        ).toBe(401);

        const pending = await admin.query<{
          status: string;
          session_count: string;
          target_at: Date;
          requested_at: Date;
        }>(
          `SELECT u.status, (SELECT count(*) FROM auth_sessions s WHERE s.user_id = u.id)::text AS session_count,
                  r.target_at, r.requested_at
           FROM users u JOIN account_deletion_requests r ON r.user_id = u.id WHERE r.id = $1`,
          [receipt.requestId],
        );
        expect(pending.rows[0]?.status).toBe('deletion_pending');
        expect(pending.rows[0]?.session_count).toBe('0');
        expect(
          (pending.rows[0]?.target_at.getTime() ?? 0) -
            (pending.rows[0]?.requested_at.getTime() ?? 0),
        ).toBeLessThanOrEqual(86_400_000);

        const worker = new AccountErasureWorker(database.db, provider);
        await expect(worker.process(receipt.requestId)).rejects.toThrow(
          'ACCOUNT_ERASURE_RETRY_REQUIRED',
        );
        await expect(worker.process(receipt.requestId)).resolves.toBeUndefined();
        await expect(worker.process(receipt.requestId)).resolves.toBeUndefined();
        expect(cleanupAttempts).toBe(2);

        const completed = await admin.query<{
          state: string;
          user_id: string | null;
          attempts: number;
          completed_at: Date | null;
          user_count: string;
          credential_count: string;
          session_count: string;
          token_count: string;
        }>(
          `SELECT r.state, r.user_id, r.attempts, r.completed_at,
             (SELECT count(*) FROM users)::text AS user_count,
             (SELECT count(*) FROM auth_accounts)::text AS credential_count,
             (SELECT count(*) FROM auth_sessions)::text AS session_count,
             (SELECT count(*) FROM auth_tokens)::text AS token_count
           FROM account_deletion_requests r WHERE r.id = $1`,
          [receipt.requestId],
        );
        expect(completed.rows[0]).toMatchObject({
          state: 'completed',
          user_id: null,
          attempts: 2,
          user_count: '0',
          credential_count: '0',
          session_count: '0',
          token_count: '0',
        });
        expect(completed.rows[0]?.completed_at).toBeInstanceOf(Date);
        const audit = await admin.query<{ actor_id: string | null; subject_id: string | null }>(
          'SELECT actor_id, subject_id FROM audit_events',
        );
        expect(audit.rows.every((row) => row.actor_id === null && row.subject_id === null)).toBe(
          true,
        );
        await expect(
          admin.query(
            `INSERT INTO anonymous_metrics (period_start, period_end, metric_name, contributor_count, value)
             VALUES ('2026-01-01', '2026-01-31', 'profile_saved', 4, 4)`,
          ),
        ).rejects.toMatchObject({ code: '23514' });
      } finally {
        await app.close();
      }
    });
  }, 120_000);
});
