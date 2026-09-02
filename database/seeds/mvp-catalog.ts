import { pathToFileURL } from 'node:url';

import { Pool } from 'pg';

export async function seedMvpCatalog(pool: Pool): Promise<void> {
  const alreadySeeded = await pool.query(
    "SELECT 1 FROM learning_trails WHERE id = '40000000-0000-4000-8000-000000000001'",
  );
  if (alreadySeeded.rowCount) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
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
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required');
  const pool = new Pool({ connectionString });
  try {
    await seedMvpCatalog(pool);
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
