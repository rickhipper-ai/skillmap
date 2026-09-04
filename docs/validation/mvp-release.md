# MVP release validation

Validation date: 2026-09-04

This document records evidence produced in the local development environment. `PASS` means the exact
command completed successfully. `NOT EXECUTED` is a release blocker and is not an approved exception.

## Automated product scenarios

| Scope                                                               | Evidence                                                                                    | Result |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| Account, profile, recovery, and erasure request                     | API integration/component suites and `us1-account-profile.spec.ts`                          | PASS   |
| Public catalog and accessible map                                   | Catalog PostgreSQL/API/component suites and `us2-catalog-map.spec.ts`                       | PASS   |
| Progress, corrections, concurrency, rebuild, and publication change | Progress PostgreSQL/API/component suites and `us3-progress.spec.ts`                         | PASS   |
| Dashboard and deterministic recommendations                         | Recommendation unit/integration/component suites and `us4-dashboard.spec.ts`                | PASS   |
| Certification renewal and achievement award                         | Credential/achievement unit/integration/component suites and `us5-credentials.spec.ts`      | PASS   |
| Catalog administration and publication                              | Administration PostgreSQL/API/component suites and `us6-administration.spec.ts`             | PASS   |
| Security boundaries                                                 | `security-regression.test.ts` plus all existing identity/authorization suites               | PASS   |
| Reliability boundaries                                              | `reliability.test.ts` with outage, timeout, pool, retry, lease recovery, and shutdown cases | PASS   |

Commands and totals:

```powershell
$env:SKILL_MAPS_DATABASE_TESTS='1'; corepack pnpm run ci
# PASS: API 70/70, database 11/11, web 32/32; format, lint, typecheck,
# OpenAPI validation, production API build, and production web build passed.

corepack pnpm test:e2e
# PASS: 30/30. US1-US6 ran in Chromium desktop/tablet/mobile. The release
# accessibility suite ran in Chromium, Firefox, and WebKit at all three viewports.

corepack pnpm exec playwright test tests/e2e/accessibility-responsive.spec.ts
# PASS: 9/9 projects, each checking nine critical routes for horizontal reflow and
# automated WCAG A/AA violations with axe.

$env:SKILL_MAPS_DATABASE_TESTS='1'; corepack pnpm --filter @skill-maps/api exec vitest run `
  tests/integration/security-regression.test.ts tests/integration/reliability.test.ts --maxWorkers=1
# PASS: 10/10.
```

The E2E journeys intercept fictitious API responses. Real PostgreSQL constraints, authentication,
authorization, CSRF, idempotency, concurrency, and transaction behavior are exercised separately by
the database-enabled API integration suites.

## Contract and supply chain

```powershell
corepack pnpm contract:generate
# PASS: checked-in OpenAPI client regenerated successfully.

docker run --rm --volume "${PWD}:/workspace:ro" `
  tufin/oasdiff@sha256:889d1f12b3b5efef41b741ddfea8c0dc06c7d6a5ff2ef9bdb31f5db3d39c54df `
  breaking /workspace/packages/api-contract/openapi.yaml /workspace/packages/api-contract/openapi.yaml
# PASS: OpenAPI 3.1 parsed and no changes detected. CI compares the pull-request base to the generated current contract.

corepack pnpm audit --prod --audit-level high
# PASS: no known vulnerabilities found.
```

The GitHub-only secret scan, dependency review, CodeQL, SBOM upload, and Trivy jobs are configured in
`.github/workflows/security.yml` but have not run against this uncommitted worktree.

## Containers

```powershell
docker build --pull -t skill-maps-api:validation -f apps/api/Dockerfile .
docker build --pull -t skill-maps-web:validation -f apps/web/Dockerfile .
# PASS: both builds completed from the frozen lockfile and digest-pinned bases.
```

- API configured user: `node`; web configured user: `101`.
- API `/health/live`: `200 {"status":"ok"}` with an unavailable database.
- API `/health/ready`: `503` with an unavailable database, without dependency details.
- Web `/health/live`: `200 {"status":"ok"}` without requiring DNS resolution of the API upstream.
- Web SPA fallback `/catalogo`: `200`.

## Restore and erasure replay

The local drill restored a custom-format PostgreSQL 18 backup taken before the erasure request. The
backup contained an active target user, account, and session; the encrypted-ledger fixture supplied the
request/user UUID pair during the isolated restore.

```text
Outcome: PASS
Backup SHA-256: f8483896dfe393642eb0b629434fb58008301c9217e06a11fc8f9ca54b96627f
Backup age: 0.237 minutes (required <= 15)
Restore and replay: 9.876 seconds (required <= 4 hours)
Erasure entries replayed: 1
Incomplete ledger rows: 0
Identifiable rows: 0
Network: none
PostgreSQL image: sha256:d3e1620b530c944afa6e887d22eb899824da68e19c52024bf98f5220c88a65b2
```

This proves the script and local recovery path, not managed backup freshness or production RPO/RTO.

## Load plan

```powershell
corepack pnpm test:load:inspect
# PASS: k6 accepted the load/spike/soak/browser plan, 300 catalog plus 200 dashboard
# sessions, p95 <= 2 seconds, failure rate < 1%, and browser vital thresholds.
```

The official 500-distinct-session run is `NOT EXECUTED`. It requires an authorized production-equivalent
staging environment, 200 isolated dashboard sessions, monitoring access, and an approved load window.
Owner: performance/platform owner. Required before release; no exception is approved.

## Manual and staging evidence

The following quickstart evidence is `NOT EXECUTED`:

- Keyboard-only exploratory review, 400% zoom, text scaling, forced colors, and reduced motion.
- NVDA with a supported desktop browser and VoiceOver with Safari.
- Real phone and tablet checks in portrait and landscape.
- Staging TLS, CSP, CORS allowlist, cookie attributes, security headers, and proxy behavior.
- Low-rate staging synthetic registration, catalog, login, dashboard, and progress checks.
- Managed backup freshness, production-equivalent RPO/RTO, alert routing, and observability dashboards.
- GitHub security workflow execution and artifact review.

Owners: accessibility owner for assistive technology and reflow; platform/security owners for staging,
load, backup, and workflow evidence. All are required before release. No exception is approved.

## Release decision

Local automated validation is green. Release approval remains blocked because Scenario 8 staging
controls, the official performance/reliability environment checks, and the manual release evidence have
not been executed. Consequently T133 remains incomplete.
