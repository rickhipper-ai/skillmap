# ADR 0001: Arquitetura do MVP

- Status: Aceito
- Data: 2026-09-03

## Contexto

O MVP precisa entregar catalogo publico, identidade, progresso, recomendacoes, credenciais,
administracao e apagamento para ate 10.000 usuarios e 500 sessoes ativas. Frontend e API precisam ser
implantaveis separadamente, mas um sistema distribuido adicionaria operacao sem requisito medido.

## Decisao

Usar um monorepo pnpm com uma aplicacao React/Vite estatica, uma API REST Fastify sem estado local e um
PostgreSQL relacional. Modulos de dominio permanecem em `apps/api`; o frontend consome somente o
contrato OpenAPI gerado em `packages/api-contract`. Migrations sao um job de deploy separado e os jobs
assicronos usam tabelas PostgreSQL com claims concorrentes, sem broker ou cache externo.

Imagens web e API sao construidas separadamente. O web pode encaminhar `/api` para a API; sessoes e
estado duravel ficam no PostgreSQL. OpenTelemetry, logs estruturados e health checks formam os limites
operacionais, mas backends gerenciados sao configuracao de ambiente.

## Alternativas

- SSR/full-stack unico: rejeitado porque nao ha requisito de SEO dinamico ou renderizacao autenticada
  no servidor e porque acopla os ciclos de deploy.
- Microservicos, broker, Redis ou Kubernetes: rejeitados por complexidade operacional sem escala ou
  isolamento exigidos pelo MVP.
- Banco de grafo/documentos: rejeitado porque integridade relacional, historico e transacoes atomicas
  sao requisitos centrais.

## Consequencias

- Limites e deploys web/API permanecem claros com uma unica fonte contratual.
- Transacoes entre identidade, progresso, publicacao e jobs permanecem locais ao PostgreSQL.
- Cada instancia da API consome parte do pool; capacidade deve considerar `DATABASE_POOL_MAX` vezes o
  numero de replicas.
- Falha do PostgreSQL afeta leitura, escrita, sessao e jobs; readiness, backups e restore sao controles
  obrigatorios.
- Uma futura separacao exige requisito medido, novo ADR e estrategia de consistencia/migracao.
