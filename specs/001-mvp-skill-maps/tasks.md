---

description: "Executable task list for the SKILL MAPS MVP"
---

# Tasks: MVP do SKILL MAPS

**Input**: Design documents from `/specs/001-mvp-skill-maps/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`

**Tests**: Tests are required by the Constitution for critical behavior, business rules, database
integrity, contracts, accessibility, security, and regressions. In every user-story phase, create the
listed tests first and confirm they fail for the expected reason before implementation.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated as an
independent increment. Exact source paths follow `plan.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it uses different files and has no incomplete dependency.
- **[Story]**: Maps the task to a user story from `spec.md`.
- Setup, foundational, and polish tasks intentionally have no story label.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the repository, workspace, applications, quality tools, and local services.

- [X] T001 Initialize Git metadata and secret-safe ignore rules in `.git/` and `.gitignore`
- [X] T002 Create the pnpm workspace and root scripts in `package.json` and `pnpm-workspace.yaml`
- [X] T003 [P] Scaffold the React/Vite package and scripts in `apps/web/package.json`, `apps/web/index.html`, and `apps/web/tsconfig.json`
- [X] T004 [P] Scaffold the Fastify package and scripts in `apps/api/package.json` and `apps/api/tsconfig.json`
- [X] T005 [P] Create the OpenAPI code-generation package in `packages/api-contract/package.json` and `packages/api-contract/openapi.yaml`
- [X] T006 [P] Configure shared TypeScript, ESLint, Prettier, and editor settings in `tsconfig.base.json`, `eslint.config.js`, `.prettierrc.json`, and `.editorconfig`
- [X] T007 [P] Configure local PostgreSQL 18, Mailpit, and fictitious environment defaults in `docker-compose.yml`, `.env.example`, `apps/api/.env.example`, and `apps/web/.env.example`
- [X] T008 [P] Configure Vitest and Playwright projects in `vitest.workspace.ts`, `playwright.config.ts`, `apps/api/vitest.config.ts`, and `apps/web/vitest.config.ts`
- [X] T009 [P] Add initial format, lint, typecheck, test, contract, and build gates in `.github/workflows/ci.yml`
- [X] T010 [P] Create the project overview and decision-record structure in `README.md` and `docs/adr/README.md`

**Checkpoint**: The empty monorepo installs, typechecks, and exposes runnable placeholder web/API test projects.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build cross-story infrastructure that MUST be complete before any user story implementation.

**CRITICAL**: No user-story implementation starts until this phase passes its foundation tests.

### Foundation Tests

- [X] T011 [P] Create failing migration, runtime-role, FK, and rollback smoke tests in `database/tests/foundation.integration.test.ts`
- [X] T012 [P] Create failing API health, RFC 9457 error, OpenAPI exposure, CORS, and CSRF tests in `apps/api/tests/integration/foundation.test.ts`
- [X] T013 [P] Create failing semantic shell, route-error, focus-management, and axe tests in `apps/web/tests/app-shell.test.tsx`

### Foundation Implementation

- [X] T014 Create PostgreSQL extensions, application/migration roles, audit primitives, and migration ledger in `database/migrations/0001_foundation.sql`
- [X] T015 Implement Kysely connection ownership and the forward-only migration command in `apps/api/src/plugins/database.ts` and `apps/api/src/commands/migrate.ts`
- [X] T016 [P] Implement strict environment validation with no secret defaults in `apps/api/src/config/environment.ts` and `apps/web/src/app/environment.ts`
- [X] T017 [P] Implement redacted Pino logging, request IDs, OpenTelemetry bootstrap, and web-vitals hooks in `apps/api/src/plugins/observability.ts` and `apps/web/src/app/observability.ts`
- [X] T018 Implement Fastify composition, process lifecycle, graceful shutdown, and detail-free health routes in `apps/api/src/app.ts`, `apps/api/src/server.ts`, and `apps/api/src/modules/health/routes.ts`
- [X] T019 [P] Implement RFC 9457 error translation and field-validation details in `apps/api/src/plugins/problem-details.ts`
- [X] T020 [P] Implement TypeBox schema registration and OpenAPI 3.1 generation in `apps/api/src/plugins/openapi.ts`
- [X] T021 [P] Implement exact-origin CORS, CSRF validation, security headers, and route limit primitives in `apps/api/src/plugins/security.ts`
- [X] T022 Implement the Better Auth PostgreSQL adapter, Argon2id hashing, opaque cookies, and session-cache disabling in `apps/api/src/plugins/auth.ts`
- [X] T023 Implement active-user, ownership, and `content_admin` authorization guards in `apps/api/src/plugins/authorization.ts`
- [X] T024 [P] Implement a database-backed idempotent job runner with retry metadata in `apps/api/src/plugins/jobs.ts`
- [X] T025 [P] Implement the React application shell, providers, route boundaries, title updates, and main-heading focus in `apps/web/src/app/App.tsx`, `apps/web/src/app/router.tsx`, and `apps/web/src/app/providers.tsx`
- [X] T026 [P] Implement responsive tokens, visible focus, forced-colors, reduced-motion, and reflow foundations in `apps/web/src/styles/tokens.css` and `apps/web/src/styles/global.css`
- [X] T027 [P] Generate the typed API client and implement Problem Details mapping in `packages/api-contract/src/generated/` and `apps/web/src/services/api-client.ts`
- [X] T028 Implement PostgreSQL Testcontainers, migrations, cleanup, and deterministic fixture helpers in `apps/api/tests/support/postgres.ts` and `tests/fixtures/factories.ts`

**Checkpoint**: Database, API, auth boundary, security, web shell, generated contract, and test harnesses pass; user stories may begin.

---

## Phase 3: User Story 1 - Criar conta e perfil profissional (Priority: P1)

**Goal**: Deliver verified registration, secure sessions/recovery, an editable professional profile,
and immediate account disabling with identifiable-data erasure.

**Independent Test**: Register a fictitious user, prove access is blocked before e-mail verification,
verify and sign in, edit the profile, recover access, sign out/in, and request deletion; both browser
sessions must lose access immediately and the erasure workflow must remove identifiable data.

### Tests for User Story 1

- [X] T029 [P] [US1] Add contract tests for registration, verification, sessions, resets, current user, profile, and deletion in `apps/api/tests/contract/identity.contract.test.ts`
- [X] T030 [P] [US1] Add integration tests for pending activation, one-time tokens, login/logout, reset, and session revocation in `apps/api/tests/integration/identity-lifecycle.test.ts`
- [X] T031 [P] [US1] Add integration tests for enumeration resistance, rate limits, CSRF, cookie flags, Argon2id, and log redaction in `apps/api/tests/integration/identity-security.test.ts`
- [X] T032 [P] [US1] Add integration tests for profile validation, role immutability, and cross-user ownership denial in `apps/api/tests/integration/profile-ownership.test.ts`
- [X] T033 [P] [US1] Add failure-injection, retry, session revocation, 30-day deadline, and anonymous-threshold tests in `apps/api/tests/integration/account-erasure.test.ts`
- [X] T034 [P] [US1] Add component tests for accessible registration, login, verification, reset, profile, and deletion forms in `apps/web/tests/identity-profile.test.tsx`
- [X] T035 [P] [US1] Add the keyboard-only account activation, profile, recovery, and deletion journey in `tests/e2e/us1-account-profile.spec.ts`

### Implementation for User Story 1

- [X] T036 [US1] Create users, auth-owned tables, sessions, tokens, roles, professional roles/profiles, interests, deletion requests, and anonymous metrics in `database/migrations/0002_identity.sql`
- [X] T037 [P] [US1] Implement the transactional e-mail port, Mailpit adapter, and verification/reset templates in `apps/api/src/modules/identity/email.ts` and `apps/api/src/modules/identity/templates.ts`
- [X] T038 [US1] Implement identity request schemas and persistence queries in `apps/api/src/modules/identity/schemas.ts` and `apps/api/src/modules/identity/repository.ts`
- [X] T039 [US1] Implement registration, verification, session, logout, and password-reset policies in `apps/api/src/modules/identity/service.ts` and `apps/api/src/modules/identity/routes.ts`
- [X] T040 [US1] Implement profile completion, interests, validation, and ownership-safe routes in `apps/api/src/modules/profiles/repository.ts`, `apps/api/src/modules/profiles/service.ts`, and `apps/api/src/modules/profiles/routes.ts`
- [X] T041 [P] [US1] Implement append-only authentication/security audit recording with redaction in `apps/api/src/modules/audit/service.ts`
- [X] T042 [US1] Implement atomic deletion-pending transition, session revocation, provider cleanup, retries, and completion tombstones in `apps/api/src/modules/erasure/service.ts` and `apps/api/src/modules/erasure/worker.ts`
- [X] T043 [US1] Implement five-contributor suppression and identifier-free metric aggregation in `apps/api/src/modules/erasure/anonymous-metrics.ts`
- [X] T044 [P] [US1] Implement registration and login routes with explicit pending/error/success states in `apps/web/src/features/identity/RegisterPage.tsx` and `apps/web/src/features/identity/LoginPage.tsx`
- [X] T045 [P] [US1] Implement verification and password-reset routes with one-time-token handling in `apps/web/src/features/identity/VerifyEmailPage.tsx` and `apps/web/src/features/identity/ResetPasswordPage.tsx`
- [X] T046 [P] [US1] Implement the accessible professional profile form and completion guidance in `apps/web/src/features/profile/ProfilePage.tsx` and `apps/web/src/features/profile/ProfileForm.tsx`
- [X] T047 [P] [US1] Implement recent-auth confirmation, deletion receipt, and forced sign-out UI in `apps/web/src/features/profile/DeleteAccountDialog.tsx`

**Checkpoint**: User Story 1 is secure, independently usable, and proves SC-001, SC-008, SC-010, and SC-011 behavior.

---

## Phase 4: User Story 2 - Explorar o mapa de aprendizagem (Priority: P1)

**Goal**: Deliver a public, searchable catalog with canonical skills, ordered trails, certification
relationships, responsive details, and an equivalent semantic text map.

**Independent Test**: Seed a published catalog, search/filter it as a visitor, open one skill shared by
multiple trails, inspect ordered trail steps and certification requirements, and complete the same
inspection by keyboard through the textual representation.

### Tests for User Story 2

- [X] T048 [P] [US2] Add contract tests for catalog search, categories, skill, trail, and certification details in `apps/api/tests/contract/catalog.contract.test.ts`
- [X] T049 [P] [US2] Add PostgreSQL tests for canonical slug uniqueness, revision pointers, FK joins, ordered steps, and exactly-one certification targets in `database/tests/catalog-constraints.integration.test.ts`
- [X] T050 [P] [US2] Add integration tests for publication visibility, search/filter pagination, canonical relationships, and inactive-content exclusion in `apps/api/tests/integration/catalog-read.test.ts`
- [X] T051 [P] [US2] Add component tests for catalog states, filters, details, semantic map, keyboard controls, and axe in `apps/web/tests/catalog-map.test.tsx`
- [X] T052 [P] [US2] Add visitor search and map journeys for desktop, tablet, and mobile in `tests/e2e/us2-catalog-map.spec.ts`

### Implementation for User Story 2

- [X] T053 [US2] Create professional roles, category/skill/trail/certification roots, immutable revisions, ordered steps, joins, requirements, and indexes in `database/migrations/0003_catalog.sql`
- [X] T054 [US2] Implement catalog database types and root/revision queries in `apps/api/src/modules/catalog/types.ts` and `apps/api/src/modules/catalog/repository.ts`
- [X] T055 [US2] Implement cursor search, type/category filters, canonical deduplication, and inactive-content rules in `apps/api/src/modules/catalog/search-service.ts`
- [X] T056 [P] [US2] Implement current trail revision, ordered graph, skill, and prerequisite reads in `apps/api/src/modules/catalog/trail-query-service.ts`
- [X] T057 [P] [US2] Implement certification, requirement, skill, and related-trail reads in `apps/api/src/modules/catalog/certification-query-service.ts`
- [X] T058 [US2] Implement public catalog schemas and routes from OpenAPI in `apps/api/src/modules/catalog/schemas.ts` and `apps/api/src/modules/catalog/routes.ts`
- [X] T059 [US2] Create fictitious categories, skills, shared relationships, a five-step trail, certifications, and requirements in `database/seeds/mvp-catalog.ts`
- [X] T060 [P] [US2] Implement catalog route loaders and query hooks in `apps/web/src/features/catalog/api.ts` and `apps/web/src/features/catalog/routes.tsx`
- [X] T061 [P] [US2] Implement accessible search, type/category filters, pagination, and empty/error states in `apps/web/src/features/catalog/CatalogPage.tsx` and `apps/web/src/features/catalog/CatalogFilters.tsx`
- [X] T062 [P] [US2] Implement canonical skill details and the semantic relationship table in `apps/web/src/features/skill-map/SkillDetailPage.tsx` and `apps/web/src/features/skill-map/RelationshipTable.tsx`
- [X] T063 [P] [US2] Implement ordered trail details with equivalent textual and visual map controls in `apps/web/src/features/skill-map/TrailDetailPage.tsx` and `apps/web/src/features/skill-map/SkillMap.tsx`
- [X] T064 [P] [US2] Implement certification details, issuer, skills, trails, and ordered requirements in `apps/web/src/features/catalog/CertificationDetailPage.tsx`

**Checkpoint**: User Story 2 works without authentication and proves SC-003, SC-005, and SC-006 for catalog flows.

---

## Phase 5: User Story 3 - Registrar e acompanhar progresso (Priority: P1)

**Goal**: Deliver trail start, prerequisite-aware progress commands, immutable correction history,
deterministic concurrency handling, projections, and immediate recalculation after publication changes.

**Independent Test**: Start a seeded trail, append valid and blocked transitions, correct an event,
retry an idempotent command, submit concurrent stale commands, rebuild projections, publish a changed
trail, and verify recalculated progress plus preserved historical revision evidence.

### Tests for User Story 3

- [X] T065 [P] [US3] Add unit tests for prerequisite eligibility and percentage calculation in `apps/api/tests/unit/progress-eligibility.test.ts`
- [X] T066 [P] [US3] Add unit tests for deterministic event projection and correction semantics in `apps/api/tests/unit/progress-projector.test.ts`
- [X] T067 [P] [US3] Add runtime-role and trigger tests that reject progress event update/delete/truncate in `database/tests/progress-immutability.integration.test.ts`
- [X] T068 [P] [US3] Add integration tests for start, transitions, corrections, idempotency, and projection rebuild in `apps/api/tests/integration/progress-history.test.ts`
- [X] T069 [P] [US3] Add row-lock and stale-base-version concurrency tests in `apps/api/tests/integration/progress-concurrency.test.ts`
- [X] T070 [P] [US3] Add contract tests for start trail, trail progress, and progress events in `apps/api/tests/contract/progress.contract.test.ts`
- [X] T071 [P] [US3] Add component tests for progress controls, pending prerequisites, history, conflict review, and catalog-change notices in `apps/web/tests/progress.test.tsx`
- [X] T072 [P] [US3] Add the start, progress, correction, and current-publication journey in `tests/e2e/us3-progress.spec.ts`

### Implementation for User Story 3

- [X] T073 [US3] Create user trail/step projections, append-only events, idempotency, privileges, triggers, and stream indexes in `database/migrations/0004_progress.sql`
- [X] T074 [P] [US3] Implement pure transition, eligibility, percentage, and projection functions in `apps/api/src/modules/progress/domain.ts` and `apps/api/src/modules/progress/projector.ts`
- [X] T075 [US3] Implement stream locking, event append, idempotent lookup, and projection persistence in `apps/api/src/modules/progress/repository.ts`
- [X] T076 [US3] Implement start, prerequisite validation, correction, stale-command review, and current-revision recalculation in `apps/api/src/modules/progress/service.ts`
- [X] T077 [US3] Implement progress schemas and OpenAPI routes in `apps/api/src/modules/progress/schemas.ts` and `apps/api/src/modules/progress/routes.ts`
- [X] T078 [P] [US3] Implement typed trail-start and progress command hooks with idempotency keys in `apps/web/src/features/progress/api.ts`
- [X] T079 [P] [US3] Implement progress percentage, eligibility, controls, and field/status announcements in `apps/web/src/features/progress/TrailProgressPage.tsx` and `apps/web/src/features/progress/ProgressControls.tsx`
- [X] T080 [P] [US3] Implement chronological history, correction references, review warnings, and publication-change notices in `apps/web/src/features/progress/ProgressHistory.tsx` and `apps/web/src/features/progress/CatalogChangeNotice.tsx`

**Checkpoint**: User Story 3 proves append-only history, current state, conflict handling, and SC-004.

---

## Phase 6: User Story 4 - Receber proximo passo recomendado (Priority: P2)

**Goal**: Deliver a consolidated dashboard with deterministic, explained recommendations: one eligible
step for an active trail, or one primary trail and up to two alternatives.

**Independent Test**: Load prepared users with and without active trails, verify progress summaries,
recommendation count/order/reason evidence, repeat with unchanged versions, and validate actionable
empty states when profile or catalog data cannot produce a recommendation.

### Tests for User Story 4

- [X] T081 [P] [US4] Add unit tests for rule scoring, stable tie-breaking, count limits, and reason evidence in `apps/api/tests/unit/recommendation-engine.test.ts`
- [X] T082 [P] [US4] Add integration tests for dashboard aggregation and versioned recommendation inputs in `apps/api/tests/integration/dashboard.test.ts`
- [X] T083 [P] [US4] Add contract tests for dashboard summaries and recommendation schemas in `apps/api/tests/contract/dashboard.contract.test.ts`
- [X] T084 [P] [US4] Add component tests for progress cards, primary/alternative recommendations, reasons, and empty states in `apps/web/tests/dashboard.test.tsx`
- [X] T085 [P] [US4] Add active-trail and profile-based recommendation journeys in `tests/e2e/us4-dashboard.spec.ts`

### Implementation for User Story 4

- [X] T086 [US4] Create recommendation rule sets, snapshots, reason evidence, and version indexes in `database/migrations/0005_recommendations.sql`
- [X] T087 [US4] Implement deterministic rule evaluation, stable ties, and structured explanations in `apps/api/src/modules/recommendations/engine.ts`
- [X] T088 [US4] Implement dashboard aggregation across profile, progress, credentials, achievements, and recommendations in `apps/api/src/modules/recommendations/dashboard-service.ts`
- [X] T089 [US4] Implement the authenticated dashboard schema and route in `apps/api/src/modules/recommendations/schemas.ts` and `apps/api/src/modules/recommendations/routes.ts`
- [X] T090 [P] [US4] Implement the responsive dashboard, progress cards, recommendations, explanations, and actions in `apps/web/src/features/dashboard/DashboardPage.tsx` and `apps/web/src/features/dashboard/RecommendationList.tsx`
- [X] T091 [P] [US4] Add `dashboard_view_ready`, loading, error, and accessible empty-state instrumentation in `apps/web/src/features/dashboard/dashboard-observability.ts`

**Checkpoint**: User Story 4 independently proves SC-002 and recommendation explainability.

---

## Phase 7: User Story 5 - Registrar certificacoes e conquistas (Priority: P2)

**Goal**: Deliver self-declared certification acquisitions/renewals and idempotent achievement awards
without overwriting professional history or implying issuer verification.

**Independent Test**: Record one certification, retry the same occurrence, add a renewal, trigger one
achievement criterion twice, and verify distinct history, one award, and self-declared labeling.

### Tests for User Story 5

- [X] T092 [P] [US5] Add contract tests for certification record create/list and achievement list in `apps/api/tests/contract/credentials.contract.test.ts`
- [X] T093 [P] [US5] Add integration tests for null-aware duplicate detection, idempotency, expiry validation, and renewals in `apps/api/tests/integration/certification-history.test.ts`
- [X] T094 [P] [US5] Add unit tests for bounded achievement criteria and evidence generation in `apps/api/tests/unit/achievement-evaluator.test.ts`
- [X] T095 [P] [US5] Add integration tests for one-time awards across repeated progress/certification triggers in `apps/api/tests/integration/achievement-awards.test.ts`
- [X] T096 [P] [US5] Add component tests for certification forms/history, self-declared labels, and achievement cards in `apps/web/tests/credentials.test.tsx`
- [X] T097 [P] [US5] Add acquisition, renewal, duplicate, and achievement journeys in `tests/e2e/us5-credentials.spec.ts`

### Implementation for User Story 5

- [X] T098 [US5] Create certification records, null-aware uniqueness, achievement revisions, and award evidence in `database/migrations/0006_credentials_achievements.sql`
- [X] T099 [US5] Implement certification history validation, duplicate lookup, renewal creation, and queries in `apps/api/src/modules/credentials/repository.ts` and `apps/api/src/modules/credentials/service.ts`
- [X] T100 [US5] Implement certification record schemas and authenticated routes in `apps/api/src/modules/credentials/schemas.ts` and `apps/api/src/modules/credentials/routes.ts`
- [X] T101 [US5] Implement bounded achievement evaluation and idempotent award recording from domain events in `apps/api/src/modules/achievements/evaluator.ts` and `apps/api/src/modules/achievements/service.ts`
- [X] T102 [US5] Implement the achievement list route and connect progress/certification triggers in `apps/api/src/modules/achievements/routes.ts` and `apps/api/src/modules/achievements/subscribers.ts`
- [X] T103 [P] [US5] Implement certification acquisition/renewal forms and immutable history in `apps/web/src/features/credentials/CertificationRecordsPage.tsx` and `apps/web/src/features/credentials/CertificationRecordForm.tsx`
- [X] T104 [P] [US5] Implement achievement cards with awarded definition/date and empty states in `apps/web/src/features/credentials/AchievementsList.tsx`

**Checkpoint**: User Story 5 proves SC-012 and preserves all certification/achievement history.

---

## Phase 8: User Story 6 - Gerenciar o catalogo (Priority: P3)

**Goal**: Deliver content-admin creation, editing, relationship management, ordered trail authoring,
atomic publication, unpublication, and non-destructive deactivation with audited authorization.

**Independent Test**: As a content administrator, create canonical records, build a five-step trail,
reject dangling/self/cyclic prerequisites, publish it, update it, and deactivate a referenced item;
repeat an admin call as a normal user and verify denial plus audit evidence.

### Tests for User Story 6

- [X] T105 [P] [US6] Add contract tests for category, skill, trail, certification, achievement, publication, and lifecycle admin routes in `apps/api/tests/contract/administration.contract.test.ts`
- [X] T106 [P] [US6] Add deferred-trigger tests for self-reference, cross-trail prerequisites, cycles, positions, and atomic publication in `database/tests/trail-publication.integration.test.ts`
- [X] T107 [P] [US6] Add integration tests for immutable revisions, pointer swaps, current-user recalculation, and non-destructive deactivation in `apps/api/tests/integration/catalog-publication.test.ts`
- [X] T108 [P] [US6] Add integration tests for admin-only guards, mass-assignment denial, CSRF, audit redaction, and rate limits in `apps/api/tests/integration/administration-security.test.ts`
- [X] T109 [P] [US6] Add component tests for admin forms, keyboard ordering, prerequisite editing, validation, and publication states in `apps/web/tests/administration.test.tsx`
- [X] T110 [P] [US6] Add the five-step trail authoring, publication, deactivation, and denial journey in `tests/e2e/us6-administration.spec.ts`

### Implementation for User Story 6

- [X] T111 [US6] Add deferred trail DAG validation, immutable publication guards, and catalog lifecycle constraints in `database/migrations/0007_catalog_administration.sql`
- [X] T112 [US6] Implement admin schemas and draft root/revision persistence for all catalog resource types in `apps/api/src/modules/administration/schemas.ts` and `apps/api/src/modules/administration/repository.ts`
- [X] T113 [US6] Implement atomic trail/non-trail publication, full graph validation, and current-pointer swaps in `apps/api/src/modules/administration/publication-service.ts`
- [X] T114 [US6] Implement unpublish/deactivate rules, referenced-item protection, and affected-user change markers in `apps/api/src/modules/administration/lifecycle-service.ts`
- [X] T115 [US6] Implement category and skill create/update/publication routes in `apps/api/src/modules/administration/category-skill-routes.ts`
- [X] T116 [US6] Implement trail draft, ordering, graph, and publication routes in `apps/api/src/modules/administration/trail-routes.ts`
- [X] T117 [US6] Implement certification and achievement create/update/publication routes in `apps/api/src/modules/administration/credential-routes.ts`
- [X] T118 [P] [US6] Implement the protected administration shell and catalog lifecycle navigation in `apps/web/src/features/administration/AdminLayout.tsx` and `apps/web/src/features/administration/AdminCatalogPage.tsx`
- [X] T119 [P] [US6] Implement accessible category and skill draft/edit/publish forms in `apps/web/src/features/administration/CategoryForm.tsx` and `apps/web/src/features/administration/SkillForm.tsx`
- [X] T120 [P] [US6] Implement keyboard-operable trail step ordering, skill links, prerequisites, validation, and publication in `apps/web/src/features/administration/TrailEditor.tsx`
- [X] T121 [P] [US6] Implement certification requirements and bounded achievement criteria forms in `apps/web/src/features/administration/CertificationForm.tsx` and `apps/web/src/features/administration/AchievementForm.tsx`

**Checkpoint**: User Story 6 independently proves SC-007 and all catalog integrity/authorization rules.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Validate qualities spanning multiple stories and prepare a secure, observable release.

- [X] T122 Regenerate the checked-in OpenAPI client and add incompatible-diff enforcement in `packages/api-contract/openapi.yaml`, `packages/api-contract/src/generated/`, and `.github/workflows/ci.yml`
- [X] T123 [P] Add the cross-story authentication, authorization, CSRF, rate-limit, input, and redaction regression suite in `apps/api/tests/integration/security-regression.test.ts`
- [X] T124 [P] Add the full Chromium/Firefox/WebKit desktop/tablet/mobile and axe release matrix in `tests/e2e/accessibility-responsive.spec.ts` and `playwright.config.ts`
- [X] T125 [P] Implement 500-session catalog/dashboard load, spike, soak, and browser readiness checks in `tests/load/catalog-dashboard-500.js`
- [X] T126 [P] Add secret, dependency, static-analysis, SBOM, and container-image gates in `.github/workflows/security.yml`
- [X] T127 Implement backup restore, erasure-ledger replay, RPO/RTO evidence, and monthly drill commands in `scripts/validate-restore.ps1` and `docs/operations/disaster-recovery.md`
- [X] T128 Add database outage, timeout, pool exhaustion, retry, worker crash, and graceful-shutdown tests in `apps/api/tests/integration/reliability.test.ts`
- [X] T129 [P] Create immutable production builds, non-root API image, frontend static image, and health configuration in `apps/api/Dockerfile`, `apps/web/Dockerfile`, and `.dockerignore`
- [X] T130 [P] Document logs, metrics, traces, alerts, 99.5% availability, and erasure deadline operations in `docs/operations/observability.md` and `docs/operations/account-erasure.md`
- [X] T131 [P] Complete installation, configuration, migration, seed, run, test, and secret guidance in `README.md`
- [X] T132 [P] Record architecture, auth/session, catalog revision, progress history, and erasure decisions in `docs/adr/0001-architecture.md`, `docs/adr/0002-auth-sessions.md`, `docs/adr/0003-history-erasure.md`
- [ ] T133 Execute every automated and manual scenario from `specs/001-mvp-skill-maps/quickstart.md` and record release evidence in `docs/validation/mvp-release.md`
- [ ] T134 Re-run all Constitution gates and record owners/expiry for any approved exception in `docs/validation/constitution-review.md`

**Checkpoint**: All selected stories meet functional, contract, security, accessibility, performance,
reliability, documentation, and Constitution release gates.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: No dependency; T001-T010 establish the workspace.
- **Phase 2 Foundational**: Depends on Phase 1 and blocks every user story.
- **Phase 3 US1**: Starts after Foundational; no implementation dependency on another story.
- **Phase 4 US2**: Starts after Foundational; public catalog remains independently testable.
- **Phase 5 US3**: Starts after Foundational with catalog/auth fixtures; integrated delivery uses US1 and US2.
- **Phase 6 US4**: Starts after Foundational with fixtures; integrated delivery depends on US1, US2, and US3 data.
- **Phase 7 US5**: Starts after Foundational with fixtures; integrated achievement delivery consumes US2/US3 events.
- **Phase 8 US6**: Starts after Foundational; production delivery extends the US2 catalog schema/read model.
- **Phase 9 Polish**: Starts after every story selected for the release is complete.

### User Story Dependency Graph

```text
Setup -> Foundational
                  |-> US1 Account/Profile ---------|
                  |-> US2 Public Catalog ----------|-> US4 Dashboard/Recommendations
                  |-> US3 Progress ----------------|
                  |                |---------------|-> US5 Certifications/Achievements
                  |-> US6 Catalog Administration --|
```

- **US1** and **US2** can ship as independent increments immediately after Foundational.
- **US3** is independently testable with seeded auth/catalog fixtures; its real journey composes US1+US2.
- **US4** is independently testable with prepared profile/progress/catalog data; production value composes US1-US3.
- **US5** is independently testable with seeded users/certifications/events; achievement triggers integrate with US3.
- **US6** is independently testable with seeded admin/catalog data; it supplies ongoing content to US2-US5.

### Within Each User Story

1. Write all listed tests and verify they fail for the intended missing behavior.
2. Apply schema migrations and database constraints.
3. Implement pure domain rules and repositories.
4. Implement services and API routes against `contracts/openapi.yaml`.
5. Implement frontend routes and interaction states against the generated client.
6. Run unit, integration, contract, component, accessibility, and story E2E tests.
7. Stop at the checkpoint and demonstrate the story independently before the next priority.

## Parallel Opportunities

- T003-T010 can be split by workspace/application/tooling file ownership after T002.
- T011-T013 can be written concurrently before foundation implementation.
- T016-T017, T019-T021, and T024-T027 use separate modules and can run concurrently after database/app scaffolding.
- All test tasks at the start of each user-story phase are parallelizable and precede implementation.
- Frontend tasks marked `[P]` can use generated contracts and fixtures while backend work proceeds.
- US1 and US2 can run in parallel after Foundational; US3-US6 can also start with deterministic fixtures.
- T123-T126 and T129-T132 are independent cross-cutting workstreams after selected stories stabilize.

## Parallel Examples by User Story

### User Story 1

```text
Task T029: Identity contract tests in apps/api/tests/contract/identity.contract.test.ts
Task T030: Identity lifecycle integration tests in apps/api/tests/integration/identity-lifecycle.test.ts
Task T034: Identity/profile component tests in apps/web/tests/identity-profile.test.tsx
Task T035: Account/profile E2E in tests/e2e/us1-account-profile.spec.ts
```

### User Story 2

```text
Task T048: Catalog contract tests in apps/api/tests/contract/catalog.contract.test.ts
Task T049: Catalog constraint tests in database/tests/catalog-constraints.integration.test.ts
Task T051: Catalog/map component tests in apps/web/tests/catalog-map.test.tsx
Task T052: Catalog/map E2E in tests/e2e/us2-catalog-map.spec.ts
```

### User Story 3

```text
Task T065: Progress eligibility unit tests in apps/api/tests/unit/progress-eligibility.test.ts
Task T067: Event immutability tests in database/tests/progress-immutability.integration.test.ts
Task T069: Progress concurrency tests in apps/api/tests/integration/progress-concurrency.test.ts
Task T071: Progress component tests in apps/web/tests/progress.test.tsx
```

### User Story 4

```text
Task T081: Recommendation engine unit tests in apps/api/tests/unit/recommendation-engine.test.ts
Task T082: Dashboard integration tests in apps/api/tests/integration/dashboard.test.ts
Task T084: Dashboard component tests in apps/web/tests/dashboard.test.tsx
Task T085: Dashboard E2E in tests/e2e/us4-dashboard.spec.ts
```

### User Story 5

```text
Task T092: Credentials contract tests in apps/api/tests/contract/credentials.contract.test.ts
Task T093: Certification renewal tests in apps/api/tests/integration/certification-history.test.ts
Task T094: Achievement evaluator tests in apps/api/tests/unit/achievement-evaluator.test.ts
Task T096: Credentials component tests in apps/web/tests/credentials.test.tsx
```

### User Story 6

```text
Task T105: Administration contract tests in apps/api/tests/contract/administration.contract.test.ts
Task T106: Trail publication database tests in database/tests/trail-publication.integration.test.ts
Task T108: Administration security tests in apps/api/tests/integration/administration-security.test.ts
Task T109: Administration component tests in apps/web/tests/administration.test.tsx
```

## Implementation Strategy

### First Independently Deployable Increment

1. Complete Phase 1 Setup.
2. Complete Phase 2 Foundational.
3. Complete Phase 3 US1.
4. Stop and run the US1 checkpoint before adding product-domain flows.

US1 alone is the smallest independently deployable account/profile increment. It proves identity,
security, privacy, accessibility, and the shared delivery path.

### Core SKILL MAPS MVP

1. Deliver US1 for verified identity and profiles.
2. Deliver US2 for the public skill map and catalog value.
3. Deliver US3 for personal progress and immutable history.
4. Stop and validate all P1 success criteria before adding P2/P3 scope.

US1+US2+US3 are the recommended product-core MVP because they let a user join, understand a learning
path, and track advancement. US4-US6 remain incremental MVP capabilities from the approved specification.

### Incremental Delivery

1. Setup + Foundational -> secure platform skeleton.
2. US1 -> verified user/profile/privacy increment.
3. US2 -> public catalog and accessible map increment.
4. US3 -> progress/history product-core MVP.
5. US4 -> dashboard and recommendation guidance.
6. US5 -> certification and achievement evidence.
7. US6 -> sustainable content administration.
8. Polish -> release-wide quality and operations evidence.

### Parallel Team Strategy

- Team completes Setup and Foundational together.
- After Foundational, one stream owns US1 identity, one owns US2 catalog, and one prepares US3 progress tests/domain logic against fixtures.
- After P1 interfaces stabilize, separate streams can implement US4, US5, and US6.
- One cross-cutting stream maintains contract generation, migrations, accessibility, security, and CI gates without moving domain ownership into shared packages.

## Notes

- Every task includes an exact implementation or documentation path.
- `[P]` tasks must still respect phase gates and test-before-implementation ordering.
- Generated OpenAPI client changes are reviewed with the contract that caused them.
- No production secret, `.env`, token, credential, or personal fixture may be committed.
- Commit after a coherent task or closely related task group with a clear message.
- Do not add Redis, broker, microservices, SSR, graph database, predictive recommendations, or other rejected scope without a new specification/Constitution review.
