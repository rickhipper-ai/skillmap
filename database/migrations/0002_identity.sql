CREATE TYPE user_status AS ENUM ('pending_verification', 'active', 'deletion_pending');
CREATE TYPE application_role AS ENUM ('user', 'content_admin');
CREATE TYPE experience_level AS ENUM ('beginner', 'intermediate', 'advanced');
CREATE TYPE deletion_request_state AS ENUM ('requested', 'processing', 'completed', 'failed');
CREATE TYPE catalog_root_status AS ENUM ('draft', 'published', 'unpublished', 'inactive');

GRANT skill_maps_runtime TO CURRENT_USER;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_name text NOT NULL DEFAULT '',
  email_normalized varchar(320) NOT NULL UNIQUE CHECK (email_normalized = lower(btrim(email_normalized))),
  email_verified boolean NOT NULL DEFAULT false,
  auth_image text,
  status user_status NOT NULL DEFAULT 'pending_verification',
  email_verified_at timestamptz,
  terms_accepted_at timestamptz NOT NULL,
  deletion_requested_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'deletion_pending') = (deletion_requested_at IS NOT NULL)),
  CHECK ((status = 'active') = (email_verified_at IS NOT NULL) OR status = 'deletion_pending')
);

CREATE TABLE auth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id text NOT NULL,
  provider_id text NOT NULL,
  issuer text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text CHECK (password IS NULL OR password LIKE '$argon2id$%'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (issuer, account_id)
);

CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash char(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE TABLE auth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier_hash varchar(64) NOT NULL CHECK (identifier_hash ~ '^[A-Za-z0-9_-]{43}$'),
  token_value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at)
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role application_role NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role)
);

CREATE FUNCTION enforce_server_owned_roles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_user = 'skill_maps_runtime'
     AND (NEW.role <> 'user' OR NEW.granted_by_user_id IS NOT NULL) THEN
    RAISE EXCEPTION 'roles are server owned' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER user_roles_are_server_owned
BEFORE INSERT OR UPDATE ON user_roles
FOR EACH ROW EXECUTE FUNCTION enforce_server_owned_roles();

CREATE TABLE professional_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL UNIQUE CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name varchar(160) NOT NULL CHECK (length(btrim(name)) > 0),
  active boolean NOT NULL DEFAULT true
);

-- T053 adds immutable revisions and publication pointers to these stable roots.
CREATE TABLE skill_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL UNIQUE CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status catalog_root_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL UNIQUE CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status catalog_root_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE professional_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name varchar(120) NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 120),
  current_role_id uuid REFERENCES professional_roles(id) ON DELETE RESTRICT,
  desired_role_id uuid REFERENCES professional_roles(id) ON DELETE RESTRICT,
  experience_level experience_level NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profile_interest_categories (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES skill_categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, category_id)
);

CREATE TABLE profile_interest_skills (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  state deletion_request_state NOT NULL DEFAULT 'requested',
  requested_at timestamptz NOT NULL DEFAULT now(),
  target_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  deadline_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz,
  completed_at timestamptz,
  last_error_code varchar(80),
  CHECK (target_at <= deadline_at),
  CHECK (deadline_at <= requested_at + interval '30 days'),
  CHECK ((state = 'completed') = (completed_at IS NOT NULL)),
  CHECK (state <> 'completed' OR user_id IS NULL)
);

CREATE FUNCTION anonymous_metric_dimensions_valid(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT jsonb_typeof(value) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each(value) AS dimension(key, dimension_value)
      WHERE key NOT IN ('surface', 'device_class', 'experience_level')
         OR jsonb_typeof(dimension_value) <> 'string'
         OR length(dimension_value #>> '{}') > 40
    )
$$;

CREATE TABLE anonymous_metrics (
  period_start date NOT NULL,
  period_end date NOT NULL,
  metric_name varchar(100) NOT NULL CHECK (metric_name ~ '^[a-z0-9_]+$'),
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (anonymous_metric_dimensions_valid(dimensions)),
  contributor_count integer NOT NULL CHECK (contributor_count >= 5),
  value numeric NOT NULL,
  PRIMARY KEY (period_start, period_end, metric_name, dimensions),
  CHECK (period_end >= period_start)
);

ALTER TABLE audit_events
  ADD COLUMN actor_tombstone char(64),
  ADD COLUMN resource_type varchar(80),
  ADD COLUMN resource_id uuid,
  ADD CONSTRAINT audit_events_actor_fk FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  ADD CONSTRAINT audit_events_subject_fk FOREIGN KEY (subject_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX auth_sessions_user_id_idx ON auth_sessions (user_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions (expires_at);
CREATE INDEX auth_accounts_user_id_idx ON auth_accounts (user_id);
CREATE INDEX auth_tokens_identifier_idx ON auth_tokens (identifier_hash, created_at DESC);
CREATE INDEX auth_tokens_expires_at_idx ON auth_tokens (expires_at);
CREATE INDEX user_roles_granted_by_idx ON user_roles (granted_by_user_id);
CREATE INDEX professional_profiles_current_role_idx ON professional_profiles (current_role_id);
CREATE INDEX professional_profiles_desired_role_idx ON professional_profiles (desired_role_id);
CREATE INDEX profile_interest_categories_category_idx ON profile_interest_categories (category_id);
CREATE INDEX profile_interest_skills_skill_idx ON profile_interest_skills (skill_id);
CREATE INDEX account_deletion_requests_due_idx ON account_deletion_requests (state, next_attempt_at, deadline_at);
CREATE INDEX audit_events_actor_idx ON audit_events (actor_id, occurred_at DESC);
CREATE INDEX audit_events_subject_idx ON audit_events (subject_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION reject_audit_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('skill_maps.erasure_context', true) = 'on'
     AND TG_OP = 'UPDATE'
     AND NEW.id = OLD.id
     AND NEW.event_type = OLD.event_type
     AND NEW.outcome = OLD.outcome
     AND NEW.metadata = OLD.metadata
     AND NEW.occurred_at = OLD.occurred_at
     AND (NEW.actor_id IS NOT DISTINCT FROM OLD.actor_id OR NEW.actor_id IS NULL)
     AND (NEW.subject_id IS NOT DISTINCT FROM OLD.subject_id OR NEW.subject_id IS NULL)
     AND (NEW.actor_id IS DISTINCT FROM OLD.actor_id OR NEW.subject_id IS DISTINCT FROM OLD.subject_id)
     AND NEW.request_id IS NOT DISTINCT FROM OLD.request_id
     AND NEW.resource_type IS NOT DISTINCT FROM OLD.resource_type
     AND NEW.resource_id IS NOT DISTINCT FROM OLD.resource_id THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'audit events are append-only' USING ERRCODE = '55000';
END
$$;

CREATE FUNCTION complete_account_erasure(p_request_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  erased_user_id uuid;
BEGIN
  SELECT user_id INTO erased_user_id
  FROM account_deletion_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF erased_user_id IS NULL THEN
    RETURN true;
  END IF;

  PERFORM set_config('skill_maps.erasure_context', 'on', true);
  UPDATE audit_events
  SET actor_id = CASE WHEN actor_id = erased_user_id THEN NULL ELSE actor_id END,
      subject_id = CASE WHEN subject_id = erased_user_id THEN NULL ELSE subject_id END,
      actor_tombstone = CASE
        WHEN actor_id = erased_user_id
        THEN COALESCE(actor_tombstone, encode(digest(erased_user_id::text, 'sha256'), 'hex'))
        ELSE actor_tombstone
      END
  WHERE actor_id = erased_user_id OR subject_id = erased_user_id;
  DELETE FROM users WHERE id = erased_user_id AND status = 'deletion_pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account is not deletion pending' USING ERRCODE = '55000';
  END IF;
  UPDATE account_deletion_requests
  SET state = 'completed', completed_at = now(), user_id = NULL,
      next_attempt_at = NULL, last_error_code = NULL
  WHERE id = p_request_id;
  RETURN true;
END
$$;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON FUNCTION complete_account_erasure(uuid) FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, auth_accounts, auth_sessions, auth_tokens,
  professional_profiles, profile_interest_categories, profile_interest_skills,
  account_deletion_requests TO skill_maps_runtime;
GRANT SELECT ON user_roles, professional_roles, skill_categories, skills, anonymous_metrics TO skill_maps_runtime;
GRANT INSERT ON user_roles TO skill_maps_runtime;
GRANT EXECUTE ON FUNCTION complete_account_erasure(uuid) TO skill_maps_runtime;
GRANT USAGE ON TYPE user_status, application_role, experience_level,
  deletion_request_state, catalog_root_status TO skill_maps_runtime;
