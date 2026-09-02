# SKILL MAPS

Aplicacao web para explorar trilhas de aprendizagem, acompanhar progresso profissional e identificar o
proximo passo recomendado.

## Estrutura

- `apps/web`: aplicacao React entregue como arquivos estaticos.
- `apps/api`: API REST Fastify executada como servico independente.
- `packages/api-contract`: snapshot OpenAPI e tipos gerados para os consumidores.
- `database`: migrations, seeds e testes de integridade PostgreSQL.
- `tests`: jornadas entre aplicacoes, fixtures e testes de carga.
- `docs/adr`: registros das decisoes arquiteturais relevantes.

## Requisitos locais

- Node.js 24 LTS
- Corepack
- Docker com Compose

## Inicio rapido

```powershell
corepack install
corepack pnpm install
Copy-Item .env.example .env
docker compose up -d
corepack pnpm dev
```

Os arquivos `.env.example` contem apenas valores ficticios. Segredos reais nao devem ser versionados.

## Qualidade

```powershell
corepack pnpm contract:generate
corepack pnpm run ci
```

Consulte `specs/001-mvp-skill-maps/quickstart.md` para os cenarios de validacao do MVP completo.
