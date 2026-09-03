CREATE TYPE progress_step_state AS ENUM ('not_started', 'in_progress', 'completed');
CREATE TYPE progress_event_source AS ENUM ('user', 'admin_correction', 'system');
CREATE TYPE user_trail_status AS ENUM ('in_progress', 'completed');

CREATE TABLE user_trail_states (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trail_id uuid NOT NULL REFERENCES learning_trails(id) ON DELETE RESTRICT,
  status user_trail_status NOT NULL DEFAULT 'in_progress',
  current_stream_version bigint NOT NULL DEFAULT 0 CHECK (current_stream_version >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  last_seen_revision_id uuid NOT NULL,
  review_required boolean NOT NULL DEFAULT false,
  start_command_id uuid NOT NULL UNIQUE,
  PRIMARY KEY (user_id, trail_id),
  FOREIGN KEY (last_seen_revision_id, trail_id)
    REFERENCES trail_revisions(id, trail_id) ON DELETE RESTRICT
);

CREATE TABLE progress_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id uuid NOT NULL,
  trail_id uuid NOT NULL,
  step_id uuid NOT NULL,
  observed_trail_revision_id uuid NOT NULL,
  new_state progress_step_state NOT NULL,
  source progress_event_source NOT NULL,
  command_id uuid NOT NULL UNIQUE,
  base_stream_version bigint NOT NULL CHECK (base_stream_version >= 0),
  stream_version bigint NOT NULL CHECK (stream_version > 0),
  supersedes_event_id bigint REFERENCES progress_events(id) ON DELETE RESTRICT,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (user_id, trail_id)
    REFERENCES user_trail_states(user_id, trail_id) ON DELETE CASCADE,
  FOREIGN KEY (step_id, trail_id)
    REFERENCES trail_steps(id, trail_id) ON DELETE RESTRICT,
  FOREIGN KEY (observed_trail_revision_id, trail_id)
    REFERENCES trail_revisions(id, trail_id) ON DELETE RESTRICT,
  UNIQUE (user_id, trail_id, stream_version)
);

CREATE TABLE user_step_states (
  user_id uuid NOT NULL,
  trail_id uuid NOT NULL,
  step_id uuid NOT NULL,
  current_state progress_step_state NOT NULL DEFAULT 'not_started',
  latest_event_id bigint NOT NULL REFERENCES progress_events(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trail_id, step_id),
  FOREIGN KEY (user_id, trail_id)
    REFERENCES user_trail_states(user_id, trail_id) ON DELETE CASCADE,
  FOREIGN KEY (step_id, trail_id)
    REFERENCES trail_steps(id, trail_id) ON DELETE RESTRICT
);

CREATE FUNCTION reject_progress_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('skill_maps.erasure_context', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'progress events are append-only' USING ERRCODE = '55000';
END
$$;

CREATE TRIGGER progress_events_are_append_only
BEFORE UPDATE OR DELETE ON progress_events
FOR EACH ROW EXECUTE FUNCTION reject_progress_event_mutation();

CREATE TRIGGER progress_events_cannot_be_truncated
BEFORE TRUNCATE ON progress_events
FOR EACH STATEMENT EXECUTE FUNCTION reject_progress_event_mutation();

CREATE INDEX user_trail_states_activity_idx
  ON user_trail_states (user_id, last_activity_at DESC);
CREATE INDEX user_trail_states_revision_idx ON user_trail_states (last_seen_revision_id);
CREATE INDEX progress_events_stream_idx
  ON progress_events (user_id, trail_id, stream_version);
CREATE INDEX progress_events_history_idx
  ON progress_events (user_id, trail_id, occurred_at, id);
CREATE INDEX progress_events_step_idx ON progress_events (step_id);
CREATE INDEX progress_events_revision_idx ON progress_events (observed_trail_revision_id);
CREATE INDEX progress_events_supersedes_idx ON progress_events (supersedes_event_id);
CREATE INDEX user_step_states_step_idx ON user_step_states (step_id);
CREATE INDEX user_step_states_latest_event_idx ON user_step_states (latest_event_id);

REVOKE UPDATE, DELETE, TRUNCATE ON progress_events FROM PUBLIC, skill_maps_runtime;
GRANT SELECT, INSERT, UPDATE ON user_trail_states, user_step_states TO skill_maps_runtime;
GRANT DELETE ON user_step_states TO skill_maps_runtime;
GRANT SELECT, INSERT ON progress_events TO skill_maps_runtime;
GRANT USAGE, SELECT ON SEQUENCE progress_events_id_seq TO skill_maps_runtime;
GRANT USAGE ON TYPE progress_step_state, progress_event_source, user_trail_status TO skill_maps_runtime;
