# Observability and availability

## Signals implemented by the application

- API logs are structured Pino JSON. Fastify request logs include the request ID; a valid incoming
  `x-request-id` of at most 128 characters is retained and other values are replaced with a UUID.
- Authorization, authentication, catalog administration, and erasure milestones are also recorded in
  append-only `audit_events` with bounded metadata.
- Password, secret, token, e-mail, authorization, cookie, and `set-cookie` paths are redacted. Logs and
  traces must never receive request bodies or raw database errors.
- The API starts the OpenTelemetry Node SDK with `OTEL_SERVICE_NAME`. Configure an OTLP exporter through
  the standard OpenTelemetry environment variables supplied by the deployment secret/configuration
  system; the repository does not contain an exporter credential.
- The web app emits CLS, INP, and LCP through `web-vitals`. The dashboard also emits
  `dashboard_view_ready` as a performance mark and `skillmaps:dashboard-view-ready` event.
- `/health/live` proves the process event loop can answer without querying dependencies.
  `/health/ready` executes a bounded `SELECT 1` and returns only `ready` or `unavailable`.

Telemetry collection backends, dashboards, paging integrations, and production SLO approval are
environment responsibilities and cannot be proven by local tests.

## Required production metrics

The platform owner must derive or export these without high-cardinality user IDs, e-mails, tokens, raw
URLs with identifiers, or request bodies:

- request count, duration histogram, and status class by normalized route and method;
- readiness failures, process restarts, event-loop lag, CPU, memory, and container saturation;
- PostgreSQL connection utilization, acquisition timeout count, query timeout count, transaction
  duration, deadlocks, replication lag, backup age, and storage saturation;
- background jobs by type/status, oldest available job age, attempt count, expired lease count, and
  dead-letter count;
- account-erasure requests by state and age-to-target/deadline;
- browser LCP, INP, CLS, and `dashboard_view_ready` duration by release and coarse device class.

## 99.5% availability objective

Measure monthly successful eligible requests divided by all eligible requests. Exclude `/health/*`,
explicit client validation failures, authentication/authorization denials, and approved maintenance;
include server errors, dependency failures, and timeouts. A 99.5% monthly objective allows about 3 hours
39 minutes of unavailable time in a 31-day month. This objective remains provisional until the service
owner approves the production SLI query and alert routing.

## Alerts

| Condition                 |                                     Initial trigger | Owner                      | Response                                                                       |
| ------------------------- | --------------------------------------------------: | -------------------------- | ------------------------------------------------------------------------------ |
| Readiness unavailable     |                   3 consecutive probes or 2 minutes | API on-call                | Check database reachability, pool, and migrations; do not restart-loop blindly |
| Eligible 5xx/timeout burn |          2% for 15 minutes or fast/slow burn policy | API on-call                | Correlate normalized route, release, traces, and database signals              |
| Pool saturation           |    >= 90% for 10 minutes or any acquisition timeout | API/database on-call       | Find long transactions and query regressions; scale only after diagnosis       |
| Background queue          |                   Oldest available job > 15 minutes | API on-call                | Check worker poll failures and stale leases                                    |
| Erasure internal target   |                    Any open request age >= 18 hours | Privacy and API on-call    | Triage before the 24-hour target                                               |
| Erasure hard deadline     |          Any open request within 7 days of deadline | Privacy incident commander | Page immediately and preserve evidence                                         |
| Backup freshness          |                Latest validated backup > 15 minutes | Database on-call           | Restore RPO before release/traffic changes                                     |
| Web vitals                | LCP p75 > 2.5 s, INP p75 > 200 ms, or CLS p75 > 0.1 | Web owner                  | Compare by release/device and roll back regressions                            |

Alert thresholds are starting values. Changes require a linked incident or measured baseline, an owner,
and dashboard/query review.

## Triage commands

```powershell
Invoke-RestMethod https://api.example.invalid/health/live
Invoke-RestMethod https://api.example.invalid/health/ready
docker logs --since 15m <api-container> 2>&1
```

Use the deployment log and trace backend in real environments. Never paste production logs into public
tickets before checking redaction. For restore evidence use
[`disaster-recovery.md`](disaster-recovery.md); for deletion operations use
[`account-erasure.md`](account-erasure.md).
