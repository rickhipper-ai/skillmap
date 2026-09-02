CREATE TYPE certification_requirement_type AS ENUM ('skill', 'trail');

CREATE TABLE category_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES skill_categories(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  name varchar(160) NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (category_id, revision_number),
  UNIQUE (id, category_id)
);

ALTER TABLE skill_categories ADD COLUMN published_revision_id uuid;
ALTER TABLE skill_categories
  ADD CONSTRAINT skill_categories_published_revision_fk
  FOREIGN KEY (published_revision_id, id)
  REFERENCES category_revisions(id, category_id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE skill_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  category_id uuid NOT NULL REFERENCES skill_categories(id) ON DELETE RESTRICT,
  name varchar(160) NOT NULL CHECK (length(btrim(name)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) > 0 AND length(description) <= 10000),
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (skill_id, revision_number),
  UNIQUE (id, skill_id)
);

ALTER TABLE skills ADD COLUMN published_revision_id uuid;
ALTER TABLE skills
  ADD CONSTRAINT skills_published_revision_fk
  FOREIGN KEY (published_revision_id, id)
  REFERENCES skill_revisions(id, skill_id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE learning_trails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL UNIQUE
    CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status catalog_root_status NOT NULL DEFAULT 'draft',
  published_revision_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE trail_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id uuid NOT NULL REFERENCES learning_trails(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  category_id uuid NOT NULL REFERENCES skill_categories(id) ON DELETE RESTRICT,
  title varchar(180) NOT NULL CHECK (length(btrim(title)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) > 0 AND length(description) <= 10000),
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trail_id, revision_number),
  UNIQUE (id, trail_id)
);

ALTER TABLE learning_trails
  ADD CONSTRAINT learning_trails_published_revision_fk
  FOREIGN KEY (published_revision_id, id)
  REFERENCES trail_revisions(id, trail_id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE trail_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id uuid NOT NULL REFERENCES learning_trails(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, trail_id)
);

CREATE TABLE trail_revision_steps (
  trail_revision_id uuid NOT NULL,
  step_id uuid NOT NULL,
  trail_id uuid NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  title varchar(180) NOT NULL CHECK (length(btrim(title)) > 0),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  required boolean NOT NULL DEFAULT true,
  PRIMARY KEY (trail_revision_id, step_id),
  UNIQUE (trail_revision_id, position),
  FOREIGN KEY (trail_revision_id, trail_id)
    REFERENCES trail_revisions(id, trail_id) ON DELETE RESTRICT,
  FOREIGN KEY (step_id, trail_id)
    REFERENCES trail_steps(id, trail_id) ON DELETE RESTRICT
);

CREATE TABLE trail_step_skills (
  trail_revision_id uuid NOT NULL,
  step_id uuid NOT NULL,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  PRIMARY KEY (trail_revision_id, step_id, skill_id),
  FOREIGN KEY (trail_revision_id, step_id)
    REFERENCES trail_revision_steps(trail_revision_id, step_id) ON DELETE RESTRICT
);

CREATE TABLE trail_step_prerequisites (
  trail_revision_id uuid NOT NULL,
  step_id uuid NOT NULL,
  prerequisite_step_id uuid NOT NULL,
  PRIMARY KEY (trail_revision_id, step_id, prerequisite_step_id),
  FOREIGN KEY (trail_revision_id, step_id)
    REFERENCES trail_revision_steps(trail_revision_id, step_id) ON DELETE RESTRICT,
  FOREIGN KEY (trail_revision_id, prerequisite_step_id)
    REFERENCES trail_revision_steps(trail_revision_id, step_id) ON DELETE RESTRICT,
  CHECK (step_id <> prerequisite_step_id)
);

CREATE TABLE trail_target_roles (
  trail_revision_id uuid NOT NULL REFERENCES trail_revisions(id) ON DELETE RESTRICT,
  professional_role_id uuid NOT NULL REFERENCES professional_roles(id) ON DELETE RESTRICT,
  PRIMARY KEY (trail_revision_id, professional_role_id)
);

CREATE TABLE certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug varchar(100) NOT NULL UNIQUE
    CHECK (slug = lower(slug) AND slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status catalog_root_status NOT NULL DEFAULT 'draft',
  published_revision_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE certification_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id uuid NOT NULL REFERENCES certifications(id) ON DELETE RESTRICT,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  name varchar(180) NOT NULL CHECK (length(btrim(name)) > 0),
  issuer varchar(180) NOT NULL CHECK (length(btrim(issuer)) > 0),
  description text NOT NULL CHECK (length(btrim(description)) > 0 AND length(description) <= 10000),
  default_validity_months integer CHECK (default_validity_months > 0),
  created_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (certification_id, revision_number),
  UNIQUE (id, certification_id)
);

ALTER TABLE certifications
  ADD CONSTRAINT certifications_published_revision_fk
  FOREIGN KEY (published_revision_id, id)
  REFERENCES certification_revisions(id, certification_id)
  ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE certification_revision_skills (
  certification_revision_id uuid NOT NULL REFERENCES certification_revisions(id) ON DELETE RESTRICT,
  skill_id uuid NOT NULL REFERENCES skills(id) ON DELETE RESTRICT,
  PRIMARY KEY (certification_revision_id, skill_id)
);

CREATE TABLE certification_revision_trails (
  certification_revision_id uuid NOT NULL REFERENCES certification_revisions(id) ON DELETE RESTRICT,
  trail_id uuid NOT NULL REFERENCES learning_trails(id) ON DELETE RESTRICT,
  PRIMARY KEY (certification_revision_id, trail_id)
);

CREATE TABLE certification_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_revision_id uuid NOT NULL REFERENCES certification_revisions(id) ON DELETE RESTRICT,
  title varchar(180) NOT NULL CHECK (length(btrim(title)) > 0),
  requirement_type certification_requirement_type NOT NULL,
  skill_id uuid REFERENCES skills(id) ON DELETE RESTRICT,
  trail_id uuid REFERENCES learning_trails(id) ON DELETE RESTRICT,
  required boolean NOT NULL DEFAULT true,
  position integer NOT NULL CHECK (position > 0),
  UNIQUE (certification_revision_id, position),
  CHECK (
    (requirement_type = 'skill' AND skill_id IS NOT NULL AND trail_id IS NULL)
    OR (requirement_type = 'trail' AND trail_id IS NOT NULL AND skill_id IS NULL)
  )
);

CREATE FUNCTION reject_catalog_revision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'catalog revisions are immutable' USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER category_revisions_are_immutable
BEFORE UPDATE OR DELETE ON category_revisions
FOR EACH ROW EXECUTE FUNCTION reject_catalog_revision_mutation();
CREATE TRIGGER skill_revisions_are_immutable
BEFORE UPDATE OR DELETE ON skill_revisions
FOR EACH ROW EXECUTE FUNCTION reject_catalog_revision_mutation();
CREATE TRIGGER trail_revisions_are_immutable
BEFORE UPDATE OR DELETE ON trail_revisions
FOR EACH ROW EXECUTE FUNCTION reject_catalog_revision_mutation();
CREATE TRIGGER certification_revisions_are_immutable
BEFORE UPDATE OR DELETE ON certification_revisions
FOR EACH ROW EXECUTE FUNCTION reject_catalog_revision_mutation();

CREATE FUNCTION reject_published_revision_graph_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  revision_id uuid;
  is_published boolean;
BEGIN
  revision_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.trail_revision_id ELSE NEW.trail_revision_id END;
  SELECT EXISTS (
    SELECT 1 FROM learning_trails WHERE published_revision_id = revision_id
  ) INTO is_published;
  IF is_published THEN
    RAISE EXCEPTION 'published trail revision graph is immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE FUNCTION reject_published_certification_graph_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  revision_id uuid;
  is_published boolean;
BEGIN
  revision_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.certification_revision_id
    ELSE NEW.certification_revision_id
  END;
  SELECT EXISTS (
    SELECT 1 FROM certifications WHERE published_revision_id = revision_id
  ) INTO is_published;
  IF is_published THEN
    RAISE EXCEPTION 'published certification revision graph is immutable' USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trail_revision_steps_are_immutable_after_publication
BEFORE INSERT OR UPDATE OR DELETE ON trail_revision_steps
FOR EACH ROW EXECUTE FUNCTION reject_published_revision_graph_mutation();
CREATE TRIGGER trail_step_skills_are_immutable_after_publication
BEFORE INSERT OR UPDATE OR DELETE ON trail_step_skills
FOR EACH ROW EXECUTE FUNCTION reject_published_revision_graph_mutation();
CREATE TRIGGER trail_step_prerequisites_are_immutable_after_publication
BEFORE INSERT OR UPDATE OR DELETE ON trail_step_prerequisites
FOR EACH ROW EXECUTE FUNCTION reject_published_revision_graph_mutation();
CREATE TRIGGER certification_revision_skills_are_immutable_after_publication
BEFORE INSERT OR UPDATE OR DELETE ON certification_revision_skills
FOR EACH ROW EXECUTE FUNCTION reject_published_certification_graph_mutation();
CREATE TRIGGER certification_revision_trails_are_immutable_after_publication
BEFORE INSERT OR UPDATE OR DELETE ON certification_revision_trails
FOR EACH ROW EXECUTE FUNCTION reject_published_certification_graph_mutation();
CREATE TRIGGER certification_requirements_are_immutable_after_publication
BEFORE INSERT OR UPDATE OR DELETE ON certification_requirements
FOR EACH ROW EXECUTE FUNCTION reject_published_certification_graph_mutation();

CREATE FUNCTION reject_cyclic_trail_prerequisites()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    WITH RECURSIVE reachable(step_id) AS (
      SELECT NEW.prerequisite_step_id
      UNION
      SELECT prerequisite.prerequisite_step_id
      FROM trail_step_prerequisites prerequisite
      JOIN reachable ON prerequisite.step_id = reachable.step_id
      WHERE prerequisite.trail_revision_id = NEW.trail_revision_id
    )
    SELECT 1 FROM reachable WHERE step_id = NEW.step_id
  ) THEN
    RAISE EXCEPTION 'trail prerequisites must be acyclic' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE CONSTRAINT TRIGGER trail_step_prerequisites_are_acyclic
AFTER INSERT OR UPDATE ON trail_step_prerequisites
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION reject_cyclic_trail_prerequisites();

CREATE FUNCTION validate_catalog_publication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  current_status catalog_root_status;
  current_revision_id uuid;
BEGIN
  EXECUTE format(
    'SELECT status, published_revision_id FROM %I WHERE id = $1',
    TG_TABLE_NAME
  ) INTO current_status, current_revision_id USING NEW.id;

  IF current_status = 'published' AND current_revision_id IS NULL THEN
    RAISE EXCEPTION 'published catalog roots require a revision' USING ERRCODE = '23514';
  END IF;
  IF TG_TABLE_NAME = 'learning_trails' AND current_status = 'published' AND NOT EXISTS (
    SELECT 1 FROM trail_revision_steps WHERE trail_revision_id = current_revision_id
  ) THEN
    RAISE EXCEPTION 'published trails require at least one step' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$$;

CREATE CONSTRAINT TRIGGER skill_categories_have_complete_publications
AFTER INSERT OR UPDATE ON skill_categories DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_catalog_publication();
CREATE CONSTRAINT TRIGGER skills_have_complete_publications
AFTER INSERT OR UPDATE ON skills DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_catalog_publication();
CREATE CONSTRAINT TRIGGER learning_trails_have_complete_publications
AFTER INSERT OR UPDATE ON learning_trails DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_catalog_publication();
CREATE CONSTRAINT TRIGGER certifications_have_complete_publications
AFTER INSERT OR UPDATE ON certifications DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION validate_catalog_publication();

CREATE INDEX category_revisions_category_idx ON category_revisions (category_id);
CREATE INDEX category_revisions_created_by_idx ON category_revisions (created_by_user_id);
CREATE INDEX skill_categories_publication_idx ON skill_categories (published_revision_id);
CREATE INDEX skill_revisions_skill_idx ON skill_revisions (skill_id);
CREATE INDEX skill_revisions_category_idx ON skill_revisions (category_id);
CREATE INDEX skill_revisions_created_by_idx ON skill_revisions (created_by_user_id);
CREATE INDEX skills_publication_idx ON skills (published_revision_id);
CREATE INDEX trail_revisions_trail_idx ON trail_revisions (trail_id);
CREATE INDEX trail_revisions_category_idx ON trail_revisions (category_id);
CREATE INDEX trail_revisions_created_by_idx ON trail_revisions (created_by_user_id);
CREATE INDEX learning_trails_publication_idx ON learning_trails (published_revision_id);
CREATE INDEX trail_steps_trail_idx ON trail_steps (trail_id);
CREATE INDEX trail_revision_steps_revision_trail_idx
  ON trail_revision_steps (trail_revision_id, trail_id);
CREATE INDEX trail_revision_steps_step_trail_idx ON trail_revision_steps (step_id, trail_id);
CREATE INDEX trail_step_skills_skill_idx ON trail_step_skills (skill_id);
CREATE INDEX trail_step_prerequisites_prerequisite_idx
  ON trail_step_prerequisites (trail_revision_id, prerequisite_step_id);
CREATE INDEX trail_target_roles_role_idx ON trail_target_roles (professional_role_id);
CREATE INDEX certification_revisions_certification_idx ON certification_revisions (certification_id);
CREATE INDEX certification_revisions_created_by_idx ON certification_revisions (created_by_user_id);
CREATE INDEX certifications_publication_idx ON certifications (published_revision_id);
CREATE INDEX certification_revision_skills_skill_idx ON certification_revision_skills (skill_id);
CREATE INDEX certification_revision_trails_trail_idx ON certification_revision_trails (trail_id);
CREATE INDEX certification_requirements_revision_idx ON certification_requirements (certification_revision_id);
CREATE INDEX certification_requirements_skill_idx ON certification_requirements (skill_id);
CREATE INDEX certification_requirements_trail_idx ON certification_requirements (trail_id);

GRANT SELECT ON category_revisions, skill_revisions, learning_trails, trail_revisions,
  trail_steps, trail_revision_steps, trail_step_skills, trail_step_prerequisites,
  trail_target_roles, certifications, certification_revisions,
  certification_revision_skills, certification_revision_trails,
  certification_requirements TO skill_maps_runtime;
GRANT USAGE ON TYPE certification_requirement_type TO skill_maps_runtime;
