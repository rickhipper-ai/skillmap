# Implementation Plan: MVP do SKILL MAPS

**Branch**: `001-mvp-skill-maps` | **Date**: 2026-09-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-mvp-skill-maps/spec.md`

## Summary

Build the SKILL MAPS MVP as a TypeScript monorepo with an independently deployable React web
application, a Fastify REST API, and PostgreSQL. The product covers verified accounts and professional
profiles, a versioned skill/trail/certification catalog, append-only progress history with synchronous
current-state projections, explainable recommendations, certification renewals, achievements, content
administration, and account erasure.

The architecture deliberately keeps one frontend, one API, one relational database, and one generated
OpenAPI client. Static frontend delivery, a stateless API, database-backed sessions, managed services,
and no Redis/broker/microservices satisfy the MVP while preserving a clear growth path.

## Technical Context

**Language/Version**: TypeScript 6.0 on Node.js 24 LTS; SQL for PostgreSQL-specific migrations and
constraints

**Primary Dependencies**: pnpm 11 workspace; React 19.2, Vite 8.2, React Router 8, TanStack Query 5,
React Hook Form 7, Zod 4, Fastify 5, TypeBox, `@fastify/swagger`, Better Auth, Kysely, `pg`, Pino,
OpenTelemetry

**Storage**: Managed PostgreSQL 18 for domain data, credentials, opaque sessions, catalog revisions,
progress events/projections, audit events, and deletion jobs; no cache, broker, graph database, or
separate event store for the MVP

**Testing**: Vitest 4, Testing Library, Fastify `inject()`, Testcontainers with PostgreSQL 18,
Playwright, axe-core, OpenAPI validation/diff checks, and k6

**Target Platform**: Current evergreen desktop/mobile browsers for the static web app; managed Linux
container platform for the API; managed PostgreSQL and transactional e-mail provider

**Project Type**: Web application with separate frontend, backend API, database migrations, generated
API contract package, and cross-application E2E/load tests

**Performance Goals**: Catalog and dashboard meaningful content p95 <= 2 seconds at 500 active
sessions; HTTP failure rate < 1%; Core Web Vitals targets LCP <= 2.5 seconds, INP <= 200 ms, and
CLS <= 0.1 at p75

**Constraints**: WCAG 2.2 AA; desktop/tablet/mobile and keyboard operation; immediate session
revocation; no authenticated access before e-mail confirmation; Argon2id password hashes; CSRF and
strict origin protection; identifiable-data erasure internal target <= 24 hours and hard deadline
<= 30 days; progress events immutable except privileged user erasure; current catalog publication
applies immediately; provisional availability 99.5% monthly, RPO <= 15 minutes, RTO <= 4 hours

**Scale/Scope**: Up to 10,000 registered users, 500 active sessions, 1,000 skills, 200 trails,
500 certifications, trail graphs up to 200 steps, one content-administrator role, and Portuguese-only
MVP content

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle / Rule | Pre-Design | Post-Design | Evidence |
|---|---|---|---|
| I. Simplicidade | PASS | PASS | One web app, one API, one database; no speculative distributed infrastructure |
| II. Experiencia do Usuario | PASS | PASS | Explicit dashboard next step, route states, responsive and usability validation |
| III. Arquitetura | PASS | PASS | Separate `apps/web`, `apps/api`, `database`, and contract package with domain modules |
| IV. Qualidade de Codigo | PASS | PASS | Feature modules, strict types, lint/type gates, small shared contract boundary |
| V. Banco de Dados | PASS | PASS | PK/FK/unique/check constraints, normalized joins, reviewed migrations, safe recovery |
| VI. Seguranca | PASS | PASS | Argon2id, secure opaque sessions, CSRF/origin guards, validation, secret manager, RBAC |
| VII. API | PASS | PASS | REST resources, correct HTTP methods, OpenAPI 3.1, RFC 9457 errors, versioned `/v1` |
| VIII. Responsividade | PASS | PASS | CSS reflow and Playwright desktop/tablet/mobile release matrix |
| IX. Acessibilidade | PASS | PASS | WCAG 2.2 AA, semantic text map, keyboard, axe, screen-reader/manual checks |
| X. Testes | PASS | PASS | Unit, PostgreSQL integration, contract, browser, accessibility, security, and load layers |
| XI. Git | PASS | PASS | Git is required before source implementation; secrets/generated/local artifacts are ignored |
| XII. Documentacao | PASS | PASS | Spec, research, model, OpenAPI, quickstart, implementation README and ADR requirement |
| Domain rules | PASS | PASS | All constitutional entities, ordered trails, many-to-many skills, history, extensibility modeled |
| Development flow | PASS | PASS | Specification and clarification complete; plan ends at Phase 1 before tasks/implementation |

No Constitution exception or complexity waiver is required. The workspace currently has no
application source or Git metadata; Git initialization is a required setup task before the first
implementation commit and does not block design completion.

## Project Structure

### Documentation (this feature)

```text
specs/001-mvp-skill-maps/
|-- plan.md
|-- research.md
|-- data-model.md
|-- quickstart.md
|-- contracts/
|   |-- README.md
|   `-- openapi.yaml
|-- checklists/
|   `-- requirements.md
`-- tasks.md                 # Created by /speckit.tasks, not by this plan
```

### Source Code (repository root)

```text
apps/
|-- web/
|   |-- src/
|   |   |-- app/             # Bootstrap, providers, router, route errors, focus management
|   |   |-- routes/          # Route-level pages and data boundaries
|   |   |-- features/
|   |   |   |-- identity/
|   |   |   |-- profile/
|   |   |   |-- catalog/
|   |   |   |-- skill-map/
|   |   |   |-- progress/
|   |   |   |-- dashboard/
|   |   |   |-- credentials/
|   |   |   `-- administration/
|   |   |-- components/      # Reused presentational/interaction components only
|   |   |-- services/        # Generated API client adapters and error translation
|   |   `-- styles/          # Tokens, global foundations, responsive/accessibility rules
|   `-- tests/               # Component and route-level tests
`-- api/
    |-- src/
    |   |-- app.ts           # Fastify composition without network binding
    |   |-- server.ts        # Process lifecycle and graceful shutdown
    |   |-- config/          # Validated environment configuration
    |   |-- plugins/         # Database, auth, security, contracts, logging, telemetry
    |   `-- modules/
    |       |-- identity/
    |       |-- profiles/
    |       |-- catalog/
    |       |-- progress/
    |       |-- recommendations/
    |       |-- credentials/
    |       |-- achievements/
    |       |-- administration/
    |       |-- erasure/
    |       `-- audit/
    `-- tests/
        |-- unit/
        |-- integration/
        `-- contract/

database/
|-- migrations/             # Forward-only reviewed migrations and native constraints
|-- seeds/                  # Fictitious development/test catalog
`-- tests/                  # Migration, constraint, role, trigger, restore invariants

packages/
`-- api-contract/
    |-- openapi.yaml         # Generated/validated runtime contract snapshot
    `-- src/generated/       # Generated frontend client and public types

tests/
|-- e2e/                    # Playwright cross-application journeys and accessibility
|-- load/                   # k6 catalog/dashboard/security-safe workloads
`-- fixtures/               # Fictitious deterministic cross-application data

docs/
`-- adr/                    # Architecture decisions with context and consequences

docker-compose.yml          # Local PostgreSQL and transactional mail viewer only
pnpm-workspace.yaml
package.json
README.md
```

**Structure Decision**: Use a pnpm monorepo because frontend and backend are released independently
but share one reviewed OpenAPI contract and one delivery workflow. Domain code remains inside the
owning application; `packages/api-contract` is the only initial shared package. Database migrations
are a separate root concern so they run once as a deployment job rather than during API startup.

## Phase 0: Research Outcome

[research.md](research.md) resolves every Technical Context decision and records rationale and rejected
alternatives. Key outcomes are:

- Client-rendered React/Vite application instead of SSR.
- Fastify schema-driven REST API and generated OpenAPI client.
- PostgreSQL-backed opaque sessions and Better Auth facade instead of self-contained JWTs.
- PostgreSQL/Kysely with native reviewed migrations instead of graph/document storage.
- Immutable catalog revisions plus append-only progress events and synchronous projections.
- Managed deployment services without Redis, broker, microservices, or Kubernetes.

All Technical Context unknowns are resolved.

## Phase 1: Design Outcome

- [data-model.md](data-model.md) defines identity, catalog revisions, trail DAG constraints, progress
  streams/projections, renewals, achievements, recommendations, audits, erasure, lifecycle transitions,
  and migration/index rules.
- [contracts/openapi.yaml](contracts/openapi.yaml) defines the versioned browser/API interface,
  authorization boundary, CSRF and idempotency headers, RFC 9457 errors, catalog/progress/dashboard
  resources, and administrative publication operations.
- [quickstart.md](quickstart.md) defines local setup commands and acceptance evidence for functional,
  accessibility, concurrency, security, erasure, performance, backup, and release validation.

Post-design review confirms that all Constitution gates still pass. Catalog revisioning and progress
projections add only complexity required by immediate publication changes, explainability, and immutable
history. They remain synchronous and inside one database transaction, avoiding distributed CQRS.

## Complexity Tracking

No Constitution violations require justification.
