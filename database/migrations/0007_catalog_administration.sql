CREATE TYPE catalog_publication_resource_type AS ENUM
  ('category', 'skill', 'trail', 'certification', 'achievement');

CREATE TABLE catalog_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_type catalog_publication_resource_type NOT NULL,
  resource_id uuid NOT NULL,
  revision_id uuid NOT NULL,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  idempotency_key uuid NOT NULL UNIQUE,
  published_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  published_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (resource_type, resource_id, revision_number),
  UNIQUE (resource_type, revision_id)
);

INSERT INTO catalog_publications
  (resource_type, resource_id, revision_id, revision_number, idempotency_key,
   published_by_user_id, published_at)
SELECT 'category'::catalog_publication_resource_type, root.id, revision.id, revision.revision_number, gen_random_uuid(),
  revision.created_by_user_id, revision.created_at
FROM skill_categories root
JOIN category_revisions revision ON revision.id = root.published_revision_id
UNION ALL
SELECT 'skill'::catalog_publication_resource_type, root.id, revision.id, revision.revision_number, gen_random_uuid(),
  revision.created_by_user_id, revision.created_at
FROM skills root
JOIN skill_revisions revision ON revision.id = root.published_revision_id
UNION ALL
SELECT 'trail'::catalog_publication_resource_type, root.id, revision.id, revision.revision_number, gen_random_uuid(),
  revision.created_by_user_id, revision.created_at
FROM learning_trails root
JOIN trail_revisions revision ON revision.id = root.published_revision_id
UNION ALL
SELECT 'certification'::catalog_publication_resource_type, root.id, revision.id, revision.revision_number, gen_random_uuid(),
  revision.created_by_user_id, revision.created_at
FROM certifications root
JOIN certification_revisions revision ON revision.id = root.published_revision_id
UNION ALL
SELECT 'achievement'::catalog_publication_resource_type, root.id, revision.id, revision.revision_number, gen_random_uuid(),
  revision.created_by_user_id, revision.created_at
FROM achievements root
JOIN achievement_revisions revision ON revision.id = root.published_revision_id;

CREATE TABLE category_drafts (
  category_id uuid PRIMARY KEY REFERENCES skill_categories(id) ON DELETE RESTRICT,
  name varchar(160) NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) > 0 AND length(description) <= 2000),
  edited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE skill_drafts (
  skill_id uuid PRIMARY KEY REFERENCES skills(id) ON DELETE RESTRICT,
  category_id uuid NOT NULL REFERENCES skill_categories(id) ON DELETE RESTRICT,
  name varchar(160) NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) > 0 AND length(description) <= 4000),
  edited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trail_drafts (
  trail_id uuid PRIMARY KEY REFERENCES learning_trails(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES skill_categories(id) ON DELETE RESTRICT,
  title varchar(180) CHECK (title IS NULL OR length(btrim(title)) > 0),
  description text CHECK (description IS NULL OR (length(btrim(description)) > 0 AND length(description) <= 8000)),
  edited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trail_draft_steps (
  trail_id uuid NOT NULL REFERENCES learning_trails(id) ON DELETE RESTRICT,
  step_id uuid NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  title varchar(180) NOT NULL CHECK (length(btrim(title)) > 0),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  required boolean NOT NULL DEFAULT true,
  PRIMARY KEY (trail_id, step_id),
  UNIQUE (trail_id, position),
  FOREIGN KEY (step_id, trail_id) REFERENCES trail_steps(id, trail_id) ON DELETE RESTRICT
);

CREATE TABLE trail_draft_step_skills (
  trail_id uuid NOT NULL,
  step_id uuid NOT NULL,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  PRIMARY KEY (trail_id, step_id, skill_id),
  FOREIGN KEY (trail_id, step_id)
    REFERENCES trail_draft_steps(trail_id, step_id) ON DELETE CASCADE
);

CREATE TABLE trail_draft_step_prerequisites (
  trail_id uuid NOT NULL,
  step_id uuid NOT NULL,
  prerequisite_step_id uuid NOT NULL,
  PRIMARY KEY (trail_id, step_id, prerequisite_step_id),
  FOREIGN KEY (trail_id, step_id)
    REFERENCES trail_draft_steps(trail_id, step_id) ON DELETE CASCADE,
  FOREIGN KEY (trail_id, prerequisite_step_id)
    REFERENCES trail_draft_steps(trail_id, step_id) ON DELETE CASCADE,
  CHECK (step_id <> prerequisite_step_id)
);

CREATE TABLE trail_draft_target_roles (
  trail_id uuid NOT NULL REFERENCES learning_trails(id) ON DELETE CASCADE,
  professional_role_id uuid NOT NULL REFERENCES professional_roles(id) ON DELETE RESTRICT,
  PRIMARY KEY (trail_id, professional_role_id)
);

CREATE TABLE certification_drafts (
  certification_id uuid PRIMARY KEY REFERENCES certifications(id) ON DELETE RESTRICT,
  name varchar(180) NOT NULL CHECK (length(btrim(name)) > 0),
  issuer varchar(180) NOT NULL CHECK (length(btrim(issuer)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) > 0 AND length(description) <= 8000),
  default_validity_months integer CHECK (default_validity_months BETWEEN 1 AND 1200),
  edited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE certification_draft_skills (
  certification_id uuid NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  PRIMARY KEY (certification_id, skill_id)
);

CREATE TABLE certification_draft_trails (
  certification_id uuid NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  trail_id uuid NOT NULL REFERENCES learning_trails(id) ON DELETE RESTRICT,
  PRIMARY KEY (certification_id, trail_id)
);

CREATE TABLE certification_draft_requirements (
  certification_id uuid NOT NULL REFERENCES certifications(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position > 0),
  title varchar(180) NOT NULL CHECK (length(btrim(title)) > 0),
  requirement_type certification_requirement_type NOT NULL,
  skill_id uuid REFERENCES skills(id) ON DELETE RESTRICT,
  trail_id uuid REFERENCES learning_trails(id) ON DELETE RESTRICT,
  required boolean NOT NULL DEFAULT true,
  PRIMARY KEY (certification_id, position),
  CHECK (
    (requirement_type = 'skill' AND skill_id IS NOT NULL AND trail_id IS NULL)
    OR (requirement_type = 'trail' AND trail_id IS NOT NULL AND skill_id IS NULL)
  )
);

CREATE TABLE achievement_drafts (
  achievement_id uuid PRIMARY KEY REFERENCES achievements(id) ON DELETE RESTRICT,
  title varchar(180) NOT NULL CHECK (length(btrim(title)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) > 0 AND length(description) <= 2000),
  icon_label varchar(120) NOT NULL CHECK (length(btrim(icon_label)) > 0),
  criterion_type achievement_criterion_type NOT NULL,
  criterion_parameters jsonb NOT NULL,
  edited_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (achievement_criterion_parameters_valid(criterion_type, criterion_parameters))
);

ALTER TABLE user_trail_states
  ADD COLUMN catalog_change_pending boolean NOT NULL DEFAULT false;

CREATE FUNCTION assert_trail_revision_graph_valid(p_revision_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  step_count integer;
  minimum_position integer;
  maximum_position integer;
BEGIN
  SELECT count(*), min(position), max(position)
  INTO step_count, minimum_position, maximum_position
  FROM trail_revision_steps
  WHERE trail_revision_id = p_revision_id;

  IF step_count > 0 AND (minimum_position <> 1 OR maximum_position <> step_count) THEN
    RAISE EXCEPTION 'trail step positions must be contiguous from one' USING ERRCODE = '23514';
  END IF;

  IF EXISTS (
    WITH RECURSIVE walk(origin_step_id, step_id) AS (
      SELECT step_id, prerequisite_step_id
      FROM trail_step_prerequisites
      WHERE trail_revision_id = p_revision_id
      UNION
      SELECT walk.origin_step_id, prerequisite.prerequisite_step_id
      FROM walk
      JOIN trail_step_prerequisites prerequisite
        ON prerequisite.trail_revision_id = p_revision_id
       AND prerequisite.step_id = walk.step_id
    )
    SELECT 1 FROM walk WHERE origin_step_id = step_id
  ) THEN
    RAISE EXCEPTION 'trail prerequisites must be acyclic' USING ERRCODE = '23514';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION reject_cyclic_trail_prerequisites()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM assert_trail_revision_graph_valid(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.trail_revision_id ELSE NEW.trail_revision_id END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

DROP TRIGGER trail_step_prerequisites_are_acyclic ON trail_step_prerequisites;
CREATE CONSTRAINT TRIGGER trail_step_prerequisites_are_acyclic
AFTER INSERT OR UPDATE OR DELETE ON trail_step_prerequisites
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION reject_cyclic_trail_prerequisites();

CREATE FUNCTION validate_trail_revision_positions()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM assert_trail_revision_graph_valid(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.trail_revision_id ELSE NEW.trail_revision_id END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

CREATE CONSTRAINT TRIGGER trail_revision_positions_are_contiguous
AFTER INSERT OR UPDATE OR DELETE ON trail_revision_steps
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_trail_revision_positions();

CREATE OR REPLACE FUNCTION reject_published_revision_graph_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_revision_id uuid;
BEGIN
  v_revision_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.trail_revision_id ELSE NEW.trail_revision_id END;
  IF EXISTS (
    SELECT 1 FROM catalog_publications publication
    WHERE publication.resource_type = 'trail' AND publication.revision_id = v_revision_id
  ) THEN
    RAISE EXCEPTION 'published trail revision graph is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

CREATE OR REPLACE FUNCTION reject_published_certification_graph_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_revision_id uuid;
BEGIN
  v_revision_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.certification_revision_id
    ELSE NEW.certification_revision_id
  END;
  IF EXISTS (
    SELECT 1 FROM catalog_publications publication
    WHERE publication.resource_type = 'certification'
      AND publication.revision_id = v_revision_id
  ) THEN
    RAISE EXCEPTION 'published certification revision graph is immutable' USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END
$$;

CREATE TRIGGER trail_target_roles_are_immutable_after_publication
BEFORE INSERT OR UPDATE OR DELETE ON trail_target_roles
FOR EACH ROW EXECUTE FUNCTION reject_published_revision_graph_mutation();

CREATE OR REPLACE FUNCTION validate_catalog_publication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_status catalog_root_status;
  current_revision_id uuid;
BEGIN
  EXECUTE format('SELECT status, published_revision_id FROM %I WHERE id = $1', TG_TABLE_NAME)
    INTO current_status, current_revision_id USING NEW.id;
  IF current_status = 'published' AND current_revision_id IS NULL THEN
    RAISE EXCEPTION 'published catalog roots require a revision' USING ERRCODE = '23514';
  END IF;
  IF current_status IN ('draft', 'unpublished') AND current_revision_id IS NOT NULL THEN
    RAISE EXCEPTION 'non-published catalog roots cannot expose a revision' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'learning_trails' AND current_status = 'published' THEN
    IF NOT EXISTS (
      SELECT 1 FROM trail_revision_steps WHERE trail_revision_id = current_revision_id
    ) THEN
      RAISE EXCEPTION 'published trails require at least one step' USING ERRCODE = '23514';
    END IF;
    PERFORM assert_trail_revision_graph_valid(current_revision_id);
  END IF;
  RETURN NEW;
END
$$;

CREATE INDEX catalog_publications_resource_idx
  ON catalog_publications (resource_type, resource_id, published_at DESC);
CREATE INDEX category_drafts_editor_idx ON category_drafts (edited_by_user_id);
CREATE INDEX skill_drafts_category_idx ON skill_drafts (category_id);
CREATE INDEX trail_drafts_category_idx ON trail_drafts (category_id);
CREATE INDEX trail_draft_step_skills_skill_idx ON trail_draft_step_skills (skill_id);
CREATE INDEX trail_draft_prerequisite_idx
  ON trail_draft_step_prerequisites (trail_id, prerequisite_step_id);
CREATE INDEX certification_draft_skills_skill_idx ON certification_draft_skills (skill_id);
CREATE INDEX certification_draft_trails_trail_idx ON certification_draft_trails (trail_id);
CREATE INDEX certification_draft_requirements_skill_idx ON certification_draft_requirements (skill_id);
CREATE INDEX certification_draft_requirements_trail_idx ON certification_draft_requirements (trail_id);

GRANT SELECT, INSERT ON catalog_publications TO skill_maps_runtime;
GRANT SELECT, INSERT, UPDATE ON skill_categories, skills, learning_trails, certifications, achievements
  TO skill_maps_runtime;
GRANT SELECT, INSERT ON category_revisions, skill_revisions, trail_revisions,
  trail_steps, trail_revision_steps, trail_step_skills, trail_step_prerequisites,
  trail_target_roles, certification_revisions, certification_revision_skills,
  certification_revision_trails, certification_requirements, achievement_revisions
  TO skill_maps_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON category_drafts, skill_drafts, trail_drafts,
  trail_draft_steps, trail_draft_step_skills, trail_draft_step_prerequisites,
  trail_draft_target_roles, certification_drafts, certification_draft_skills,
  certification_draft_trails, certification_draft_requirements, achievement_drafts
  TO skill_maps_runtime;
GRANT USAGE ON TYPE catalog_publication_resource_type TO skill_maps_runtime;
