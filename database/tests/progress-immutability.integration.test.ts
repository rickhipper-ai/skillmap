import { describe, expect, it } from 'vitest';

import { withPostgres } from '../../apps/api/tests/support/postgres.js';
import { progressIds, seedProgressCatalog } from '../../apps/api/tests/support/progress.js';

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')('progress event immutability', () => {
  it('denies update, delete, and truncate to the runtime role', async () => {
    await withPostgres(async ({ admin, runtime }) => {
      await seedProgressCatalog(admin);
      await seedEvent(admin);

      await expect(
        runtime.query('UPDATE progress_events SET new_state = $1', ['completed']),
      ).rejects.toMatchObject({ code: '42501' });
      await expect(runtime.query('DELETE FROM progress_events')).rejects.toMatchObject({
        code: '42501',
      });
      await expect(runtime.query('TRUNCATE progress_events')).rejects.toMatchObject({
        code: '42501',
      });
    });
  });

  it('rejects mutation through the trigger even for the migration owner', async () => {
    await withPostgres(async ({ admin }) => {
      await seedProgressCatalog(admin);
      await seedEvent(admin);

      await expect(
        admin.query('UPDATE progress_events SET new_state = $1', ['completed']),
      ).rejects.toMatchObject({ code: '55000' });
      await expect(admin.query('DELETE FROM progress_events')).rejects.toMatchObject({
        code: '55000',
      });
      await expect(admin.query('TRUNCATE progress_events CASCADE')).rejects.toMatchObject({
        code: '55000',
      });
    });
  });
});

async function seedEvent(admin: { query(query: string, values?: unknown[]): Promise<unknown> }) {
  await admin.query(
    `INSERT INTO user_trail_states
       (user_id, trail_id, status, current_stream_version, started_at, last_activity_at,
        last_seen_revision_id, review_required, start_command_id)
     VALUES ($1, $2, 'in_progress', 0, now(), now(), $3, false, $4)`,
    [progressIds.user, progressIds.trail, progressIds.revision, progressIds.commandFour],
  );
  await admin.query(
    `INSERT INTO progress_events
       (user_id, trail_id, step_id, observed_trail_revision_id, new_state, source, command_id,
        base_stream_version, stream_version)
     VALUES ($1, $2, $3, $4, 'in_progress', 'user', $5, 0, 1)`,
    [
      progressIds.user,
      progressIds.trail,
      progressIds.stepOne,
      progressIds.revision,
      progressIds.commandOne,
    ],
  );
}
