# Constitution review

Review date: 2026-09-04

Status: locally conformant, release blocked on external evidence. No exception has been requested or
approved, so there is no exception expiry to record.

| Principle            | Evidence                                                                                            | Status                                   |
| -------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| I. Simplicity        | One Fastify API, one React SPA, PostgreSQL, database-backed jobs; no rejected infrastructure added  | PASS                                     |
| II. User experience  | Story component/E2E tests cover loading, error, empty, progress, recommendation, and admin actions  | PASS locally                             |
| III. Architecture    | Domain, persistence, routes, and UI remain separated by module                                      | PASS                                     |
| IV. Code quality     | Prettier, ESLint, TypeScript, focused modules, generated contract                                   | PASS                                     |
| V. Database          | Migrations 0001-0008, PK/FK/checks, immutable history, concurrency and restore tests                | PASS locally                             |
| VI. Security         | Better Auth, Argon2id, CSRF/CORS, authorization, redaction, audit, supply-chain workflow            | PASS locally; GitHub/staging pending     |
| VII. API             | Canonical OpenAPI 3.1, generated client, runtime contract tests, incompatible-diff CI               | PASS                                     |
| VIII. Responsiveness | Chromium desktop/tablet/mobile journeys and nine-project release reflow matrix                      | PASS automated; real devices pending     |
| IX. Accessibility    | Semantic/component axe tests and nine-project Playwright axe matrix                                 | PASS automated; AT/manual review pending |
| X. Tests             | API 70, database 11, web 32, E2E 30 all pass                                                        | PASS                                     |
| XI. Git              | No secrets in fixtures; generated/local artifacts ignored; no commit was created by this validation | PASS locally; CI secret scan pending     |
| XII. Documentation   | README, operations guides, ADRs, and release evidence updated                                       | PASS                                     |

## Gate results

- `SKILL_MAPS_DATABASE_TESTS=1 corepack pnpm run ci`: PASS.
- Full story and accessibility E2E: PASS, 30/30.
- OpenAPI generation, validation, and OAS 3.1 diff command: PASS.
- Production dependency audit: PASS, no known vulnerabilities.
- API and web image builds, non-root users, liveness/readiness, and SPA fallback: PASS.
- Isolated pre-erasure backup restore and ledger replay: PASS.
- k6 500-session plan parsing and thresholds: PASS.
- Official 500-session staging execution: NOT EXECUTED.
- GitHub security workflow: NOT EXECUTED for the uncommitted worktree.
- Screen-reader, real-device, zoom/forced-colors, and staging control reviews: NOT EXECUTED.

## Blocking owners

| Evidence required                                                  | Owner                      | Due            | Approved exception |
| ------------------------------------------------------------------ | -------------------------- | -------------- | ------------------ |
| NVDA, VoiceOver, zoom, forced colors, reduced motion, real devices | Accessibility owner        | Before release | No                 |
| 500-session load/spike/soak and browser p75 results                | Performance/platform owner | Before release | No                 |
| TLS, headers, cookie, CORS, proxy, and synthetic staging checks    | Security/platform owner    | Before release | No                 |
| Managed backup freshness, alert routing, production RPO/RTO        | Database/platform owner    | Before release | No                 |
| GitHub secret/dependency/CodeQL/SBOM/Trivy workflow                | Security owner             | Before release | No                 |

## Decision

No Constitution exception is active. The code may be reviewed, but release acceptance remains blocked
until every `NOT EXECUTED` item has evidence or an explicit exception with named approver,
justification, risk, and expiry. T134 remains incomplete because those release gates are still open.
