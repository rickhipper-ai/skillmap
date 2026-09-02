# Data Model: MVP do SKILL MAPS

**Date**: 2026-09-01
**Spec**: [spec.md](spec.md)
**Research**: [research.md](research.md)

## Conventions

- PostgreSQL 18 is the system of record.
- Stable domain roots use UUID primary keys and expose UUIDs through the API.
- Append-only event streams use generated `bigint` primary keys for chronological pagination.
- Every table has a primary key; every relationship has a foreign key and an index on its FK columns.
- Timestamps are UTC `timestamptz`; calendar dates such as certification acquisition use `date`.
- Canonical slugs and e-mail addresses are normalized before uniqueness checks.
- Catalog and user lifecycle removal uses explicit states. Published/referenced catalog data is never
  hard-deleted; confirmed user erasure is the explicit exception to append-only personal history.
- Migrations are forward-only and reviewed. Database triggers and advanced constraints are expressed
  in native SQL when the query layer cannot declare them.

## Identity and Access

### users

Application identity and lifecycle root.

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| email_normalized | varchar(320) | Required, unique, never returned outside identity flows |
| status | enum | `pending_verification`, `active`, `deletion_pending` |
| email_verified_at | timestamptz | Null until verified |
| terms_accepted_at | timestamptz | Required before activation |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |
| deletion_requested_at | timestamptz | Required only for `deletion_pending` |

Validation:

- Only `active` users may create authenticated sessions.
- Transition to `deletion_pending` is irreversible through normal application flows.
- Role values are server-owned and cannot be set through registration/profile input.

### auth_credentials, auth_sessions, auth_tokens

Better Auth-owned credential, opaque session, e-mail verification, and password reset records. Their
schema is incorporated into the same reviewed migration sequence.

Required invariants:

- Credentials reference `users.id` and store only Argon2id password hashes.
- Session identifiers and one-time tokens are stored as non-reversible hashes.
- Sessions have explicit expiry and are deleted on logout, reset, suspension, or erasure.
- Verification/reset tokens are single-use, short-lived, purpose-bound, and deleted after use.

### user_roles

| Field | Type | Rules |
|---|---|---|
| user_id | uuid | PK part, FK users |
| role | enum | PK part; `user` or `content_admin` |
| granted_at | timestamptz | Required |
| granted_by_user_id | uuid | Nullable FK users, never self-assigned through public input |

### professional_roles

Canonical professional role vocabulary used by profiles and recommendation rules.

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| slug | varchar(100) | Required, unique |
| name | varchar(160) | Required |
| active | boolean | Required |

### professional_profiles

| Field | Type | Rules |
|---|---|---|
| user_id | uuid | PK and FK users, cascade on erasure |
| display_name | varchar(120) | Required after profile completion |
| current_role_id | uuid | Nullable FK professional_roles |
| desired_role_id | uuid | Required for role-based recommendation |
| experience_level | enum | `beginner`, `intermediate`, `advanced` |
| created_at | timestamptz | Required |
| updated_at | timestamptz | Required |

### profile_interest_categories / profile_interest_skills

Composite PK `(user_id, category_id)` or `(user_id, skill_id)` prevents duplicate interests. Both
relations cascade on user erasure and restrict deletion of referenced catalog roots.

## Versioned Catalog

All stable catalog roots have `id`, canonical `slug`, lifecycle `status`, `published_revision_id`,
`created_at`, and `updated_at`. Status is one of `draft`, `published`, `unpublished`, or `inactive`.
Only a complete revision may become the current published revision.

### skill_categories / category_revisions

`category_revisions` contains `id`, `category_id`, `revision_number`, `name`, `description`,
`created_by_user_id`, and `created_at`. `(category_id, revision_number)` is unique.

### skills / skill_revisions

`skill_revisions` contains `id`, `skill_id`, `revision_number`, `category_id`, `name`, `description`,
`created_by_user_id`, and `created_at`. `(skill_id, revision_number)` is unique. A skill is canonical
and may be linked to any number of trail steps and certifications without duplication.

### learning_trails / trail_revisions

| Field | Type | Rules |
|---|---|---|
| learning_trails.id | uuid | PK stable root |
| learning_trails.published_revision_id | uuid | Nullable FK trail_revisions |
| trail_revisions.id | uuid | PK |
| trail_revisions.trail_id | uuid | FK learning_trails |
| trail_revisions.revision_number | integer | Positive; unique per trail |
| trail_revisions.category_id | uuid | FK skill_categories |
| trail_revisions.title | varchar(180) | Required |
| trail_revisions.description | text | Required |
| trail_revisions.created_by_user_id | uuid | FK users |
| trail_revisions.created_at | timestamptz | Required |

Publishing atomically inserts the immutable revision graph and changes
`learning_trails.published_revision_id`. Existing users immediately read this pointer.

### trail_steps / trail_revision_steps

`trail_steps` gives a step stable identity within one trail. `trail_revision_steps` contains the
revision-specific title, description, required flag, and positive position.

Constraints:

- PK for `trail_revision_steps` is `(trail_revision_id, step_id)`.
- `(trail_revision_id, position)` is unique.
- A composite FK guarantees that each step belongs to the same trail as the revision.
- Reordering changes only a new revision; existing revisions remain immutable.

### trail_step_skills

Composite PK `(trail_revision_id, step_id, skill_id)` links canonical skills to a step in a specific
publication. All three references use enforced foreign keys.

### trail_step_prerequisites

| Field | Type | Rules |
|---|---|---|
| trail_revision_id | uuid | PK part |
| step_id | uuid | PK part, dependent step |
| prerequisite_step_id | uuid | PK part, required predecessor |

Composite foreign keys keep both steps inside the same revision. A check rejects self-reference. A
deferred constraint trigger executes a recursive graph check and rejects cycles before commit;
publication repeats the complete acyclicity check while locking the trail root.

### trail_target_roles

Composite PK `(trail_revision_id, professional_role_id)` supplies deterministic role matches for
recommendations.

### certifications / certification_revisions

Stable certification roots follow the catalog lifecycle. Revisions contain `certification_id`,
`revision_number`, `name`, `issuer`, `description`, optional default validity information,
`created_by_user_id`, and `created_at`.

### certification_revision_skills / certification_revision_trails

Composite join keys associate one certification revision with canonical skills and trails. These
relations drive catalog details and recommendation explanations.

### certification_requirements

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| certification_revision_id | uuid | FK certification_revisions |
| title | varchar(180) | Required |
| requirement_type | enum | `skill` or `trail` |
| skill_id | uuid | Nullable FK skills |
| trail_id | uuid | Nullable FK learning_trails |
| required | boolean | Required |
| position | integer | Positive, unique per certification revision |

An exactly-one-target check requires only the FK selected by `requirement_type`.

### achievements / achievement_revisions

Achievement roots use the catalog lifecycle. Revisions contain display name, description, icon label,
criterion type, structured criterion parameters, and revision number. Criterion parameters are
validated against a bounded schema; arbitrary executable expressions are prohibited.

## User Learning State

### user_trail_states

Current projection for dashboard reads.

| Field | Type | Rules |
|---|---|---|
| user_id | uuid | PK part, FK users, cascade on erasure |
| trail_id | uuid | PK part, FK learning_trails |
| status | enum | `in_progress`, `completed` |
| current_stream_version | bigint | Non-negative |
| started_at | timestamptz | Required |
| last_activity_at | timestamptz | Required |
| last_seen_revision_id | uuid | FK trail_revisions |
| review_required | boolean | Set by accepted stale/conflicting commands |

Percentage is computed against required steps in the current published revision. The projection may
cache the value but the published revision remains authoritative.

### progress_events

Append-only source for every progress transition and correction.

| Field | Type | Rules |
|---|---|---|
| id | bigint identity | PK |
| user_id | uuid | FK users, cascade only in privileged erasure workflow |
| trail_id | uuid | FK learning_trails |
| step_id | uuid | FK trail_steps |
| observed_trail_revision_id | uuid | FK trail_revisions |
| new_state | enum | `not_started`, `in_progress`, `completed` |
| source | enum | `user`, `admin_correction`, `system` |
| command_id | uuid | Required, unique idempotency key |
| base_stream_version | bigint | Client-observed stream version |
| stream_version | bigint | Unique per user/trail |
| supersedes_event_id | bigint | Nullable FK progress_events for corrections |
| occurred_at | timestamptz | Required server timestamp |

Constraints and transaction behavior:

- Unique `(user_id, trail_id, stream_version)` determines total stream order.
- The runtime role has no update/truncate permission; a trigger rejects ordinary event mutation.
- A write locks `user_trail_states`, validates current prerequisites, appends one event, updates current
  projections, and commits atomically.
- A repeated `command_id` returns the prior result. A distinct stale command is appended, increments
  the stream, and sets `review_required`.

### user_step_states

Projection with PK `(user_id, trail_id, step_id)`, current state, latest event ID, and updated time.
It can be rebuilt deterministically from `progress_events`.

### user_certification_records

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK users, cascade on erasure |
| certification_id | uuid | FK certifications |
| observed_revision_id | uuid | FK certification_revisions |
| obtained_on | date | Required |
| external_identifier | varchar(180) | Nullable |
| expires_on | date | Nullable, must be after obtained_on |
| verification_status | enum | Fixed to `self_declared` for MVP |
| created_at | timestamptz | Required |

A null-aware unique constraint on `(user_id, certification_id, obtained_on, external_identifier)`
rejects retries while allowing later renewals.

### user_achievement_awards

PK `(user_id, achievement_id)` guarantees one award. Fields include `achievement_revision_id`,
`awarded_at`, and structured evidence referencing the triggering progress/certification event.

## Recommendations

### recommendation_rule_sets

Immutable, versioned rule configuration with `id`, `version`, `status`, `rules`, `created_at`, and
`published_at`. Rules are bounded structured data, not executable source.

### learning_recommendations

Short-lived snapshots used to explain dashboard ordering.

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK users, cascade on erasure |
| rule_set_id | uuid | FK recommendation_rule_sets |
| target_type | enum | `trail_step` or `trail` |
| trail_id | uuid | FK learning_trails |
| step_id | uuid | Nullable FK trail_steps |
| rank | smallint | 1 through 3 |
| reason_code | enum | e.g. `next_eligible_step`, `desired_role`, `interest_match` |
| evidence | jsonb | Validated IDs/scores only; no free-form personal text |
| profile_version | bigint | Input version |
| progress_stream_version | bigint | Input version |
| catalog_revision_id | uuid | Relevant current publication |
| generated_at | timestamptz | Required |

For an active trail, rank 1 is its next eligible step. Otherwise rank 1 is the primary trail and ranks
2-3 are optional alternatives. Ranking ties use stable root UUID order after business scores so the
same inputs produce the same order.

## Audit, Deletion, and Anonymous Metrics

### audit_events

Append-only records for authentication outcomes, authorization denials, role changes, catalog
publication, administrative actions, session revocation, and erasure milestones.

Fields: identity event ID, event type, nullable actor user ID, non-reversible actor tombstone,
resource type/ID, result, request ID, bounded redacted metadata, and occurred time. `ON DELETE SET NULL`
removes the user link during erasure; metadata cannot contain e-mail, tokens, cookies, free-form request
bodies, or unnecessary network identifiers.

### account_deletion_requests

| Field | Type | Rules |
|---|---|---|
| id | uuid | PK, random public status reference |
| user_id | uuid | Unique FK while processing |
| state | enum | `requested`, `processing`, `completed`, `failed` |
| requested_at | timestamptz | Required |
| target_at | timestamptz | Internal 24-hour target |
| deadline_at | timestamptz | Required, no later than 30 days |
| attempts | integer | Non-negative |
| next_attempt_at | timestamptz | Nullable |
| completed_at | timestamptz | Nullable |
| last_error_code | varchar(80) | Nullable, no personal data |

The workflow is idempotent. Completion requires primary data deletion, provider cleanup, log/analytics
scrubbing, and evidence that backup expiry/replay rules satisfy the deadline. After user deletion, a
non-identifying completion tombstone may retain only request ID, times, and result.

### anonymous_metrics

Pre-aggregated product counts only. Fields contain coarse period, metric name, approved low-cardinality
dimensions, contributor count, and value. No user/event ID or free text is allowed, and cells with
fewer than five contributors are suppressed.

## Lifecycle Transitions

```text
User: pending_verification -> active -> deletion_pending -> deleted

Catalog root: draft -> published -> unpublished -> published
                              \-> inactive

Catalog revision: draft -> published (immutable)

Trail progress: absent -> in_progress -> completed
                         \-> in_progress (after current publication adds requirements)

Step progress: not_started -> in_progress -> completed
                         \-> corrected by a compensating event to any valid state

Deletion request: requested -> processing -> completed
                                  \-> failed -> processing
```

## Migration and Index Requirements

- Run migrations once per deployment with a dedicated migration role; never synchronize schema on API
  startup.
- Use expand/backfill/validate/contract changes and forward recovery for destructive transformations.
- Index normalized e-mail, all session/token hashes, catalog status and slug, publication pointers,
  trail revision positions, all join FKs, progress `(user_id, trail_id, stream_version)`, dashboard
  projection user IDs, certification history, audit time/type, and deletion deadline/state.
- Validate migrations from an empty database and the previous release snapshot.
- Test deferred cycle constraints, duplicate certification rules, event immutability, erasure cascades,
  row-lock concurrency, and projection rebuilds against PostgreSQL rather than a substitute database.
