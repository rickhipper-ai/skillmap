import { describe, expect, it } from 'vitest';

import { ProgressRepository } from '../../src/modules/progress/repository.js';
import { ProgressService } from '../../src/modules/progress/service.js';
import { withPostgres } from '../support/postgres.js';
import { progressIds, seedProgressCatalog } from '../support/progress.js';
import {
  CapturingEmail,
  createDatabaseApp,
  csrf,
  mutate,
  registerVerifyAndLogin,
} from '../support/identity.js';

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')('progress history', () => {
  it('starts only a published trail, validates prerequisites, corrects, and is idempotent', async () => {
    await withPostgres(async ({ admin, database }) => {
      await seedProgressCatalog(admin);
      const service = new ProgressService(new ProgressRepository(database.db));

      await expect(
        service.start(progressIds.user, progressIds.unpublishedTrail, progressIds.commandOne),
      ).rejects.toMatchObject({ status: 404 });
      const started = await service.start(
        progressIds.user,
        progressIds.trail,
        progressIds.commandOne,
      );
      expect(started).toMatchObject({
        percentage: 0,
        streamVersion: 0,
        steps: [{ eligible: true }, { eligible: false }],
      });

      await expect(
        service.append(
          progressIds.user,
          progressIds.trail,
          progressIds.stepTwo,
          progressIds.commandTwo,
          {
            state: 'completed',
            baseStreamVersion: 0,
          },
        ),
      ).rejects.toMatchObject({ status: 422, pendingPrerequisiteStepIds: [progressIds.stepOne] });

      const completed = await service.append(
        progressIds.user,
        progressIds.trail,
        progressIds.stepOne,
        progressIds.commandTwo,
        {
          state: 'completed',
          baseStreamVersion: 0,
        },
      );
      const repeated = await service.append(
        progressIds.user,
        progressIds.trail,
        progressIds.stepOne,
        progressIds.commandTwo,
        {
          state: 'completed',
          baseStreamVersion: 0,
        },
      );
      expect(repeated).toEqual(completed);

      const corrected = await service.append(
        progressIds.user,
        progressIds.trail,
        progressIds.stepOne,
        progressIds.commandThree,
        {
          state: 'in_progress',
          baseStreamVersion: 1,
          supersedesEventId: completed.eventId,
        },
      );
      expect(corrected.trailProgress.history).toHaveLength(2);
      expect(corrected.trailProgress.history[0]).toMatchObject({
        eventId: completed.eventId,
        state: 'completed',
      });
      expect(corrected.trailProgress.history[1]).toMatchObject({
        supersedesEventId: completed.eventId,
        state: 'in_progress',
      });
    });
  });

  it('rebuilds projections deterministically and recalculates against a new publication', async () => {
    await withPostgres(async ({ admin, database }) => {
      await seedProgressCatalog(admin);
      const repository = new ProgressRepository(database.db);
      const service = new ProgressService(repository);
      await service.start(progressIds.user, progressIds.trail, progressIds.commandOne);
      await service.append(
        progressIds.user,
        progressIds.trail,
        progressIds.stepOne,
        progressIds.commandTwo,
        {
          state: 'completed',
          baseStreamVersion: 0,
        },
      );
      const before = await service.get(progressIds.user, progressIds.trail);
      expect(before.percentage).toBe(50);

      await admin.query('UPDATE learning_trails SET published_revision_id = $1 WHERE id = $2', [
        progressIds.nextRevision,
        progressIds.trail,
      ]);
      const changed = await service.get(progressIds.user, progressIds.trail);
      expect(changed).toMatchObject({
        currentRevisionId: progressIds.nextRevision,
        percentage: 33,
        catalogChanged: true,
      });
      expect(changed.history[0]).toMatchObject({ observedRevisionId: progressIds.revision });

      await repository.rebuild(progressIds.user, progressIds.trail);
      expect(await service.get(progressIds.user, progressIds.trail)).toMatchObject({
        percentage: 33,
        streamVersion: 1,
      });
    });
  });

  it('enforces authentication, CSRF, and current-user ownership on HTTP progress routes', async () => {
    await withPostgres(async ({ admin, database }) => {
      await seedProgressCatalog(admin);
      const email = new CapturingEmail();
      const app = createDatabaseApp(database, email);
      try {
        const proof = await csrf(app);
        const firstSession = await registerVerifyAndLogin(
          app,
          email,
          proof,
          'route.progress.one@example.test',
        );
        const anonymous = await app.inject({
          method: 'GET',
          url: `/v1/me/trails/${progressIds.trail}`,
        });
        expect(anonymous.statusCode).toBe(401);

        const withoutCsrf = await app.inject({
          method: 'PUT',
          url: `/v1/me/trails/${progressIds.trail}`,
          headers: {
            cookie: firstSession,
            origin: 'https://app.skill-maps.test',
            'idempotency-key': progressIds.commandOne,
          },
        });
        expect(withoutCsrf.statusCode).toBe(403);

        const started = await mutate(
          app,
          proof,
          {
            method: 'PUT',
            url: `/v1/me/trails/${progressIds.trail}`,
            headers: { 'idempotency-key': progressIds.commandOne },
          },
          firstSession,
        );
        expect(started.statusCode).toBe(200);

        const blocked = await mutate(
          app,
          proof,
          {
            method: 'POST',
            url: `/v1/me/trails/${progressIds.trail}/steps/${progressIds.stepTwo}/events`,
            headers: { 'idempotency-key': progressIds.commandTwo },
            payload: { state: 'completed', baseStreamVersion: 0 },
          },
          firstSession,
        );
        expect(blocked.statusCode).toBe(422);
        expect(blocked.json()).toMatchObject({
          code: 'PENDING_PREREQUISITES',
          pendingPrerequisiteStepIds: [progressIds.stepOne],
          errors: [{ message: progressIds.stepOne }],
        });

        const secondSession = await registerVerifyAndLogin(
          app,
          email,
          proof,
          'route.progress.two@example.test',
        );
        const otherUserRead = await app.inject({
          method: 'GET',
          url: `/v1/me/trails/${progressIds.trail}`,
          headers: { cookie: secondSession },
        });
        expect(otherUserRead.statusCode).toBe(404);
      } finally {
        await app.close();
      }
    });
  });
});
