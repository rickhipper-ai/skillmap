ALTER TABLE professional_profiles
  ADD COLUMN profile_version bigint NOT NULL DEFAULT 1 CHECK (profile_version > 0);

CREATE TYPE recommendation_target_type AS ENUM ('trail_step', 'trail');
CREATE TYPE recommendation_reason_code AS ENUM (
  'next_eligible_step',
  'desired_role',
  'interest_match'
);

CREATE FUNCTION recommendation_rules_valid(value jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT jsonb_typeof(value) = 'object'
    AND value ?& ARRAY['desiredRoleWeight', 'interestCategoryWeight', 'interestSkillWeight']
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(value) AS key
      WHERE key NOT IN ('desiredRoleWeight', 'interestCategoryWeight', 'interestSkillWeight')
    )
    AND (value->>'desiredRoleWeight') ~ '^\d+$'
    AND (value->>'interestCategoryWeight') ~ '^\d+$'
    AND (value->>'interestSkillWeight') ~ '^\d+$'
    AND (value->>'desiredRoleWeight')::integer BETWEEN 1 AND 1000
    AND (value->>'interestCategoryWeight')::integer BETWEEN 1 AND 1000
    AND (value->>'interestSkillWeight')::integer BETWEEN 1 AND 1000
$$;

CREATE TABLE recommendation_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version bigint NOT NULL UNIQUE CHECK (version > 0),
  status varchar(20) NOT NULL CHECK (status = 'published'),
  rules jsonb NOT NULL CHECK (recommendation_rules_valid(rules)),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz NOT NULL DEFAULT now(),
  CHECK (published_at >= created_at)
);

CREATE FUNCTION reject_recommendation_rule_set_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'recommendation rule sets are immutable' USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER recommendation_rule_sets_are_immutable
BEFORE UPDATE OR DELETE ON recommendation_rule_sets
FOR EACH ROW EXECUTE FUNCTION reject_recommendation_rule_set_mutation();

CREATE FUNCTION recommendation_evidence_valid(
  reason recommendation_reason_code,
  evidence jsonb
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT jsonb_typeof(evidence) = 'object'
    AND length(evidence::text) <= 4096
    AND CASE reason
      WHEN 'next_eligible_step' THEN
        evidence ?& ARRAY['position', 'completedPrerequisiteStepIds', 'progressStreamVersion']
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_object_keys(evidence) AS key
          WHERE key NOT IN ('position', 'completedPrerequisiteStepIds', 'progressStreamVersion')
        )
        AND (evidence->>'position') ~ '^[1-9]\d*$'
        AND (evidence->>'progressStreamVersion') ~ '^\d+$'
        AND jsonb_typeof(evidence->'completedPrerequisiteStepIds') = 'array'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(evidence->'completedPrerequisiteStepIds') AS item
          WHERE item !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        )
      ELSE
        evidence ? 'score'
        AND evidence ? 'matchedInterestSkillIds'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_object_keys(evidence) AS key
          WHERE key NOT IN ('desiredRoleId', 'matchedInterestCategoryId', 'matchedInterestSkillIds', 'score')
        )
        AND (evidence->>'score') ~ '^[1-9]\d*$'
        AND (NOT evidence ? 'desiredRoleId' OR (evidence->>'desiredRoleId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
        AND (NOT evidence ? 'matchedInterestCategoryId' OR (evidence->>'matchedInterestCategoryId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
        AND (NOT evidence ? 'matchedInterestSkillIds' OR (
          jsonb_typeof(evidence->'matchedInterestSkillIds') = 'array'
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(evidence->'matchedInterestSkillIds') AS item
            WHERE item !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          )
        ))
        AND CASE reason
          WHEN 'desired_role' THEN evidence ? 'desiredRoleId'
          ELSE evidence ? 'matchedInterestCategoryId'
            OR jsonb_array_length(evidence->'matchedInterestSkillIds') > 0
        END
    END
$$;

CREATE TABLE learning_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_set_id uuid NOT NULL REFERENCES recommendation_rule_sets(id) ON DELETE RESTRICT,
  target_type recommendation_target_type NOT NULL,
  trail_id uuid NOT NULL REFERENCES learning_trails(id) ON DELETE RESTRICT,
  step_id uuid,
  rank smallint NOT NULL CHECK (rank BETWEEN 1 AND 3),
  reason_code recommendation_reason_code NOT NULL,
  evidence jsonb NOT NULL,
  profile_version bigint NOT NULL CHECK (profile_version >= 0),
  progress_stream_version bigint NOT NULL CHECK (progress_stream_version >= 0),
  catalog_revision_id uuid NOT NULL REFERENCES trail_revisions(id) ON DELETE RESTRICT,
  generated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (step_id, trail_id) REFERENCES trail_steps(id, trail_id) ON DELETE RESTRICT,
  CHECK (
    (target_type = 'trail_step' AND step_id IS NOT NULL AND reason_code = 'next_eligible_step')
    OR (target_type = 'trail' AND step_id IS NULL AND reason_code IN ('desired_role', 'interest_match'))
  ),
  CHECK (recommendation_evidence_valid(reason_code, evidence))
);

CREATE FUNCTION reject_recommendation_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('skill_maps.erasure_context', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'recommendation snapshots are immutable' USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER learning_recommendations_are_immutable
BEFORE UPDATE OR DELETE ON learning_recommendations
FOR EACH ROW EXECUTE FUNCTION reject_recommendation_snapshot_mutation();

CREATE INDEX recommendation_rule_sets_published_version_idx
  ON recommendation_rule_sets (status, version DESC);
CREATE INDEX learning_recommendations_user_generated_idx
  ON learning_recommendations (user_id, generated_at DESC, rank);
CREATE INDEX learning_recommendations_input_versions_idx
  ON learning_recommendations (
    user_id, rule_set_id, profile_version, progress_stream_version, catalog_revision_id
  );
CREATE INDEX learning_recommendations_rule_set_idx ON learning_recommendations (rule_set_id);
CREATE INDEX learning_recommendations_trail_idx ON learning_recommendations (trail_id);
CREATE INDEX learning_recommendations_step_idx ON learning_recommendations (step_id);
CREATE INDEX learning_recommendations_catalog_revision_idx
  ON learning_recommendations (catalog_revision_id);

INSERT INTO recommendation_rule_sets (id, version, status, rules)
VALUES (
  '50000000-0000-4000-8000-000000000001',
  1,
  'published',
  '{"desiredRoleWeight": 100, "interestCategoryWeight": 20, "interestSkillWeight": 5}'::jsonb
);

GRANT SELECT ON recommendation_rule_sets TO skill_maps_runtime;
GRANT SELECT, INSERT ON learning_recommendations TO skill_maps_runtime;
GRANT USAGE ON TYPE recommendation_target_type, recommendation_reason_code TO skill_maps_runtime;
