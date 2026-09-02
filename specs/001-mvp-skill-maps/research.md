# Phase 0 Research: MVP do SKILL MAPS

**Date**: 2026-09-01
**Spec**: [spec.md](spec.md)

## Application Architecture

**Decision**: Use a pnpm workspace monorepo with an independently deployable React single-page
application in `apps/web`, a Fastify REST API in `apps/api`, and generated client types in
`packages/api-contract`. Deploy the web application as static assets and the API as one stateless
service backed by managed PostgreSQL.

**Rationale**: One language and one workspace reduce setup and contract coordination cost while the
two applications preserve the Constitution's frontend/backend boundary. A static frontend and one API
instance are sufficient for the MVP scale; the API can add replicas later without changing contracts.

**Alternatives considered**: Next.js was rejected because server rendering and a second server tier do
not serve a demonstrated requirement. Separate repositories would increase version coordination.
Microservices, Redis, a broker, and Turborepo were rejected until measured scale requires them.

## Runtime and Frontend

**Decision**: Use Node.js 24 LTS, TypeScript 6.0, pnpm 11, React 19.2, Vite 8.2, React Router 8,
TanStack Query 5, React Hook Form 7, Zod 4, CSS Modules, and native HTML controls by default. Use
React Aria Components only for complex controls that native HTML cannot express adequately.

**Rationale**: The stack supports an interactive catalog, dashboard, administration forms, strict
typing, route-level loading/error states, and static delivery without SSR complexity. Platform CSS and
native controls provide a small, accessible baseline.

**Alternatives considered**: Vue 3 is a credible alternative if team expertise favors it. Angular was
rejected as disproportionate for the MVP. Full component suites, Redux, Tailwind, Storybook, and a
shared UI package are deferred until a concrete reuse or delivery need appears.

## Accessible Skill Maps

**Decision**: Treat WCAG 2.2 AA as the baseline. Represent each skill map as canonical structured data
and provide a semantic textual view using headings, lists, and relationship tables. A visual graph is
progressive enhancement and must expose the same filtering, inspection, ordering, and editing actions
through keyboard-operable non-visual controls.

**Rationale**: ARIA cannot make an opaque canvas or spatial graph equivalent to structured content.
A first-class textual representation satisfies keyboard, screen-reader, reflow, and non-spatial access
while keeping one domain source of truth.

**Alternatives considered**: Canvas-only rendering and visual graphs with labels but no equivalent
text were rejected. A graph-specific UI library may be evaluated during implementation only if it
preserves the canonical textual path and does not own domain rules.

## Backend and API Contract

**Decision**: Use Fastify 5 with TypeBox-compatible JSON Schema for request and response validation,
`@fastify/swagger` to generate OpenAPI 3.1, and RFC 9457 Problem Details for errors. The OpenAPI
document is the public contract and generates the frontend client and types.

**Rationale**: Fastify route schemas combine runtime validation, response serialization, type
inference, documentation, and fast in-process tests. One OpenAPI source prevents frontend/backend
drift and permits automated breaking-change checks.

**Alternatives considered**: NestJS provides stronger ceremony for larger teams but is unnecessary at
this scope. Express requires assembling validation, structure, logging, and documentation conventions.
tRPC was rejected because it weakens the independent HTTP contract. Handwritten clients and duplicated
interfaces were rejected as drift-prone.

## Authentication and Sessions

**Decision**: Use Better Auth behind an application-owned authentication facade for email/password,
email confirmation, password reset, and session lifecycle. Hash passwords with Argon2id. Store opaque
session identifiers in PostgreSQL and send them only in host-only `HttpOnly`, `Secure`, `SameSite=Lax`
cookies. Disable cookie session caching so protected requests verify a live session.

**Rationale**: Database sessions provide immediate revocation for logout, password reset, suspension,
and account deletion. The facade limits library coupling and keeps routes, errors, rate limits, and
OpenAPI under project control. Argon2id and one-time short-lived verification/reset tokens meet the
security rules without implementing identity primitives from scratch.

**Alternatives considered**: Self-contained JWTs were rejected because immediate revocation requires
additional state and protocol complexity. Custom authentication was rejected as high risk. Managed
identity is viable but adds vendor coupling and external deletion obligations not needed for the MVP.

## Browser Security and Authorization

**Decision**: Keep frontend and API under the same registrable site. Require exact CORS allowlists,
credentials-enabled requests, origin checks, and a CSRF token on state-changing requests. Apply
route-specific rate limits to registration, login, verification, password reset, account deletion, and
administrative actions. Enforce user ownership and the `content_admin` role in reusable API guards.

**Rationale**: CORS and `SameSite` alone are not complete CSRF defenses. Server-side role and ownership
checks prevent frontend guards or user-supplied roles from becoming security boundaries. In-process
rate limiting is adequate for one API instance and avoids adding Redis.

**Alternatives considered**: Browser-stored bearer tokens increase XSS impact. Wildcard CORS and
global permissive limits were rejected. A policy engine and distributed limiter are deferred until
permissions or replica count require them.

## Relational Storage and Query Layer

**Decision**: Use managed PostgreSQL 18 as the single system of record, Kysely with the `pg` driver for
typed queries, and reviewed forward-only migrations that can include native SQL for constraints,
triggers, and indexes. Use UUID primary keys for stable domain entities, identity `bigint` keys for
append-only events, composite keys for pure joins, and foreign keys for every relationship.

**Rationale**: The domain is relational and integrity-heavy. PostgreSQL supports transactions,
recursive validation, partial indexes, row locks, and `UNIQUE NULLS NOT DISTINCT`. Kysely retains SQL
control and aligns with the selected authentication adapter without a generated runtime client.

**Alternatives considered**: Prisma 7 is viable for a team already experienced with it but adds a
schema language and generated layer around advanced SQL. Drizzle remains viable after its current major
line stabilizes. Document and graph databases would weaken relational integrity. SQLite does not match
the concurrency and PostgreSQL-specific validation needs.

## Catalog Publication

**Decision**: Keep stable roots for catalog entities and immutable publication revisions. Publishing a
trail atomically creates a revision containing ordered steps, skill links, prerequisites, and
certification links, then updates the root's current published revision pointer. Stable step IDs persist
between revisions unless a step is repurposed.

**Rationale**: Users always read a complete current publication while historical progress events retain
the revision observed when recorded. New publications apply immediately, allow progress recalculation,
and still support change notices and historical explanations.

**Alternatives considered**: Updating published rows in place loses historical labels and rules.
Freezing each user on an enrollment snapshot contradicts the clarification. Global catalog snapshots
duplicate excessive data, and effective-date temporal rows complicate current reads.

## Progress, Concurrency, and Recommendations

**Decision**: Append every progress command to `progress_events` with an idempotency key, stream
version, observed trail revision, state, source, and timestamp. Update `user_step_state` and
`user_trail_state` projections in the same transaction. Serialize writes per user/trail using row
locks; preserve stale but distinct commands and flag version conflicts for review. Compute explainable
recommendations from versioned rules and structured reason codes.

**Rationale**: Events preserve corrections and history while projections keep dashboard reads simple.
Synchronous projection avoids eventual consistency and extra infrastructure. Idempotency and stream
locking preserve both concurrent events with one deterministic current state. Structured evidence
makes recommendation order testable and understandable.

**Alternatives considered**: Replaying the full event stream for every dashboard read will not scale as
history grows. Asynchronous CQRS, Kafka, and a dedicated event store add unjustified complexity. Mutable
progress rows alone violate the history requirement. Predictive recommendations are outside scope.

## Certification and Achievement History

**Decision**: Store each certification acquisition or renewal as a separate row and enforce duplicate
prevention over user, certification, obtained date, and nullable external identifier. Store one
achievement award per user/achievement and retain the definition revision used for the award.

**Rationale**: Separate rows preserve professional history and expiry changes. PostgreSQL's null-aware
uniqueness can reject retries even when the optional identifier is absent. Definition references keep
historical awards explainable after catalog changes.

**Alternatives considered**: Overwriting a current certification loses renewals. Keeping only the
latest valid record contradicts the clarification. Free-form achievement conditions without versioned
criteria are difficult to test.

## Account Erasure and Anonymous Metrics

**Decision**: On confirmed erasure, mark the account deletion-pending and revoke all sessions in one
transaction. Use a durable, idempotent deletion job to hard-delete credentials and all identifiable
child data as soon as practical, with an internal 24-hour target and a 30-day maximum. Retain only
pre-aggregated metrics with no user/event identifiers and suppress cells with fewer than five
contributors. Backup retention must not exceed the same 30-day boundary.

**Rationale**: Generic soft deletion retains personal data and does not satisfy the clarification.
Deleting sessions with the state transition blocks access immediately. A durable job supports retries
and evidence of completion across the database, email provider, logs, analytics, and restored backups.

**Alternatives considered**: Pseudonymous event rows, salted email hashes, and indefinite soft deletion
remain linkable and were rejected. Immediate best-effort deletion without a retry ledger cannot prove
completion. Per-user cryptographic erasure is disproportionate for the MVP.

## Testing and Quality Gates

**Decision**: Use Vitest 4 for unit tests, Testing Library for components, Fastify `inject()` plus
Testcontainers for PostgreSQL integration tests, Playwright for critical browser journeys, axe-core for
automated accessibility checks, and k6 for load tests. CI validates OpenAPI, generated clients,
migrations, authorization, security redaction, production builds, and critical desktop/mobile flows.

**Rationale**: Pure business rules stay fast to test, while PostgreSQL-specific constraints,
transactions, concurrency, cookies, CSRF, and browser behavior are validated at their real boundaries.
Automated accessibility is combined with keyboard and manual assistive-technology validation.

**Alternatives considered**: Mock-only persistence and SQLite substitutes cannot verify critical
database behavior. A large E2E-only suite is slow and brittle. Jest is viable but duplicates tooling
already supplied by the Vite ecosystem. Axe-only accessibility testing is incomplete.

## Performance, Reliability, and Observability

**Decision**: Interpret the two-second requirement as p95 time to meaningful catalog/dashboard content
under 500 active sessions, with HTTP failures below 1%. Use structured Pino logs, request IDs, separate
append-only audit events, OpenTelemetry traces/metrics, web-vitals, readiness/liveness checks, bounded
timeouts/retries, and managed PostgreSQL backups. Adopt provisional RPO <= 15 minutes, RTO <= 4 hours,
and 99.5% monthly availability excluding announced maintenance.

**Rationale**: User-facing measurements preserve the specification's technology-neutral outcome while
giving implementation and release tests explicit thresholds. Managed observability and backups avoid
self-hosting operational platforms. Health checks and bounded retries prevent dependency failures from
causing restart or retry storms.

**Alternatives considered**: CPU-only targets and aggregate API latency do not prove the user outcome.
Self-hosted observability and database operations add MVP burden. Higher availability targets require
cost and topology decisions not justified by the current scale.

## Deployment and Delivery

**Decision**: Build immutable frontend and API artifacts once, promote them through environments, run
migrations as a separate deployment job, and use expand/contract schema changes. Serve frontend assets
through a CDN, run the API in a managed Linux container platform, use managed PostgreSQL and a
transactional email provider, and store secrets in the platform secret manager.

**Rationale**: This topology scales the static frontend cheaply and keeps the API stateless. Separate
migrations avoid startup races. Managed infrastructure provides TLS, backups, health-based rolling
deployment, and secret handling without Kubernetes administration.

**Alternatives considered**: Kubernetes, self-managed databases, serverless functions, and blue/green
infrastructure are deferred until measured operational needs justify them. Automatic schema sync and
destructive down migrations were rejected as unsafe.
