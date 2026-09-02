# Quickstart and Validation Guide: MVP do SKILL MAPS

**Spec**: [spec.md](spec.md)
**Data model**: [data-model.md](data-model.md)
**API contract**: [contracts/openapi.yaml](contracts/openapi.yaml)

This guide defines the commands and end-to-end evidence required once implementation tasks are
complete. It intentionally contains no application implementation code.

## Prerequisites

- Node.js 24 LTS
- Corepack with pnpm 11 enabled
- Docker Engine with Compose support
- Available ports for the web app, API, PostgreSQL, and local mail viewer
- No real credentials in local environment files

## Local Setup

From the repository root:

```powershell
corepack enable
pnpm install --frozen-lockfile
docker compose up -d postgres mailpit
pnpm db:migrate
pnpm db:seed:mvp
pnpm dev
```

The implementation README must document the actual local URLs and every required environment variable.
The seed command must create only fictitious data, including one content administrator, one normal
user, categories, skills, a five-step trail, a certification, requirements, and basic achievements.

## Fast Validation

Run these gates before opening a review:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:integration
pnpm contract:check
pnpm build
pnpm test:e2e:critical
pnpm test:a11y
```

Expected outcome: every command exits successfully, generated API client files have no uncommitted
diff, and the OpenAPI check reports no undocumented responses or unapproved breaking changes.

## Scenario 1: Account Activation and Profile

1. Open the registration page using only the keyboard.
2. Register a new fictitious e-mail and accept the terms.
3. Confirm that no authenticated session exists before e-mail verification.
4. Open the local mail viewer, follow the single-use verification flow, and sign in.
5. Complete and edit display name, current role, desired role, experience level, and interests.
6. Sign out and sign in again.

Expected outcomes:

- Duplicate or malformed registration data returns field-specific, safe errors.
- Verification is required, expires as configured, and cannot be reused.
- Profile changes persist and another user cannot read or change them.
- Cookies are `HttpOnly`, `Secure` outside local development, host-only, and `SameSite=Lax`.

## Scenario 2: Catalog and Accessible Map

1. Browse the published catalog as a visitor.
2. Search by term and filter by category and item type.
3. Open a skill linked to multiple trails, a trail, and a certification.
4. Navigate the complete flow at desktop, tablet, and mobile widths.
5. Navigate with keyboard and inspect the textual map alternative with a screen reader.

Expected outcomes:

- Empty, loading, success, and error states are distinct and actionable.
- One canonical skill appears in every related trail without duplicated records.
- Trail steps are ordered and expose skills, prerequisites, and certifications.
- The textual map exposes the same information/actions as the visual enhancement.
- Automated axe scans report no new WCAG 2.2 A/AA violations.

## Scenario 3: Catalog Administration and Publication

1. Sign in as the seeded content administrator.
2. Create a category, a skill, and a draft trail with ordered steps.
3. Attempt to add a self-prerequisite and a multi-step cycle.
4. Correct the graph, associate the skill and certification, and publish the trail.
5. Sign in as a normal user and attempt the same administrative calls.

Expected outcomes:

- Invalid/dangling/cyclic relationships fail without partial writes.
- Publication creates one complete immutable revision and makes it visible atomically.
- The normal user receives a standardized authorization problem and no catalog change occurs.
- Administrative actions produce redacted audit events.

## Scenario 4: Progress, Correction, and Concurrency

1. Start the published trail and complete its first eligible step.
2. Attempt to complete a step whose prerequisite is pending.
3. Correct the first step to an earlier state, then complete it again.
4. Send the same command twice with one idempotency key.
5. Send two different commands concurrently from the same base stream version.
6. Rebuild projections from the event stream in the integration test environment.

Expected outcomes:

- Prerequisites block invalid completion and identify pending steps.
- Corrections append events; no previous event is updated or deleted.
- A repeated command produces one event and the same result.
- Distinct concurrent commands remain in order, one current state is deterministic, and the stream is
  flagged for review when required.
- Rebuilt projections exactly match the stored current state.

Focused command:

```powershell
pnpm test:integration -- progress-history progress-concurrency projection-rebuild
```

## Scenario 5: Current Publication Recalculation

1. Start a trail and complete enough required steps to produce a non-zero percentage.
2. As administrator, publish a new revision that adds or reorders a required step.
3. Reopen the user's dashboard and trail progress.

Expected outcomes:

- The latest publication is used immediately.
- Percentage, eligibility, and primary next step are recalculated.
- A catalog-change notice is visible.
- Historical events retain the observed revision and remain chronologically consistent.

## Scenario 6: Recommendations

1. Validate a user with an active trail and at least one eligible step.
2. Validate a user without an active trail but with desired role and interests.
3. Repeat both reads without changing profile, progress, rules, or catalog.

Expected outcomes:

- The active-trail user receives one primary next eligible step.
- The other user receives one primary trail and no more than two ordered alternatives.
- Every recommendation has a structured reason and plain-language explanation.
- Identical versioned inputs produce identical order.

## Scenario 7: Certification Renewal and Achievement

1. Register a self-declared certification acquisition.
2. Retry the same certification/date/identifier with the same and a new idempotency key.
3. Register a renewal with a later obtained date.
4. Trigger one published achievement criterion twice.

Expected outcomes:

- The exact acquisition is stored once and duplicate input identifies the existing record.
- The renewal is a separate record and older acquisitions remain unchanged.
- The achievement is awarded once with its original definition revision and date.
- No record claims issuer verification.

## Scenario 8: Security Boundaries

Run the focused security suite:

```powershell
pnpm test:integration -- authentication authorization csrf rate-limit redaction
pnpm test:e2e -- auth-security
```

It must prove:

- Unverified, inactive, expired-session, and deletion-pending users cannot access protected routes.
- User A cannot read or modify User B's profile, progress, credentials, or achievements.
- Ordinary users cannot invoke administrator operations.
- Missing/invalid CSRF tokens and disallowed origins are rejected on state-changing requests.
- Reset responses do not reveal account existence and resetting revokes existing sessions.
- Passwords, cookies, tokens, personal request bodies, and internal exceptions never appear in responses
  or logs.

## Scenario 9: Account Erasure

1. Create an active user with profile, sessions, progress, certification records, and achievements.
2. Confirm account erasure with recent authentication.
3. Attempt access from the current and a second browser session.
4. Run the deletion worker with injected failures and retries.
5. Validate the completed state and anonymous metric output.

Expected outcomes:

- Account status changes and all sessions are revoked in one transaction.
- Every protected request is denied immediately.
- The workflow retries idempotently and alerts before the 30-day deadline.
- Credentials and identifiable rows are absent after completion.
- Retained aggregates contain no user/event identifiers and suppress groups below five contributors.
- Restored-backup validation reapplies completed erasures before data exposure.

Focused command:

```powershell
pnpm test:integration -- account-erasure erasure-retry erasure-restored-backup
```

## Performance and Reliability Validation

Against a production-equivalent staging environment seeded to the volumes in the specification:

```powershell
pnpm test:load --scenario catalog-dashboard-500
```

Required thresholds:

- Catalog and dashboard readiness each achieve p95 <= 2 seconds with 500 active sessions.
- HTTP failure rate remains below 1%.
- No sustained database-pool exhaustion occurs and the service returns to baseline after the run.
- LCP <= 2.5 seconds, INP <= 200 ms, and CLS <= 0.1 at p75 for the sampled browser cohort.

Before release, also verify detail-free liveness/readiness checks, graceful shutdown, database timeout
behavior, backup freshness, a successful isolated restore, provisional RPO <= 15 minutes, and
RTO <= 4 hours.

## Manual Release Evidence

- Keyboard-only review of all critical flows with no trap and visible focus.
- 400% zoom/reflow, forced colors, reduced motion, and text scaling.
- NVDA with a supported desktop browser and VoiceOver with Safari.
- Representative real phone and tablet checks in portrait and landscape.
- Security headers, TLS, CORS allowlist, cookie attributes, and CSP verified in staging.
- Low-rate synthetic registration, catalog, login, dashboard, and progress checks after deployment.
- README and architecture decision records match the released configuration.
