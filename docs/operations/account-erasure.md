# Account erasure operations

## Guarantees and states

Confirmation requires an active session authenticated in the previous 15 minutes plus the current
password. One transaction changes the user to `deletion_pending`, revokes every session, creates the
deletion request, and enqueues its idempotent job. Protected routes then deny the account immediately.

The API process polls database-backed jobs every `JOB_POLL_INTERVAL_MS`. Claims use `FOR UPDATE SKIP
LOCKED`; a worker that disappears leaves a lease which another worker reclaims after five minutes.
Provider cleanup is retried with bounded exponential delay. The database completion function cascades
identifiable rows, tombstones actor references, and marks the request completed atomically.

- Internal completion target: 24 hours from `requested_at`.
- Hard deadline: no later than 30 days from `requested_at`.
- Anonymous metrics may be retained only with approved dimensions and at least five contributors.

## Monitoring queries

Run with an audited read-only operational role. Query outputs contain request UUIDs and timing metadata;
restrict them as operational data.

```sql
SELECT state, count(*) AS requests,
       max(now() - requested_at) AS oldest_age
FROM account_deletion_requests
GROUP BY state
ORDER BY state;

SELECT id, state, requested_at, target_at, deadline_at, attempts, last_error_code
FROM account_deletion_requests
WHERE state <> 'completed'
  AND (target_at <= now() + interval '6 hours'
       OR deadline_at <= now() + interval '7 days')
ORDER BY deadline_at;

SELECT id, status, attempts, max_attempts, available_at, locked_at, last_error_code
FROM background_jobs
WHERE job_type = 'account_erasure' AND status <> 'completed'
ORDER BY available_at;
```

Do not select user e-mail, provider payloads, auth records, or free-form request data during routine
monitoring.

## Retry and incident handling

1. Confirm API readiness, job polling logs, queue age, and database pool health.
2. Confirm the provider dependency status without printing the job payload.
3. Let eligible retries run normally. Do not create a second request or edit attempt counts.
4. For a job stranded in `running`, wait for lease recovery; verify an attempt with
   `worker_lease_expired` appears. Do not directly mark the deletion completed.
5. If the deadline is at risk, page the privacy incident commander and API owner. Record the request
   UUID, timestamps, error code, actions, and approvals, but no e-mail or credential.
6. A manual database action requires a reviewed incident procedure and transaction-level evidence. The
   only valid completion path is `complete_account_erasure(request_uuid)` after provider cleanup.

## Completion verification

Verify `state = 'completed'`, `user_id IS NULL`, a completion timestamp, a completed background job,
and no active alert. Audit actor/subject links must be null or approved tombstones and metadata must
remain identifier-free. Run the focused automated suite:

```powershell
$env:SKILL_MAPS_DATABASE_TESTS='1'
corepack pnpm test:integration -- account-erasure security-regression reliability
```

Backup restoration is a separate mandatory control: replay the independently retained completed
request ledger before restored data can receive traffic. Follow
[`disaster-recovery.md`](disaster-recovery.md) monthly and after backup-system changes.
