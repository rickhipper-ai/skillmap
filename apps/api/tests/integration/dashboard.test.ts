import { describe, expect, it } from 'vitest';

import { DashboardService } from '../../src/modules/recommendations/dashboard-service.js';
import { withPostgres } from '../support/postgres.js';
import {
  CapturingEmail,
  createDatabaseApp,
  csrf,
  registerVerifyAndLogin,
} from '../support/identity.js';

const ids = {
  admin: '11000000-0000-4000-8000-000000000001',
  owner: '11000000-0000-4000-8000-000000000002',
  other: '11000000-0000-4000-8000-000000000003',
  role: '12000000-0000-4000-8000-000000000001',
  category: '22000000-0000-4000-8000-000000000001',
  categoryRevision: '22100000-0000-4000-8000-000000000001',
  skill: '32000000-0000-4000-8000-000000000001',
  skillRevision: '32100000-0000-4000-8000-000000000001',
  activeTrail: '42000000-0000-4000-8000-000000000001',
  alternativeTrail: '42000000-0000-4000-8000-000000000002',
  activeRevision: '42100000-0000-4000-8000-000000000001',
  alternativeRevision: '42100000-0000-4000-8000-000000000002',
  firstStep: '42200000-0000-4000-8000-000000000001',
  nextStep: '42200000-0000-4000-8000-000000000002',
  alternativeStep: '42200000-0000-4000-8000-000000000003',
  start: '61000000-0000-4000-8000-000000000001',
  command: '61000000-0000-4000-8000-000000000002',
} as const;

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')('dashboard aggregation', () => {
  it('aggregates current progress and empty-compatible US5 reads into a versioned snapshot', async () => {
    await withPostgres(async ({ admin, database }) => {
      await seedDashboard(admin);
      const service = new DashboardService(database.db);

      const first = await service.get(ids.owner);
      const repeated = await service.get(ids.owner);

      expect(first.activeTrails).toEqual([
        expect.objectContaining({
          trailId: ids.activeTrail,
          title: 'Engenharia de dados',
          currentRevisionId: ids.activeRevision,
          percentage: 50,
          streamVersion: 1,
          lastActivityAt: '2026-09-03T10:00:00.000Z',
        }),
      ]);
      expect(first.certificationRecords).toEqual([]);
      expect(first.achievements).toEqual([]);
      expect(first.recommendations).toHaveLength(1);
      expect(first.recommendations[0]).toMatchObject({
        rank: 1,
        targetType: 'trail_step',
        trailId: ids.activeTrail,
        stepId: ids.nextStep,
        title: 'Construir um pipeline',
        reasonCode: 'next_eligible_step',
        inputVersions: {
          ruleSetVersion: 1,
          profileVersion: 1,
          progressStreamVersion: 1,
          catalogRevisionId: ids.activeRevision,
        },
      });
      expect(
        repeated.recommendations.map(({ trailId, stepId, rank }) => ({ trailId, stepId, rank })),
      ).toEqual(
        first.recommendations.map(({ trailId, stepId, rank }) => ({ trailId, stepId, rank })),
      );

      const snapshots = await admin.query(
        'SELECT evidence, profile_version, progress_stream_version, catalog_revision_id FROM learning_recommendations WHERE user_id = $1 ORDER BY generated_at, rank',
        [ids.owner],
      );
      expect(snapshots.rows).toHaveLength(2);
      expect(snapshots.rows[0]).toMatchObject({
        profile_version: '1',
        progress_stream_version: '1',
        catalog_revision_id: ids.activeRevision,
      });
      await expect(
        admin.query('UPDATE recommendation_rule_sets SET version = 2 WHERE version = 1'),
      ).rejects.toMatchObject({ code: '55000' });
      await expect(
        admin.query('UPDATE learning_recommendations SET rank = 2 WHERE user_id = $1', [ids.owner]),
      ).rejects.toMatchObject({ code: '55000' });
      const indexes = await admin.query<{ indexname: string }>(
        "SELECT indexname FROM pg_indexes WHERE tablename = 'learning_recommendations'",
      );
      expect(indexes.rows.map(({ indexname }) => indexname)).toContain(
        'learning_recommendations_input_versions_idx',
      );
      await expect(
        admin.query(`
          INSERT INTO learning_recommendations
            (user_id, rule_set_id, target_type, trail_id, step_id, rank, reason_code,
             evidence, profile_version, progress_stream_version, catalog_revision_id)
          VALUES (
            '${ids.owner}', '50000000-0000-4000-8000-000000000001', 'trail_step',
            '${ids.activeTrail}', '${ids.nextStep}', 1, 'next_eligible_step',
            '{"position": 2, "completedPrerequisiteStepIds": [], "progressStreamVersion": 1, "freeText": "not allowed"}',
            1, 1, '${ids.activeRevision}'
          )
        `),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('uses profile matches without active progress and changes input versions after profile updates', async () => {
    await withPostgres(async ({ admin, database }) => {
      await seedDashboard(admin, false);
      const service = new DashboardService(database.db);

      const before = await service.get(ids.owner);
      expect(before.activeTrails).toEqual([]);
      expect(before.recommendations[0]).toMatchObject({
        targetType: 'trail',
        trailId: ids.activeTrail,
        reasonCode: 'desired_role',
        evidence: { desiredRoleId: ids.role, score: 125 },
        inputVersions: { profileVersion: 1, progressStreamVersion: 0 },
      });

      await admin.query(
        'UPDATE professional_profiles SET profile_version = profile_version + 1, desired_role_id = NULL WHERE user_id = $1',
        [ids.owner],
      );
      const after = await service.get(ids.owner);
      expect(after.recommendations[0]).toMatchObject({
        reasonCode: 'interest_match',
        inputVersions: { profileVersion: 2 },
      });
    });
  });

  it('requires authentication and scopes every dashboard read to the session owner', async () => {
    await withPostgres(async ({ admin, database }) => {
      const email = new CapturingEmail();
      const app = createDatabaseApp(database, email);
      try {
        const proof = await csrf(app);
        const ownerSession = await registerVerifyAndLogin(
          app,
          email,
          proof,
          'dashboard.owner@example.test',
        );
        const otherSession = await registerVerifyAndLogin(
          app,
          email,
          proof,
          'dashboard.other@example.test',
        );
        const owner = await admin.query<{ id: string }>(
          "SELECT id FROM users WHERE email_normalized = 'dashboard.owner@example.test'",
        );
        await seedDashboardForExistingUser(admin, owner.rows[0]!.id);

        expect((await app.inject({ method: 'GET', url: '/v1/me/dashboard' })).statusCode).toBe(401);
        const ownerResponse = await app.inject({
          method: 'GET',
          url: '/v1/me/dashboard',
          headers: { cookie: ownerSession },
        });
        const otherResponse = await app.inject({
          method: 'GET',
          url: '/v1/me/dashboard',
          headers: { cookie: otherSession },
        });
        expect(ownerResponse.statusCode).toBe(200);
        expect(ownerResponse.json()).toMatchObject({
          activeTrails: [expect.objectContaining({ trailId: ids.activeTrail })],
        });
        expect(otherResponse.statusCode).toBe(200);
        expect(otherResponse.json()).toMatchObject({ activeTrails: [], recommendations: [] });
      } finally {
        await app.close();
      }
    });
  });
});

async function seedDashboard(
  admin: { query(query: string, values?: unknown[]): Promise<unknown> },
  active = true,
) {
  await admin.query(`
    INSERT INTO users (id, email_normalized, email_verified, status, email_verified_at, terms_accepted_at) VALUES
      ('${ids.admin}', 'dashboard.admin@example.test', true, 'active', now(), now()),
      ('${ids.owner}', 'dashboard.fixture@example.test', true, 'active', now(), now()),
      ('${ids.other}', 'dashboard.fixture.other@example.test', true, 'active', now(), now());
  `);
  await seedDashboardForExistingUser(admin, ids.owner, active);
}

async function seedDashboardForExistingUser(
  admin: { query(query: string, values?: unknown[]): Promise<unknown> },
  userId: string,
  active = true,
) {
  await admin.query(`
    INSERT INTO users (id, email_normalized, email_verified, status, email_verified_at, terms_accepted_at)
      VALUES ('${ids.admin}', 'dashboard.admin@example.test', true, 'active', now(), now())
      ON CONFLICT DO NOTHING;
    INSERT INTO professional_roles (id, slug, name) VALUES ('${ids.role}', 'engenharia-dados', 'Engenharia de dados')
      ON CONFLICT DO NOTHING;
    INSERT INTO skill_categories (id, slug, status) VALUES ('${ids.category}', 'dados', 'published')
      ON CONFLICT DO NOTHING;
    INSERT INTO category_revisions (id, category_id, revision_number, name, description, created_by_user_id)
      VALUES ('${ids.categoryRevision}', '${ids.category}', 1, 'Dados', 'Dados e plataformas', '${ids.admin}')
      ON CONFLICT DO NOTHING;
    UPDATE skill_categories SET published_revision_id = '${ids.categoryRevision}' WHERE id = '${ids.category}';
    INSERT INTO skills (id, slug, status) VALUES ('${ids.skill}', 'sql', 'published') ON CONFLICT DO NOTHING;
    INSERT INTO skill_revisions (id, skill_id, revision_number, category_id, name, description, created_by_user_id)
      VALUES ('${ids.skillRevision}', '${ids.skill}', 1, '${ids.category}', 'SQL', 'Consultas SQL', '${ids.admin}')
      ON CONFLICT DO NOTHING;
    UPDATE skills SET published_revision_id = '${ids.skillRevision}' WHERE id = '${ids.skill}';
    INSERT INTO learning_trails (id, slug, status) VALUES
      ('${ids.activeTrail}', 'engenharia-de-dados', 'published'),
      ('${ids.alternativeTrail}', 'pipelines-de-dados', 'published')
      ON CONFLICT DO NOTHING;
    INSERT INTO trail_revisions (id, trail_id, revision_number, category_id, title, description, created_by_user_id) VALUES
      ('${ids.activeRevision}', '${ids.activeTrail}', 1, '${ids.category}', 'Engenharia de dados', 'Fundamentos praticos', '${ids.admin}'),
      ('${ids.alternativeRevision}', '${ids.alternativeTrail}', 1, '${ids.category}', 'Pipelines de dados', 'Pipelines confiaveis', '${ids.admin}')
      ON CONFLICT DO NOTHING;
    INSERT INTO trail_steps (id, trail_id) VALUES
      ('${ids.firstStep}', '${ids.activeTrail}'),
      ('${ids.nextStep}', '${ids.activeTrail}'),
      ('${ids.alternativeStep}', '${ids.alternativeTrail}')
      ON CONFLICT DO NOTHING;
    INSERT INTO trail_revision_steps (trail_revision_id, step_id, trail_id, position, title, required) VALUES
      ('${ids.activeRevision}', '${ids.firstStep}', '${ids.activeTrail}', 1, 'Fundamentos de SQL', true),
      ('${ids.activeRevision}', '${ids.nextStep}', '${ids.activeTrail}', 2, 'Construir um pipeline', true),
      ('${ids.alternativeRevision}', '${ids.alternativeStep}', '${ids.alternativeTrail}', 1, 'Primeiro pipeline', true)
      ON CONFLICT DO NOTHING;
    INSERT INTO trail_step_prerequisites (trail_revision_id, step_id, prerequisite_step_id)
      VALUES ('${ids.activeRevision}', '${ids.nextStep}', '${ids.firstStep}') ON CONFLICT DO NOTHING;
    INSERT INTO trail_step_skills (trail_revision_id, step_id, skill_id) VALUES
      ('${ids.activeRevision}', '${ids.firstStep}', '${ids.skill}'),
      ('${ids.alternativeRevision}', '${ids.alternativeStep}', '${ids.skill}')
      ON CONFLICT DO NOTHING;
    INSERT INTO trail_target_roles (trail_revision_id, professional_role_id) VALUES
      ('${ids.activeRevision}', '${ids.role}'),
      ('${ids.alternativeRevision}', '${ids.role}')
      ON CONFLICT DO NOTHING;
    UPDATE learning_trails SET published_revision_id = '${ids.activeRevision}' WHERE id = '${ids.activeTrail}';
    UPDATE learning_trails SET published_revision_id = '${ids.alternativeRevision}' WHERE id = '${ids.alternativeTrail}';
    INSERT INTO professional_profiles
      (user_id, display_name, desired_role_id, experience_level, profile_version)
      VALUES ('${userId}', 'Pessoa de dados', '${ids.role}', 'intermediate', 1)
      ON CONFLICT (user_id) DO UPDATE SET desired_role_id = EXCLUDED.desired_role_id;
    INSERT INTO profile_interest_categories (user_id, category_id) VALUES ('${userId}', '${ids.category}')
      ON CONFLICT DO NOTHING;
    INSERT INTO profile_interest_skills (user_id, skill_id) VALUES ('${userId}', '${ids.skill}')
      ON CONFLICT DO NOTHING;
  `);
  if (!active) return;
  await admin.query(`
    INSERT INTO user_trail_states
      (user_id, trail_id, current_stream_version, started_at, last_activity_at, last_seen_revision_id, start_command_id)
      VALUES ('${userId}', '${ids.activeTrail}', 1, '2026-09-01T10:00:00Z', '2026-09-03T10:00:00Z', '${ids.activeRevision}', '${ids.start}')
      ON CONFLICT DO NOTHING;
    INSERT INTO progress_events
      (user_id, trail_id, step_id, observed_trail_revision_id, new_state, source, command_id, base_stream_version, stream_version, occurred_at)
      VALUES ('${userId}', '${ids.activeTrail}', '${ids.firstStep}', '${ids.activeRevision}', 'completed', 'user', '${ids.command}', 0, 1, '2026-09-03T10:00:00Z')
      ON CONFLICT DO NOTHING;
    INSERT INTO user_step_states (user_id, trail_id, step_id, current_state, latest_event_id, updated_at)
      SELECT '${userId}', '${ids.activeTrail}', '${ids.firstStep}', 'completed', id, occurred_at
      FROM progress_events WHERE command_id = '${ids.command}' ON CONFLICT DO NOTHING;
  `);
}
