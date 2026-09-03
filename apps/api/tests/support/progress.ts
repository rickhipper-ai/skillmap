import type { Pool } from 'pg';

export const progressIds = {
  admin: '10000000-0000-4000-8000-000000000001',
  user: '10000000-0000-4000-8000-000000000002',
  category: '20000000-0000-4000-8000-000000000001',
  categoryRevision: '21000000-0000-4000-8000-000000000001',
  trail: '40000000-0000-4000-8000-000000000001',
  unpublishedTrail: '40000000-0000-4000-8000-000000000099',
  revision: '41000000-0000-4000-8000-000000000001',
  nextRevision: '41000000-0000-4000-8000-000000000002',
  stepOne: '42000000-0000-4000-8000-000000000001',
  stepTwo: '42000000-0000-4000-8000-000000000002',
  stepThree: '42000000-0000-4000-8000-000000000003',
  commandOne: '60000000-0000-4000-8000-000000000001',
  commandTwo: '60000000-0000-4000-8000-000000000002',
  commandThree: '60000000-0000-4000-8000-000000000003',
  commandFour: '60000000-0000-4000-8000-000000000004',
} as const;

export async function seedProgressCatalog(admin: Pick<Pool, 'query'>) {
  await admin.query(`
    INSERT INTO users (id, email_normalized, email_verified, status, email_verified_at, terms_accepted_at) VALUES
      ('${progressIds.admin}', 'progress.admin@example.test', true, 'active', now(), now()),
      ('${progressIds.user}', 'progress.user@example.test', true, 'active', now(), now());
    INSERT INTO skill_categories (id, slug, status)
      VALUES ('${progressIds.category}', 'progresso', 'published');
    INSERT INTO category_revisions
      (id, category_id, revision_number, name, description, created_by_user_id)
      VALUES ('${progressIds.categoryRevision}', '${progressIds.category}', 1, 'Progresso', '', '${progressIds.admin}');
    UPDATE skill_categories SET published_revision_id = '${progressIds.categoryRevision}' WHERE id = '${progressIds.category}';
    INSERT INTO learning_trails (id, slug, status) VALUES
      ('${progressIds.trail}', 'trilha-progressiva', 'published'),
      ('${progressIds.unpublishedTrail}', 'trilha-rascunho', 'draft');
    INSERT INTO trail_revisions
      (id, trail_id, revision_number, category_id, title, description, created_by_user_id) VALUES
      ('${progressIds.revision}', '${progressIds.trail}', 1, '${progressIds.category}', 'Trilha progressiva', 'Aprenda em ordem', '${progressIds.admin}'),
      ('${progressIds.nextRevision}', '${progressIds.trail}', 2, '${progressIds.category}', 'Trilha progressiva', 'Aprenda em ordem atualizada', '${progressIds.admin}');
    INSERT INTO trail_steps (id, trail_id) VALUES
      ('${progressIds.stepOne}', '${progressIds.trail}'),
      ('${progressIds.stepTwo}', '${progressIds.trail}'),
      ('${progressIds.stepThree}', '${progressIds.trail}');
    INSERT INTO trail_revision_steps
      (trail_revision_id, step_id, trail_id, position, title, required) VALUES
      ('${progressIds.revision}', '${progressIds.stepOne}', '${progressIds.trail}', 1, 'Fundamentos', true),
      ('${progressIds.revision}', '${progressIds.stepTwo}', '${progressIds.trail}', 2, 'Pratica', true),
      ('${progressIds.nextRevision}', '${progressIds.stepOne}', '${progressIds.trail}', 1, 'Fundamentos', true),
      ('${progressIds.nextRevision}', '${progressIds.stepTwo}', '${progressIds.trail}', 2, 'Pratica', true),
      ('${progressIds.nextRevision}', '${progressIds.stepThree}', '${progressIds.trail}', 3, 'Revisao', true);
    INSERT INTO trail_step_prerequisites (trail_revision_id, step_id, prerequisite_step_id) VALUES
      ('${progressIds.revision}', '${progressIds.stepTwo}', '${progressIds.stepOne}'),
      ('${progressIds.nextRevision}', '${progressIds.stepTwo}', '${progressIds.stepOne}'),
      ('${progressIds.nextRevision}', '${progressIds.stepThree}', '${progressIds.stepTwo}');
    UPDATE learning_trails SET published_revision_id = '${progressIds.revision}' WHERE id = '${progressIds.trail}';
  `);
}
