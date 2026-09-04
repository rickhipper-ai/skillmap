import { describe, expect, it } from 'vitest';

import { CertificationRepository } from '../../src/modules/credentials/repository.js';
import { CertificationService } from '../../src/modules/credentials/service.js';
import { withPostgres } from '../support/postgres.js';
import {
  CapturingEmail,
  createDatabaseApp,
  csrf,
  mutate,
  registerVerifyAndLogin,
} from '../support/identity.js';

const ids = {
  admin: '10000000-0000-4000-8000-000000000001',
  owner: '10000000-0000-4000-8000-000000000002',
  certification: '50000000-0000-4000-8000-000000000001',
  revision: '51000000-0000-4000-8000-000000000001',
  achievement: '70000000-0000-4000-8000-000000000001',
  achievementRevision: '71000000-0000-4000-8000-000000000001',
  firstCommand: '60000000-0000-4000-8000-000000000001',
  duplicateCommand: '60000000-0000-4000-8000-000000000002',
  renewalCommand: '60000000-0000-4000-8000-000000000003',
} as const;

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')('certification history', () => {
  it('uses null-aware duplicate detection, maps idempotency, validates expiry, and preserves renewals', async () => {
    await withPostgres(async ({ admin, database }) => {
      await seedCertification(admin);
      const service = new CertificationService(new CertificationRepository(database.db));
      const acquisition = {
        certificationId: ids.certification,
        obtainedOn: '2026-01-10',
        externalIdentifier: null,
        expiresOn: '2027-01-10',
      };

      const first = await service.create(ids.owner, ids.firstCommand, acquisition);
      expect(await service.create(ids.owner, ids.firstCommand, acquisition)).toEqual(first);
      expect(await service.create(ids.owner, ids.duplicateCommand, acquisition)).toEqual(first);
      await expect(
        service.create(ids.owner, ids.firstCommand, { ...acquisition, obtainedOn: '2026-02-10' }),
      ).rejects.toMatchObject({ status: 409, code: 'IDEMPOTENCY_KEY_REUSED' });
      await expect(
        service.create(ids.owner, '60000000-0000-4000-8000-000000000004', {
          ...acquisition,
          expiresOn: '2026-01-10',
        }),
      ).rejects.toMatchObject({ status: 422, code: 'EXPIRY_MUST_FOLLOW_ACQUISITION' });

      const renewal = await service.create(ids.owner, ids.renewalCommand, {
        ...acquisition,
        obtainedOn: '2027-01-11',
        expiresOn: '2028-01-11',
      });
      expect(renewal.id).not.toBe(first.id);
      expect(await service.list(ids.owner)).toMatchObject([
        { id: renewal.id, obtainedOn: '2027-01-11', verificationStatus: 'self_declared' },
        { id: first.id, obtainedOn: '2026-01-10', verificationStatus: 'self_declared' },
      ]);

      const rows = await admin.query(
        'SELECT id, observed_revision_id, verification_status FROM user_certification_records WHERE user_id = $1',
        [ids.owner],
      );
      expect(rows.rows).toHaveLength(2);
      expect(rows.rows.every((row) => row.observed_revision_id === ids.revision)).toBe(true);
      expect(rows.rows.every((row) => row.verification_status === 'self_declared')).toBe(true);
      await expect(
        admin.query('UPDATE user_certification_records SET obtained_on = $1 WHERE id = $2', [
          '2025-01-01',
          first.id,
        ]),
      ).rejects.toMatchObject({ code: '55000' });

      const indexes = await admin.query<{ indexdef: string }>(
        "SELECT indexdef FROM pg_indexes WHERE indexname = 'user_certification_records_occurrence_key'",
      );
      expect(indexes.rows[0]?.indexdef).toContain('NULLS NOT DISTINCT');
    });
  });

  it('enforces authentication, ownership, CSRF, and idempotency on canonical routes', async () => {
    await withPostgres(async ({ admin, database }) => {
      const email = new CapturingEmail();
      const app = createDatabaseApp(database, email);
      try {
        const proof = await csrf(app);
        const ownerSession = await registerVerifyAndLogin(
          app,
          email,
          proof,
          'credentials.owner@example.test',
        );
        const otherSession = await registerVerifyAndLogin(
          app,
          email,
          proof,
          'credentials.other@example.test',
        );
        const owner = await admin.query<{ id: string }>(
          "SELECT id FROM users WHERE email_normalized = 'credentials.owner@example.test'",
        );
        await seedCertification(admin, owner.rows[0]!.id);
        const payload = { certificationId: ids.certification, obtainedOn: '2026-05-01' };

        expect(
          (await app.inject({ method: 'GET', url: '/v1/me/certification-records' })).statusCode,
        ).toBe(401);
        const withoutCsrf = await app.inject({
          method: 'POST',
          url: '/v1/me/certification-records',
          headers: {
            cookie: ownerSession,
            origin: 'https://app.skill-maps.test',
            'idempotency-key': ids.firstCommand,
          },
          payload,
        });
        expect(withoutCsrf.statusCode).toBe(403);

        const created = await mutate(
          app,
          proof,
          {
            method: 'POST',
            url: '/v1/me/certification-records',
            headers: { 'idempotency-key': ids.firstCommand },
            payload,
          },
          ownerSession,
        );
        expect(created.statusCode).toBe(201);
        expect(created.json()).toMatchObject({ ...payload, verificationStatus: 'self_declared' });
        const repeated = await mutate(
          app,
          proof,
          {
            method: 'POST',
            url: '/v1/me/certification-records',
            headers: { 'idempotency-key': ids.firstCommand },
            payload,
          },
          ownerSession,
        );
        expect(repeated.json()).toEqual(created.json());

        const ownerList = await app.inject({
          method: 'GET',
          url: '/v1/me/certification-records',
          headers: { cookie: ownerSession },
        });
        const otherList = await app.inject({
          method: 'GET',
          url: '/v1/me/certification-records',
          headers: { cookie: otherSession },
        });
        expect(ownerList.json()).toHaveLength(1);
        expect(otherList.json()).toEqual([]);

        const ownerAchievements = await app.inject({
          method: 'GET',
          url: '/v1/me/achievements',
          headers: { cookie: ownerSession },
        });
        const otherAchievements = await app.inject({
          method: 'GET',
          url: '/v1/me/achievements',
          headers: { cookie: otherSession },
        });
        expect(ownerAchievements.json()).toMatchObject([
          { achievementId: ids.achievement, title: 'Primeira certificacao' },
        ]);
        expect(otherAchievements.json()).toEqual([]);
      } finally {
        await app.close();
      }
    });
  });
});

async function seedCertification(
  admin: { query(query: string, values?: unknown[]): Promise<unknown> },
  ownerId: string = ids.owner,
) {
  await admin.query(`
    INSERT INTO users (id, email_normalized, email_verified, status, email_verified_at, terms_accepted_at) VALUES
      ('${ids.admin}', 'credentials.admin@example.test', true, 'active', now(), now()),
      ('${ownerId}', 'credentials.fixture@example.test', true, 'active', now(), now())
      ON CONFLICT DO NOTHING;
    INSERT INTO certifications (id, slug, status)
      VALUES ('${ids.certification}', 'credencial-teste', 'published') ON CONFLICT DO NOTHING;
    INSERT INTO certification_revisions
      (id, certification_id, revision_number, name, issuer, description, created_by_user_id)
      VALUES ('${ids.revision}', '${ids.certification}', 1, 'Credencial de teste',
        'Emissor ficticio', 'Credencial publicada para testes.', '${ids.admin}') ON CONFLICT DO NOTHING;
    UPDATE certifications SET published_revision_id = '${ids.revision}' WHERE id = '${ids.certification}';
    INSERT INTO achievements (id, slug, status)
      VALUES ('${ids.achievement}', 'primeira-certificacao-teste', 'published') ON CONFLICT DO NOTHING;
    INSERT INTO achievement_revisions
      (id, achievement_id, revision_number, title, description, icon_label, criterion_type,
       criterion_parameters, created_by_user_id)
      VALUES ('${ids.achievementRevision}', '${ids.achievement}', 1, 'Primeira certificacao',
        'Registrou uma certificacao.', 'Marco de certificacao', 'certification_records',
        '{"minimum": 1}', '${ids.admin}') ON CONFLICT DO NOTHING;
    UPDATE achievements SET published_revision_id = '${ids.achievementRevision}'
      WHERE id = '${ids.achievement}';
  `);
}
