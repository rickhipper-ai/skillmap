CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'skill_maps_migration') THEN
    CREATE ROLE skill_maps_migration NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'skill_maps_runtime') THEN
    CREATE ROLE skill_maps_runtime NOLOGIN NOINHERIT;
  END IF;
END
$$;

CREATE TABLE schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL UNIQUE,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_type text NOT NULL CHECK (length(event_type) BETWEEN 1 AND 100),
  actor_id uuid,
  subject_id uuid,
  request_id text,
  outcome text NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE TYPE background_job_status AS ENUM ('pending', 'running', 'retry', 'completed', 'failed');

CREATE TABLE background_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL CHECK (length(job_type) BETWEEN 1 AND 100),
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  status background_job_status NOT NULL DEFAULT 'pending',
  available_at timestamptz NOT NULL DEFAULT now(),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts integer NOT NULL DEFAULT 5 CHECK (max_attempts > 0),
  last_error_code text,
  locked_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_type, idempotency_key)
);

CREATE TABLE background_job_attempts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES background_jobs(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL CHECK (attempt_number > 0),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  outcome text CHECK (outcome IN ('completed', 'retry', 'failed')),
  error_code text,
  UNIQUE (job_id, attempt_number)
);

CREATE INDEX background_jobs_claim_idx
  ON background_jobs (available_at, created_at)
  WHERE status IN ('pending', 'retry');
CREATE INDEX audit_events_occurred_at_idx ON audit_events (occurred_at DESC);
CREATE INDEX audit_events_type_idx ON audit_events (event_type, occurred_at DESC);

CREATE FUNCTION reject_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit events are append-only' USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER audit_events_are_append_only
BEFORE UPDATE OR DELETE ON audit_events
FOR EACH ROW EXECUTE FUNCTION reject_audit_event_mutation();

REVOKE ALL ON schema_migrations FROM PUBLIC, skill_maps_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM PUBLIC, skill_maps_runtime;
REVOKE UPDATE, DELETE, TRUNCATE ON background_job_attempts FROM PUBLIC, skill_maps_runtime;

GRANT USAGE ON SCHEMA public TO skill_maps_runtime;
GRANT SELECT ON schema_migrations TO skill_maps_runtime;
GRANT SELECT, INSERT ON audit_events TO skill_maps_runtime;
GRANT SELECT, INSERT, UPDATE ON background_jobs TO skill_maps_runtime;
GRANT SELECT, INSERT ON background_job_attempts TO skill_maps_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO skill_maps_runtime;
