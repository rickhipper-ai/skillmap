import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

export interface FoundationDatabase {
  audit_events: {
    id: bigint;
    event_type: string;
    actor_id: string | null;
    subject_id: string | null;
    request_id: string | null;
    outcome: 'success' | 'denied' | 'failure';
    metadata: unknown;
    occurred_at: Date;
  };
  background_jobs: {
    id: string;
    job_type: string;
    idempotency_key: string;
    payload: unknown;
    status: 'pending' | 'running' | 'retry' | 'completed' | 'failed';
    available_at: Date;
    attempts: number;
    max_attempts: number;
    last_error_code: string | null;
    locked_at: Date | null;
    completed_at: Date | null;
    created_at: Date;
    updated_at: Date;
  };
  users: Record<string, unknown>;
  auth_accounts: Record<string, unknown>;
  auth_sessions: Record<string, unknown>;
  auth_tokens: Record<string, unknown>;
  user_roles: Record<string, unknown>;
  professional_roles: Record<string, unknown>;
  professional_profiles: Record<string, unknown>;
  skill_categories: Record<string, unknown>;
  skills: Record<string, unknown>;
  category_revisions: Record<string, unknown>;
  skill_revisions: Record<string, unknown>;
  learning_trails: Record<string, unknown>;
  trail_revisions: Record<string, unknown>;
  trail_steps: Record<string, unknown>;
  trail_revision_steps: Record<string, unknown>;
  trail_step_skills: Record<string, unknown>;
  trail_step_prerequisites: Record<string, unknown>;
  trail_target_roles: Record<string, unknown>;
  certifications: Record<string, unknown>;
  certification_revisions: Record<string, unknown>;
  certification_revision_skills: Record<string, unknown>;
  certification_revision_trails: Record<string, unknown>;
  certification_requirements: Record<string, unknown>;
  user_certification_records: Record<string, unknown>;
  certification_record_commands: Record<string, unknown>;
  achievements: Record<string, unknown>;
  achievement_revisions: Record<string, unknown>;
  user_achievement_awards: Record<string, unknown>;
  catalog_publications: Record<string, unknown>;
  category_drafts: Record<string, unknown>;
  skill_drafts: Record<string, unknown>;
  trail_drafts: Record<string, unknown>;
  trail_draft_steps: Record<string, unknown>;
  trail_draft_step_skills: Record<string, unknown>;
  trail_draft_step_prerequisites: Record<string, unknown>;
  trail_draft_target_roles: Record<string, unknown>;
  certification_drafts: Record<string, unknown>;
  certification_draft_skills: Record<string, unknown>;
  certification_draft_trails: Record<string, unknown>;
  certification_draft_requirements: Record<string, unknown>;
  achievement_drafts: Record<string, unknown>;
  user_trail_states: Record<string, unknown>;
  user_step_states: Record<string, unknown>;
  progress_events: Record<string, unknown>;
  recommendation_rule_sets: Record<string, unknown>;
  learning_recommendations: Record<string, unknown>;
  profile_interest_categories: Record<string, unknown>;
  profile_interest_skills: Record<string, unknown>;
  account_deletion_requests: Record<string, unknown>;
  anonymous_metrics: Record<string, unknown>;
}

export interface OwnedDatabase {
  db: Kysely<FoundationDatabase>;
  pool: Pool;
  destroy(): Promise<void>;
}

export interface DatabasePoolOptions {
  connectionTimeoutMillis?: number | undefined;
  idleTimeoutMillis?: number | undefined;
  max?: number | undefined;
  queryTimeoutMillis?: number | undefined;
  runtimeRole?: string | undefined;
}

export function createDatabase(
  connectionString: string,
  options: DatabasePoolOptions = {},
): OwnedDatabase {
  const queryTimeoutMillis = options.queryTimeoutMillis ?? 10_000;
  const pool = new Pool({
    connectionString,
    ...(options.runtimeRole ? { options: `-c role=${options.runtimeRole}` } : {}),
    connectionTimeoutMillis: options.connectionTimeoutMillis ?? 5_000,
    idleTimeoutMillis: options.idleTimeoutMillis ?? 30_000,
    max: options.max ?? 10,
    query_timeout: queryTimeoutMillis,
    statement_timeout: queryTimeoutMillis,
  });
  const db = new Kysely<FoundationDatabase>({ dialect: new PostgresDialect({ pool }) });

  return {
    db,
    pool,
    async destroy() {
      await db.destroy();
    },
  };
}
