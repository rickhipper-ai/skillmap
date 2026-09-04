import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { withPostgres } from '../../apps/api/tests/support/postgres.js';

const migrationUrl = new URL('../migrations/0007_catalog_administration.sql', import.meta.url);

describe('catalog administration migration', () => {
  it('completes rather than duplicates existing catalog objects', async () => {
    const migration = await readFile(migrationUrl, 'utf8');

    expect(migration).not.toMatch(
      /CREATE TABLE (skill_categories|skills|learning_trails|certifications|achievements)\b/i,
    );
    expect(migration).toMatch(/CREATE CONSTRAINT TRIGGER[\s\S]+DEFERRABLE INITIALLY DEFERRED/i);
    expect(migration).toMatch(/published trail revision graph is immutable/i);
    expect(migration).toMatch(/catalog_change_pending/i);
  });
});

describe.runIf(process.env.SKILL_MAPS_DATABASE_TESTS === '1')(
  'deferred trail publication invariants',
  () => {
    it('rejects self, dangling, cross-trail, cyclic, and non-contiguous graphs at commit', async () => {
      await withPostgres(async ({ admin }) => {
        await seedGraph(admin);

        await expect(
          admin.query(`INSERT INTO trail_step_prerequisites
            (trail_revision_id, step_id, prerequisite_step_id)
            VALUES ('41000000-0000-4000-8000-000000000001',
              '42000000-0000-4000-8000-000000000001',
              '42000000-0000-4000-8000-000000000001')`),
        ).rejects.toMatchObject({ code: '23514' });
        await expect(
          admin.query(`INSERT INTO trail_step_prerequisites
            (trail_revision_id, step_id, prerequisite_step_id)
            VALUES ('41000000-0000-4000-8000-000000000001',
              '42000000-0000-4000-8000-000000000002', gen_random_uuid())`),
        ).rejects.toMatchObject({ code: '23503' });
        await expect(
          admin.query(`INSERT INTO trail_revision_steps
            (trail_revision_id, step_id, trail_id, position, title)
            VALUES ('41000000-0000-4000-8000-000000000001',
              '42000000-0000-4000-8000-000000000003',
              '40000000-0000-4000-8000-000000000001', 3, 'Cross trail')`),
        ).rejects.toMatchObject({ code: '23503' });

        await expect(
          admin.query(`BEGIN;
            INSERT INTO trail_step_prerequisites VALUES
              ('41000000-0000-4000-8000-000000000001',
                '42000000-0000-4000-8000-000000000002',
                '42000000-0000-4000-8000-000000000001'),
              ('41000000-0000-4000-8000-000000000001',
                '42000000-0000-4000-8000-000000000001',
                '42000000-0000-4000-8000-000000000002');
            COMMIT;`),
        ).rejects.toMatchObject({ code: '23514' });
        await admin.query('ROLLBACK');

        await expect(
          admin.query(`BEGIN;
            UPDATE trail_revision_steps SET position = position + 2
            WHERE trail_revision_id = '41000000-0000-4000-8000-000000000001';
            UPDATE learning_trails SET status = 'published',
              published_revision_id = '41000000-0000-4000-8000-000000000001'
            WHERE id = '40000000-0000-4000-8000-000000000001';
            COMMIT;`),
        ).rejects.toMatchObject({ code: '23514' });
        await admin.query('ROLLBACK');
      });
    });

    it('commits one complete graph atomically and keeps it immutable after pointer swaps', async () => {
      await withPostgres(async ({ admin }) => {
        await seedGraph(admin);
        await admin.query(`BEGIN;
          INSERT INTO trail_step_prerequisites VALUES
            ('41000000-0000-4000-8000-000000000001',
              '42000000-0000-4000-8000-000000000002',
              '42000000-0000-4000-8000-000000000001');
          INSERT INTO catalog_publications
            (resource_type, resource_id, revision_id, revision_number, idempotency_key, published_by_user_id)
          VALUES ('trail', '40000000-0000-4000-8000-000000000001',
            '41000000-0000-4000-8000-000000000001', 1,
            '90000000-0000-4000-8000-000000000001',
            '10000000-0000-4000-8000-000000000001');
          UPDATE learning_trails SET status = 'published',
            published_revision_id = '41000000-0000-4000-8000-000000000001'
          WHERE id = '40000000-0000-4000-8000-000000000001';
          COMMIT;`);

        await admin.query(`UPDATE learning_trails SET status = 'unpublished', published_revision_id = NULL
          WHERE id = '40000000-0000-4000-8000-000000000001'`);
        await expect(
          admin.query(`UPDATE trail_revision_steps SET title = 'Mutated'
            WHERE trail_revision_id = '41000000-0000-4000-8000-000000000001'
              AND step_id = '42000000-0000-4000-8000-000000000001'`),
        ).rejects.toMatchObject({ code: '55000' });
      });
    });
  },
);

async function seedGraph(admin: { query(query: string): Promise<unknown> }) {
  await admin.query(`
    INSERT INTO users (id, email_normalized, email_verified, status, email_verified_at, terms_accepted_at)
    VALUES ('10000000-0000-4000-8000-000000000001', 'graph.admin@example.test', true, 'active', now(), now());
    INSERT INTO skill_categories (id, slug, status)
    VALUES ('20000000-0000-4000-8000-000000000001', 'dados', 'published');
    INSERT INTO category_revisions (id, category_id, revision_number, name, description, created_by_user_id)
    VALUES ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1,
      'Dados', 'Dados', '10000000-0000-4000-8000-000000000001');
    UPDATE skill_categories SET published_revision_id = '21000000-0000-4000-8000-000000000001';
    INSERT INTO learning_trails (id, slug) VALUES
      ('40000000-0000-4000-8000-000000000001', 'principal'),
      ('40000000-0000-4000-8000-000000000002', 'outra');
    INSERT INTO trail_revisions (id, trail_id, revision_number, category_id, title, description, created_by_user_id) VALUES
      ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1,
        '20000000-0000-4000-8000-000000000001', 'Principal', 'Principal', '10000000-0000-4000-8000-000000000001'),
      ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 1,
        '20000000-0000-4000-8000-000000000001', 'Outra', 'Outra', '10000000-0000-4000-8000-000000000001');
    INSERT INTO trail_steps (id, trail_id) VALUES
      ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001'),
      ('42000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001'),
      ('42000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000002');
    INSERT INTO trail_revision_steps (trail_revision_id, step_id, trail_id, position, title) VALUES
      ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001',
        '40000000-0000-4000-8000-000000000001', 1, 'Um'),
      ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002',
        '40000000-0000-4000-8000-000000000001', 2, 'Dois');
  `);
}
