import { describe, expect, it } from 'vitest';

import { ProgressRepository } from '../../src/modules/progress/repository.js';
import { ProgressService } from '../../src/modules/progress/service.js';
import { withPostgres } from '../support/postgres.js';
import { progressIds, seedProgressCatalog } from '../support/progress.js';

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')('progress stream concurrency', () => {
  it('serializes distinct commands from one base version and preserves both in monotonic order', async () => {
    await withPostgres(async ({ admin, database }) => {
      await seedProgressCatalog(admin);
      const service = new ProgressService(new ProgressRepository(database.db));
      await service.start(progressIds.user, progressIds.trail, progressIds.commandOne);

      const [first, second] = await Promise.all([
        service.append(
          progressIds.user,
          progressIds.trail,
          progressIds.stepOne,
          progressIds.commandTwo,
          {
            state: 'in_progress',
            baseStreamVersion: 0,
          },
        ),
        service.append(
          progressIds.user,
          progressIds.trail,
          progressIds.stepOne,
          progressIds.commandThree,
          {
            state: 'completed',
            baseStreamVersion: 0,
          },
        ),
      ]);

      expect([first.streamVersion, second.streamVersion].sort()).toEqual([1, 2]);
      const progress = await service.get(progressIds.user, progressIds.trail);
      expect(progress.history.map((event) => event.eventId)).toHaveLength(2);
      expect(progress.streamVersion).toBe(2);
      expect(progress.reviewRequired).toBe(true);
    });
  });
});
