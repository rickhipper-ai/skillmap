CREATE TYPE certification_verification_status AS ENUM ('self_declared');
CREATE TYPE achievement_criterion_type AS ENUM ('completed_steps', 'certification_records');

CREATE TABLE user_certification_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  certification_id uuid NOT NULL REFERENCES certifications(id) ON DELETE RESTRICT,
  observed_revision_id uuid NOT NULL,
  obtained_on date NOT NULL,
  external_identifier varchar(180),
  expires_on date,
  verification_status certification_verification_status NOT NULL DEFAULT 'self_declared'
    CHECK (verification_status = 'self_declared'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_certification_records_revision_fk
    FOREIGN KEY (observed_revision_id, certification_id)
    REFERENCES certification_revisions(id, certification_id) ON DELETE RESTRICT,
  CONSTRAINT user_certification_records_expiry_check
    CHECK (expires_on IS NULL OR expires_on > obtained_on),
  CONSTRAINT user_certification_records_occurrence_key
    UNIQUE NULLS NOT DISTINCT (user_id, certification_id, obtained_on, external_identifier)
);

CREATE TABLE certification_record_commands (
  command_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  certification_id uuid NOT NULL REFERENCES certifications(id) ON DELETE RESTRICT,
  obtained_on date NOT NULL,
  external_identifier varchar(180),
  expires_on date,
  record_id uuid NOT NULL REFERENCES user_certification_records(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (expires_on IS NULL OR expires_on > obtained_on)
);

CREATE FUNCTION achievement_criterion_parameters_valid(
  criterion achievement_criterion_type,
  parameters jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT jsonb_typeof(parameters) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(parameters)) = 1
    AND parameters ? 'minimum'
    AND jsonb_typeof(parameters->'minimum') = 'number'
    AND (parameters->>'minimum') ~ '^[0-9]+$'
    AND (parameters->>'minimum')::integer BETWEEN 1 AND 1000
    AND criterion IN ('completed_steps', 'certification_records')
$$;

CREATE TABLE achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL UNIQUE
    CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status catalog_root_status NOT NULL DEFAULT 'draft',
  published_revision_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE achievement_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  title varchar(180) NOT NULL CHECK (length(btrim(title)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) > 0 AND length(description) <= 5000),
  icon_label varchar(120) NOT NULL CHECK (length(btrim(icon_label)) > 0),
  criterion_type achievement_criterion_type NOT NULL,
  criterion_parameters jsonb NOT NULL,
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (achievement_id, revision_number),
  UNIQUE (id, achievement_id),
  CHECK (achievement_criterion_parameters_valid(criterion_type, criterion_parameters))
);

ALTER TABLE achievements
  ADD CONSTRAINT achievements_published_revision_fk
  FOREIGN KEY (published_revision_id, id)
  REFERENCES achievement_revisions(id, achievement_id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION achievement_award_evidence_valid(evidence jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT jsonb_typeof(evidence) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(evidence)) = 4
    AND evidence->>'criterionType' IN ('completed_steps', 'certification_records')
    AND jsonb_typeof(evidence->'requiredCount') = 'number'
    AND (evidence->>'requiredCount') ~ '^[0-9]+$'
    AND (evidence->>'requiredCount')::integer BETWEEN 1 AND 1000
    AND jsonb_typeof(evidence->'actualCount') = 'number'
    AND (evidence->>'actualCount') ~ '^[0-9]+$'
    AND (evidence->>'actualCount')::integer >= (evidence->>'requiredCount')::integer
    AND jsonb_typeof(evidence->'trigger') = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(evidence->'trigger')) = 2
    AND (
      (
        evidence->'trigger'->>'type' = 'progress_event'
        AND jsonb_typeof(evidence->'trigger'->'eventId') = 'number'
        AND (evidence->'trigger'->>'eventId') ~ '^[1-9][0-9]*$'
      ) OR (
        evidence->'trigger'->>'type' = 'certification_record'
        AND (evidence->'trigger'->>'recordId')
          ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      )
    )
$$;

CREATE TABLE user_achievement_awards (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE RESTRICT,
  achievement_revision_id uuid NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  evidence jsonb NOT NULL CHECK (achievement_award_evidence_valid(evidence)),
  PRIMARY KEY (user_id, achievement_id),
  FOREIGN KEY (achievement_revision_id, achievement_id)
    REFERENCES achievement_revisions(id, achievement_id) ON DELETE RESTRICT
);

CREATE TRIGGER achievement_revisions_are_immutable
BEFORE UPDATE OR DELETE ON achievement_revisions
FOR EACH ROW EXECUTE FUNCTION reject_catalog_revision_mutation();

CREATE CONSTRAINT TRIGGER achievements_have_complete_publications
AFTER INSERT OR UPDATE ON achievements DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_catalog_publication();

CREATE FUNCTION reject_user_credential_history_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('skill_maps.erasure_context', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'credential and achievement history is immutable' USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER user_certification_records_are_immutable
BEFORE UPDATE OR DELETE ON user_certification_records
FOR EACH ROW EXECUTE FUNCTION reject_user_credential_history_mutation();
CREATE TRIGGER user_achievement_awards_are_immutable
BEFORE UPDATE OR DELETE ON user_achievement_awards
FOR EACH ROW EXECUTE FUNCTION reject_user_credential_history_mutation();

CREATE INDEX user_certification_records_history_idx
  ON user_certification_records (user_id, obtained_on DESC, created_at DESC);
CREATE INDEX user_certification_records_certification_idx
  ON user_certification_records (certification_id);
CREATE INDEX certification_record_commands_user_idx
  ON certification_record_commands (user_id, created_at DESC);
CREATE INDEX achievements_publication_idx ON achievements (published_revision_id);
CREATE INDEX achievement_revisions_root_idx ON achievement_revisions (achievement_id, revision_number);
CREATE INDEX user_achievement_awards_date_idx
  ON user_achievement_awards (user_id, awarded_at DESC, achievement_id);
CREATE INDEX user_achievement_awards_revision_idx
  ON user_achievement_awards (achievement_revision_id);

REVOKE UPDATE, DELETE, TRUNCATE ON user_certification_records, user_achievement_awards
  FROM PUBLIC, skill_maps_runtime;
GRANT SELECT, INSERT ON user_certification_records, certification_record_commands,
  user_achievement_awards TO skill_maps_runtime;
GRANT SELECT ON achievements, achievement_revisions TO skill_maps_runtime;
GRANT USAGE ON TYPE certification_verification_status, achievement_criterion_type
  TO skill_maps_runtime;
