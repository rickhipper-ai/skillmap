import { pathToFileURL } from 'node:url';

import { hash } from 'argon2';
import { Pool } from 'pg';

export const demoUserId = '10000000-0000-4000-8000-000000000002';

export interface DemoUserSeed {
  email: string;
  password: string;
}

export async function seedMvpCatalog(pool: Pool, demoUser: DemoUserSeed): Promise<void> {
  const email = demoUser.email.trim().toLowerCase();
  if (email.length > 320 || !/^[^\s@]+@[^\s@]+$/.test(email)) {
    throw new Error('A valid DEMO_USER_EMAIL is required');
  }
  if (demoUser.password.length < 12 || demoUser.password.length > 128) {
    throw new Error('DEMO_USER_PASSWORD must have between 12 and 128 characters');
  }
  const passwordHash = await hash(demoUser.password, {
    type: 2,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('skill-maps-mvp-seed'))");
    const alreadySeeded = await client.query(
      "SELECT 1 FROM learning_trails WHERE id = '40000000-0000-4000-8000-000000000001'",
    );
    if (!alreadySeeded.rowCount) {
      const catalogStatements = `
      INSERT INTO users (id, auth_name, email_normalized, email_verified, status, email_verified_at, terms_accepted_at) VALUES
        ('10000000-0000-4000-8000-000000000001', 'Administradora Ficticia', 'admin.catalogo@example.test', true, 'active', now(), now()),
        ('10000000-0000-4000-8000-000000000002', 'Visitante Ficticio', 'pessoa.aprendiz@example.test', true, 'active', now(), now());
      INSERT INTO user_roles (user_id, role, granted_by_user_id) VALUES
        ('10000000-0000-4000-8000-000000000001', 'content_admin', NULL),
        ('10000000-0000-4000-8000-000000000002', 'user', '10000000-0000-4000-8000-000000000001');
      INSERT INTO professional_roles (id, slug, name) VALUES
        ('11000000-0000-4000-8000-000000000001', 'engenheira-dados', 'Pessoa Engenheira de Dados'),
        ('11000000-0000-4000-8000-000000000002', 'analista-dados', 'Pessoa Analista de Dados');

      INSERT INTO skill_categories (id, slug) VALUES
        ('20000000-0000-4000-8000-000000000001', 'dados'),
        ('20000000-0000-4000-8000-000000000002', 'plataforma');
      INSERT INTO category_revisions (id, category_id, revision_number, name, description, created_by_user_id) VALUES
        ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 1, 'Dados', 'Fundamentos para coletar, consultar e comunicar dados.', '10000000-0000-4000-8000-000000000001'),
        ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 1, 'Plataforma', 'Praticas para operar sistemas e produtos de dados.', '10000000-0000-4000-8000-000000000001');
      UPDATE skill_categories SET status = 'published', published_revision_id = CASE id
        WHEN '20000000-0000-4000-8000-000000000001' THEN '21000000-0000-4000-8000-000000000001'::uuid
        ELSE '21000000-0000-4000-8000-000000000002'::uuid END
      WHERE id IN ('20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002');

      INSERT INTO skills (id, slug) VALUES
        ('30000000-0000-4000-8000-000000000001', 'sql'),
        ('30000000-0000-4000-8000-000000000002', 'modelagem-dados'),
        ('30000000-0000-4000-8000-000000000003', 'qualidade-dados'),
        ('30000000-0000-4000-8000-000000000004', 'visualizacao-dados'),
        ('30000000-0000-4000-8000-000000000005', 'pipelines-dados'),
        ('30000000-0000-4000-8000-000000000006', 'observabilidade');
      INSERT INTO skill_revisions (id, skill_id, revision_number, category_id, name, description, created_by_user_id) VALUES
        ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 1, '20000000-0000-4000-8000-000000000001', 'SQL', 'Consultar e transformar dados com SQL.', '10000000-0000-4000-8000-000000000001'),
        ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', 1, '20000000-0000-4000-8000-000000000001', 'Modelagem de dados', 'Organizar entidades, relacoes e medidas.', '10000000-0000-4000-8000-000000000001'),
        ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003', 1, '20000000-0000-4000-8000-000000000001', 'Qualidade de dados', 'Definir e verificar criterios de qualidade.', '10000000-0000-4000-8000-000000000001'),
        ('31000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004', 1, '20000000-0000-4000-8000-000000000001', 'Visualizacao de dados', 'Comunicar evidencias com visualizacoes claras.', '10000000-0000-4000-8000-000000000001'),
        ('31000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000005', 1, '20000000-0000-4000-8000-000000000002', 'Pipelines de dados', 'Construir fluxos reproduziveis de processamento.', '10000000-0000-4000-8000-000000000001'),
        ('31000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000006', 1, '20000000-0000-4000-8000-000000000002', 'Observabilidade', 'Acompanhar saude, qualidade e atrasos de sistemas.', '10000000-0000-4000-8000-000000000001');
      UPDATE skills SET status = 'published', published_revision_id = CASE id
        WHEN '30000000-0000-4000-8000-000000000001' THEN '31000000-0000-4000-8000-000000000001'::uuid
        WHEN '30000000-0000-4000-8000-000000000002' THEN '31000000-0000-4000-8000-000000000002'::uuid
        WHEN '30000000-0000-4000-8000-000000000003' THEN '31000000-0000-4000-8000-000000000003'::uuid
        WHEN '30000000-0000-4000-8000-000000000004' THEN '31000000-0000-4000-8000-000000000004'::uuid
        WHEN '30000000-0000-4000-8000-000000000005' THEN '31000000-0000-4000-8000-000000000005'::uuid
        ELSE '31000000-0000-4000-8000-000000000006'::uuid END
      WHERE id::text LIKE '30000000-0000-4000-8000-00000000000%';

      INSERT INTO learning_trails (id, slug) VALUES
        ('40000000-0000-4000-8000-000000000001', 'fundamentos-dados'),
        ('40000000-0000-4000-8000-000000000002', 'plataforma-dados');
      INSERT INTO trail_revisions (id, trail_id, revision_number, category_id, title, description, created_by_user_id) VALUES
        ('41000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, '20000000-0000-4000-8000-000000000001', 'Fundamentos de dados', 'Uma jornada de cinco etapas da consulta a comunicacao.', '10000000-0000-4000-8000-000000000001'),
        ('41000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 1, '20000000-0000-4000-8000-000000000002', 'Plataforma de dados', 'Construa e acompanhe fluxos confiaveis.', '10000000-0000-4000-8000-000000000001');
      INSERT INTO trail_steps (id, trail_id) VALUES
        ('42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001'),
        ('42000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001'),
        ('42000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001'),
        ('42000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001'),
        ('42000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000001'),
        ('42000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000002'),
        ('42000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000002');
      INSERT INTO trail_revision_steps (trail_revision_id, step_id, trail_id, position, title, description) VALUES
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 1, 'Consultar', 'Escreva consultas SQL seguras.'),
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 2, 'Modelar', 'Represente o dominio sem duplicacao.'),
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000001', 3, 'Validar', 'Aplique criterios de qualidade.'),
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001', 4, 'Visualizar', 'Escolha representacoes acessiveis.'),
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000001', 5, 'Integrar', 'Combine os fundamentos em um caso pratico.'),
        ('41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000006', '40000000-0000-4000-8000-000000000002', 1, 'Construir pipelines', 'Automatize o processamento.'),
        ('41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000007', '40000000-0000-4000-8000-000000000002', 2, 'Observar', 'Detecte falhas e atrasos.');
      INSERT INTO trail_step_skills (trail_revision_id, step_id, skill_id) VALUES
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002'),
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000003'),
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000004'),
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000001'),
        ('41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000005'),
        ('41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000001'),
        ('41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000006');
      INSERT INTO trail_step_prerequisites (trail_revision_id, step_id, prerequisite_step_id) VALUES
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000001'),
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000003', '42000000-0000-4000-8000-000000000002'),
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000004', '42000000-0000-4000-8000-000000000003'),
        ('41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000005', '42000000-0000-4000-8000-000000000004'),
        ('41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000007', '42000000-0000-4000-8000-000000000006');
      INSERT INTO trail_target_roles (trail_revision_id, professional_role_id) VALUES
        ('41000000-0000-4000-8000-000000000001', '11000000-0000-4000-8000-000000000002'),
        ('41000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001');
      UPDATE learning_trails SET status = 'published', published_revision_id = CASE id
        WHEN '40000000-0000-4000-8000-000000000001' THEN '41000000-0000-4000-8000-000000000001'::uuid
        ELSE '41000000-0000-4000-8000-000000000002'::uuid END;

      INSERT INTO certifications (id, slug) VALUES
        ('50000000-0000-4000-8000-000000000001', 'fundamentos-dados'),
        ('50000000-0000-4000-8000-000000000002', 'operacao-dados');
      INSERT INTO certification_revisions (id, certification_id, revision_number, name, issuer, description, default_validity_months, created_by_user_id) VALUES
        ('51000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 1, 'Certificacao Fundamentos de Dados', 'Instituto Ficticio de Tecnologia', 'Comprova conhecimentos introdutorios de dados.', 24, '10000000-0000-4000-8000-000000000001'),
        ('51000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 1, 'Certificacao Operacao de Dados', 'Instituto Ficticio de Tecnologia', 'Comprova praticas de operacao e observabilidade.', 24, '10000000-0000-4000-8000-000000000001');
      INSERT INTO certification_revision_skills VALUES
        ('51000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001'),
        ('51000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000003'),
        ('51000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000005'),
        ('51000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000006');
      INSERT INTO certification_revision_trails VALUES
        ('51000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001'),
        ('51000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002');
      INSERT INTO certification_requirements (id, certification_revision_id, title, requirement_type, skill_id, trail_id, position) VALUES
        ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'Conhecer SQL', 'skill', '30000000-0000-4000-8000-000000000001', NULL, 1),
        ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', 'Concluir Fundamentos de dados', 'trail', NULL, '40000000-0000-4000-8000-000000000001', 2),
        ('52000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000002', 'Concluir Plataforma de dados', 'trail', NULL, '40000000-0000-4000-8000-000000000002', 1);
      UPDATE certifications SET status = 'published', published_revision_id = CASE id
        WHEN '50000000-0000-4000-8000-000000000001' THEN '51000000-0000-4000-8000-000000000001'::uuid
        ELSE '51000000-0000-4000-8000-000000000002'::uuid END;

      INSERT INTO achievements (id, slug) VALUES
        ('70000000-0000-4000-8000-000000000001', 'primeira-etapa'),
        ('70000000-0000-4000-8000-000000000002', 'primeira-certificacao');
      INSERT INTO achievement_revisions
        (id, achievement_id, revision_number, title, description, icon_label, criterion_type,
         criterion_parameters, created_by_user_id) VALUES
        ('71000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', 1,
         'Primeira etapa', 'Concluiu sua primeira etapa de uma trilha.', 'Marco de etapa',
         'completed_steps', '{"minimum": 1}', '10000000-0000-4000-8000-000000000001'),
        ('71000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000002', 1,
         'Primeira certificacao', 'Registrou sua primeira certificacao autodeclarada.',
         'Marco de certificacao', 'certification_records', '{"minimum": 1}',
         '10000000-0000-4000-8000-000000000001');
      UPDATE achievements SET status = 'published', published_revision_id = CASE id
        WHEN '70000000-0000-4000-8000-000000000001' THEN '71000000-0000-4000-8000-000000000001'::uuid
        ELSE '71000000-0000-4000-8000-000000000002'::uuid END;

      INSERT INTO catalog_publications
        (resource_type, resource_id, revision_id, revision_number, idempotency_key,
         published_by_user_id, published_at)
      SELECT 'category'::catalog_publication_resource_type, root.id, revision.id, revision.revision_number, gen_random_uuid(),
        revision.created_by_user_id, revision.created_at
      FROM skill_categories root
      JOIN category_revisions revision ON revision.id = root.published_revision_id
      UNION ALL
      SELECT 'skill'::catalog_publication_resource_type, root.id, revision.id, revision.revision_number, gen_random_uuid(),
        revision.created_by_user_id, revision.created_at
      FROM skills root JOIN skill_revisions revision ON revision.id = root.published_revision_id
      UNION ALL
      SELECT 'trail'::catalog_publication_resource_type, root.id, revision.id, revision.revision_number, gen_random_uuid(),
        revision.created_by_user_id, revision.created_at
      FROM learning_trails root JOIN trail_revisions revision ON revision.id = root.published_revision_id
      UNION ALL
      SELECT 'certification'::catalog_publication_resource_type, root.id, revision.id, revision.revision_number, gen_random_uuid(),
        revision.created_by_user_id, revision.created_at
      FROM certifications root JOIN certification_revisions revision ON revision.id = root.published_revision_id
      UNION ALL
      SELECT 'achievement'::catalog_publication_resource_type, root.id, revision.id, revision.revision_number, gen_random_uuid(),
        revision.created_by_user_id, revision.created_at
      FROM achievements root JOIN achievement_revisions revision ON revision.id = root.published_revision_id
      ON CONFLICT DO NOTHING;
    `;
      for (const statement of catalogStatements.split(';')) {
        if (statement.trim()) await client.query(statement);
      }
    }

    const demoStatements: Array<[string, unknown[]]> = [
      [
        `
          INSERT INTO users
            (id, auth_name, email_normalized, email_verified, status, email_verified_at, terms_accepted_at)
          VALUES ($1, 'Pessoa Demo', $2, true, 'active', now(), now())
          ON CONFLICT (id) DO UPDATE SET
            auth_name = EXCLUDED.auth_name,
            email_normalized = EXCLUDED.email_normalized,
            email_verified = true,
            status = 'active',
            email_verified_at = COALESCE(users.email_verified_at, now()),
            deletion_requested_at = NULL,
            updated_at = now()
        `,
        [demoUserId, email],
      ],
      [
        `
          INSERT INTO auth_accounts
            (id, account_id, provider_id, issuer, user_id, password)
          VALUES
            ('12000000-0000-4000-8000-000000000002', $1::text, 'credential', 'local:credential', $1::uuid, $2)
          ON CONFLICT (issuer, account_id) DO UPDATE SET
            password = EXCLUDED.password,
            updated_at = now()
        `,
        [demoUserId, passwordHash],
      ],
      [
        `
          INSERT INTO user_roles (user_id, role, granted_by_user_id)
          VALUES ($1, 'user', '10000000-0000-4000-8000-000000000001')
          ON CONFLICT DO NOTHING
        `,
        [demoUserId],
      ],
      [
        `
          INSERT INTO professional_profiles
            (user_id, display_name, current_role_id, desired_role_id, experience_level, profile_version)
          VALUES (
            $1, 'Pessoa Demo',
            '11000000-0000-4000-8000-000000000002',
            '11000000-0000-4000-8000-000000000001',
            'intermediate', 1
          )
          ON CONFLICT (user_id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            current_role_id = EXCLUDED.current_role_id,
            desired_role_id = EXCLUDED.desired_role_id,
            experience_level = EXCLUDED.experience_level,
            updated_at = now()
        `,
        [demoUserId],
      ],
      [
        `
          INSERT INTO profile_interest_categories (user_id, category_id) VALUES
            ($1, '20000000-0000-4000-8000-000000000001'),
            ($1, '20000000-0000-4000-8000-000000000002')
          ON CONFLICT DO NOTHING
        `,
        [demoUserId],
      ],
      [
        `
          INSERT INTO profile_interest_skills (user_id, skill_id) VALUES
            ($1, '30000000-0000-4000-8000-000000000001'),
            ($1, '30000000-0000-4000-8000-000000000005'),
            ($1, '30000000-0000-4000-8000-000000000006')
          ON CONFLICT DO NOTHING
        `,
        [demoUserId],
      ],
      [
        `
          INSERT INTO user_trail_states
            (user_id, trail_id, status, current_stream_version, started_at, last_activity_at,
             last_seen_revision_id, start_command_id)
          VALUES
            ($1, '40000000-0000-4000-8000-000000000001', 'completed', 5,
             now() - interval '30 days', now() - interval '10 days',
             '41000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001'),
            ($1, '40000000-0000-4000-8000-000000000002', 'in_progress', 1,
              now() - interval '7 days', now() - interval '1 day',
              '41000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002')
          ON CONFLICT (user_id, trail_id) DO NOTHING
        `,
        [demoUserId],
      ],
      [
        `
          INSERT INTO progress_events
            (user_id, trail_id, step_id, observed_trail_revision_id, new_state, source,
             command_id, base_stream_version, stream_version, occurred_at)
          VALUES
            ($1, '40000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'completed', 'user', '61000000-0000-4000-8000-000000000001', 0, 1, now() - interval '28 days'),
            ($1, '40000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001', 'completed', 'user', '61000000-0000-4000-8000-000000000002', 1, 2, now() - interval '24 days'),
            ($1, '40000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000001', 'completed', 'user', '61000000-0000-4000-8000-000000000003', 2, 3, now() - interval '20 days'),
            ($1, '40000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000004', '41000000-0000-4000-8000-000000000001', 'completed', 'user', '61000000-0000-4000-8000-000000000004', 3, 4, now() - interval '15 days'),
            ($1, '40000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000001', 'completed', 'user', '61000000-0000-4000-8000-000000000005', 4, 5, now() - interval '10 days'),
            ($1, '40000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000006', '41000000-0000-4000-8000-000000000002', 'completed', 'user', '61000000-0000-4000-8000-000000000006', 0, 1, now() - interval '1 day')
          ON CONFLICT (command_id) DO NOTHING
        `,
        [demoUserId],
      ],
      [
        `
          INSERT INTO user_step_states
            (user_id, trail_id, step_id, current_state, latest_event_id, updated_at)
          SELECT event.user_id, event.trail_id, event.step_id, event.new_state, event.id, event.occurred_at
          FROM progress_events event
          WHERE event.command_id IN (
            '61000000-0000-4000-8000-000000000001',
            '61000000-0000-4000-8000-000000000002',
            '61000000-0000-4000-8000-000000000003',
            '61000000-0000-4000-8000-000000000004',
            '61000000-0000-4000-8000-000000000005',
            '61000000-0000-4000-8000-000000000006'
          )
          ON CONFLICT (user_id, trail_id, step_id) DO NOTHING
        `,
        [],
      ],
      [
        `
          INSERT INTO user_certification_records
            (id, user_id, certification_id, observed_revision_id, obtained_on,
             external_identifier, expires_on, verification_status)
          VALUES (
            '62000000-0000-4000-8000-000000000001', $1,
            '50000000-0000-4000-8000-000000000001',
            '51000000-0000-4000-8000-000000000001',
            current_date - 10, 'DEMO-DADOS-001', current_date + 720, 'self_declared'
          )
          ON CONFLICT DO NOTHING
        `,
        [demoUserId],
      ],
      [
        `
          INSERT INTO user_achievement_awards
            (user_id, achievement_id, achievement_revision_id, awarded_at, evidence)
          SELECT $1, '70000000-0000-4000-8000-000000000001',
            '71000000-0000-4000-8000-000000000001', event.occurred_at,
            jsonb_build_object(
              'criterionType', 'completed_steps', 'requiredCount', 1, 'actualCount', 6,
              'trigger', jsonb_build_object('type', 'progress_event', 'eventId', event.id)
            )
          FROM progress_events event
          WHERE event.command_id = '61000000-0000-4000-8000-000000000001'
          ON CONFLICT DO NOTHING
        `,
        [demoUserId],
      ],
      [
        `
          INSERT INTO user_achievement_awards
            (user_id, achievement_id, achievement_revision_id, evidence)
          VALUES (
            $1, '70000000-0000-4000-8000-000000000002',
            '71000000-0000-4000-8000-000000000002',
            jsonb_build_object(
              'criterionType', 'certification_records', 'requiredCount', 1, 'actualCount', 1,
              'trigger', jsonb_build_object(
                'type', 'certification_record',
                'recordId', '62000000-0000-4000-8000-000000000001'
              )
            )
          )
          ON CONFLICT DO NOTHING
        `,
        [demoUserId],
      ],
      [
        `
          INSERT INTO learning_recommendations
            (id, user_id, rule_set_id, target_type, trail_id, step_id, rank, reason_code,
             evidence, profile_version, progress_stream_version, catalog_revision_id)
          VALUES (
            '80000000-0000-4000-8000-000000000001', $1,
            '50000000-0000-4000-8000-000000000001', 'trail_step',
            '40000000-0000-4000-8000-000000000002',
            '42000000-0000-4000-8000-000000000007', 1, 'next_eligible_step',
            jsonb_build_object(
              'position', 2,
              'completedPrerequisiteStepIds', jsonb_build_array('42000000-0000-4000-8000-000000000006'),
              'progressStreamVersion', 1
            ),
            1, 6, '41000000-0000-4000-8000-000000000002'
          )
          ON CONFLICT DO NOTHING
        `,
        [demoUserId],
      ],
    ];
    for (const [statement, values] of demoStatements) {
      await client.query(statement, values);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL;
  const email = process.env.DEMO_USER_EMAIL;
  const password = process.env.DEMO_USER_PASSWORD;
  if (!connectionString) throw new Error('MIGRATION_DATABASE_URL is required');
  if (!email) throw new Error('DEMO_USER_EMAIL is required');
  if (!password || password.length < 12) {
    throw new Error('DEMO_USER_PASSWORD with at least 12 characters is required');
  }
  const pool = new Pool({ connectionString });
  try {
    await seedMvpCatalog(pool, { email, password });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
