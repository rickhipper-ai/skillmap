import { describe, expect, it } from 'vitest';

import { AchievementService } from '../../src/modules/achievements/service.js';
import { createAchievementSubscribers } from '../../src/modules/achievements/subscribers.js';
import { CertificationRepository } from '../../src/modules/credentials/repository.js';
import { CertificationService } from '../../src/modules/credentials/service.js';
import { ProgressRepository } from '../../src/modules/progress/repository.js';
import { ProgressService } from '../../src/modules/progress/service.js';
import { withPostgres } from '../support/postgres.js';

const ids = {
  admin: '10000000-0000-4000-8000-000000000001',
  user: '10000000-0000-4000-8000-000000000002',
  category: '20000000-0000-4000-8000-000000000001',
  categoryRevision: '21000000-0000-4000-8000-000000000001',
  trail: '40000000-0000-4000-8000-000000000001',
  trailRevision: '41000000-0000-4000-8000-000000000001',
  step: '42000000-0000-4000-8000-000000000001',
  certification: '50000000-0000-4000-8000-000000000001',
  certificationRevision: '51000000-0000-4000-8000-000000000001',
  progressAchievement: '70000000-0000-4000-8000-000000000001',
  progressAchievementRevision: '71000000-0000-4000-8000-000000000001',
  certificationAchievement: '70000000-0000-4000-8000-000000000002',
  certificationAchievementRevision: '71000000-0000-4000-8000-000000000002',
  start: '60000000-0000-4000-8000-000000000001',
  progressOne: '60000000-0000-4000-8000-000000000002',
  progressTwo: '60000000-0000-4000-8000-000000000003',
  certificationOne: '60000000-0000-4000-8000-000000000004',
  certificationTwo: '60000000-0000-4000-8000-000000000005',
  rollbackProgress: '60000000-0000-4000-8000-000000000006',
  rollbackCertification: '60000000-0000-4000-8000-000000000007',
} as const;

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')('achievement awards', () => {
  it('awards once across repeated progress and certification domain triggers', async () => {
    await withPostgres(async ({ admin, database }) => {
      await seedAchievements(admin);
      const achievements = new AchievementService(database.db);
      const subscribers = createAchievementSubscribers(achievements);
      const progress = new ProgressService(
        new ProgressRepository(database.db),
        subscribers.onProgressEvent,
      );
      const certifications = new CertificationService(
        new CertificationRepository(database.db),
        subscribers.onCertificationRecorded,
      );

      await progress.start(ids.user, ids.trail, ids.start);
      const progressResult = await progress.append(ids.user, ids.trail, ids.step, ids.progressOne, {
        state: 'completed',
        baseStreamVersion: 0,
      });
      await subscribers.onProgressEvent({
        userId: ids.user,
        eventId: progressResult.eventId,
      });
      await progress.append(ids.user, ids.trail, ids.step, ids.progressTwo, {
        state: 'completed',
        baseStreamVersion: 1,
      });

      const firstRecord = await certifications.create(ids.user, ids.certificationOne, {
        certificationId: ids.certification,
        obtainedOn: '2026-01-01',
      });
      await subscribers.onCertificationRecorded({ userId: ids.user, recordId: firstRecord.id });
      await certifications.create(ids.user, ids.certificationTwo, {
        certificationId: ids.certification,
        obtainedOn: '2026-01-01',
      });

      const awards = await achievements.list(ids.user);
      expect(awards).toHaveLength(2);
      expect(awards.map(({ achievementId }) => achievementId).sort()).toEqual(
        [ids.progressAchievement, ids.certificationAchievement].sort(),
      );
      const stored = await admin.query<{
        achievement_id: string;
        achievement_revision_id: string;
        awarded_at: Date;
        evidence: unknown;
      }>(
        'SELECT achievement_id, achievement_revision_id, awarded_at, evidence FROM user_achievement_awards WHERE user_id = $1 ORDER BY achievement_id',
        [ids.user],
      );
      expect(stored.rows).toHaveLength(2);
      expect(stored.rows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            achievement_id: ids.progressAchievement,
            achievement_revision_id: ids.progressAchievementRevision,
            evidence: expect.objectContaining({ criterionType: 'completed_steps' }),
          }),
          expect.objectContaining({
            achievement_id: ids.certificationAchievement,
            achievement_revision_id: ids.certificationAchievementRevision,
            evidence: expect.objectContaining({ criterionType: 'certification_records' }),
          }),
        ]),
      );
      await expect(
        admin.query(`
          INSERT INTO achievement_revisions
            (achievement_id, revision_number, title, description, icon_label, criterion_type,
             criterion_parameters, created_by_user_id)
          VALUES ('${ids.progressAchievement}', 2, 'Criterio invalido', 'Nao deve persistir',
            'Invalido', 'completed_steps', '{"minimum": 1, "expression": "true"}', '${ids.admin}')
        `),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        admin.query(
          `INSERT INTO user_achievement_awards
            (user_id, achievement_id, achievement_revision_id, evidence)
           VALUES ($1, $2, $3, '{}')`,
          [ids.admin, ids.progressAchievement, ids.progressAchievementRevision],
        ),
      ).rejects.toMatchObject({ code: '23514' });
      await expect(
        admin.query(
          'UPDATE user_achievement_awards SET awarded_at = now() WHERE user_id = $1 AND achievement_id = $2',
          [ids.user, ids.progressAchievement],
        ),
      ).rejects.toMatchObject({ code: '55000' });

      const failingProgress = new ProgressService(new ProgressRepository(database.db), async () => {
        throw new Error('SUBSCRIBER_FAILED');
      });
      await expect(
        failingProgress.append(ids.user, ids.trail, ids.step, ids.rollbackProgress, {
          state: 'in_progress',
          baseStreamVersion: 2,
        }),
      ).rejects.toThrow('SUBSCRIBER_FAILED');
      const rolledBackProgress = await admin.query(
        'SELECT current_stream_version FROM user_trail_states WHERE user_id = $1 AND trail_id = $2',
        [ids.user, ids.trail],
      );
      expect(rolledBackProgress.rows[0]).toMatchObject({ current_stream_version: '2' });
      expect(
        (
          await admin.query('SELECT 1 FROM progress_events WHERE command_id = $1', [
            ids.rollbackProgress,
          ])
        ).rowCount,
      ).toBe(0);

      const failingCertification = new CertificationService(
        new CertificationRepository(database.db),
        async () => {
          throw new Error('SUBSCRIBER_FAILED');
        },
      );
      await expect(
        failingCertification.create(ids.user, ids.rollbackCertification, {
          certificationId: ids.certification,
          obtainedOn: '2027-01-01',
        }),
      ).rejects.toThrow('SUBSCRIBER_FAILED');
      expect(
        (
          await admin.query('SELECT 1 FROM user_certification_records WHERE user_id = $1', [
            ids.user,
          ])
        ).rowCount,
      ).toBe(1);
    });
  });
});

async function seedAchievements(admin: { query(query: string): Promise<unknown> }) {
  await admin.query(`
    INSERT INTO users (id, email_normalized, email_verified, status, email_verified_at, terms_accepted_at) VALUES
      ('${ids.admin}', 'achievement.admin@example.test', true, 'active', now(), now()),
      ('${ids.user}', 'achievement.user@example.test', true, 'active', now(), now());
    INSERT INTO skill_categories (id, slug, status) VALUES ('${ids.category}', 'dados', 'published');
    INSERT INTO category_revisions (id, category_id, revision_number, name, description, created_by_user_id)
      VALUES ('${ids.categoryRevision}', '${ids.category}', 1, 'Dados', 'Dados', '${ids.admin}');
    UPDATE skill_categories SET published_revision_id = '${ids.categoryRevision}' WHERE id = '${ids.category}';
    INSERT INTO learning_trails (id, slug, status) VALUES ('${ids.trail}', 'trilha', 'published');
    INSERT INTO trail_revisions (id, trail_id, revision_number, category_id, title, description, created_by_user_id)
      VALUES ('${ids.trailRevision}', '${ids.trail}', 1, '${ids.category}', 'Trilha', 'Trilha', '${ids.admin}');
    INSERT INTO trail_steps (id, trail_id) VALUES ('${ids.step}', '${ids.trail}');
    INSERT INTO trail_revision_steps (trail_revision_id, step_id, trail_id, position, title, required)
      VALUES ('${ids.trailRevision}', '${ids.step}', '${ids.trail}', 1, 'Etapa', true);
    UPDATE learning_trails SET published_revision_id = '${ids.trailRevision}' WHERE id = '${ids.trail}';
    INSERT INTO certifications (id, slug, status) VALUES ('${ids.certification}', 'credencial', 'published');
    INSERT INTO certification_revisions
      (id, certification_id, revision_number, name, issuer, description, created_by_user_id)
      VALUES ('${ids.certificationRevision}', '${ids.certification}', 1, 'Credencial', 'Emissor ficticio', 'Descricao', '${ids.admin}');
    UPDATE certifications SET published_revision_id = '${ids.certificationRevision}' WHERE id = '${ids.certification}';
    INSERT INTO achievements (id, slug, status) VALUES
      ('${ids.progressAchievement}', 'primeira-etapa', 'published'),
      ('${ids.certificationAchievement}', 'primeira-certificacao', 'published');
    INSERT INTO achievement_revisions
      (id, achievement_id, revision_number, title, description, icon_label, criterion_type,
       criterion_parameters, created_by_user_id) VALUES
      ('${ids.progressAchievementRevision}', '${ids.progressAchievement}', 1, 'Primeira etapa',
       'Concluiu uma etapa.', 'Marco de etapa', 'completed_steps', '{"minimum": 1}', '${ids.admin}'),
      ('${ids.certificationAchievementRevision}', '${ids.certificationAchievement}', 1,
       'Primeira certificacao', 'Registrou uma certificacao.', 'Marco de certificacao',
       'certification_records', '{"minimum": 1}', '${ids.admin}');
    UPDATE achievements SET published_revision_id = CASE id
      WHEN '${ids.progressAchievement}' THEN '${ids.progressAchievementRevision}'::uuid
      ELSE '${ids.certificationAchievementRevision}'::uuid END;
  `);
}
