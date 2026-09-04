# SKILL MAPS

Aplicacao web em portugues para explorar um catalogo versionado de habilidades e trilhas, acompanhar
progresso imutavel, receber recomendacoes explicadas e registrar evidencias profissionais. O MVP usa
uma aplicacao React estatica, uma API REST Fastify e PostgreSQL.

## Estrutura

- `apps/web`: React 19 e Vite, entregue como arquivos estaticos.
- `apps/api`: API Fastify, autenticacao, regras de negocio e worker de jobs no mesmo processo.
- `packages/api-contract`: OpenAPI 3.1 sincronizado e cliente TypeScript gerado.
- `database`: migrations SQL progressivas, dados ficticios e testes PostgreSQL.
- `tests`: jornadas Playwright, fixtures e carga k6.
- `docs/adr`: decisoes arquiteturais.
- `docs/operations`: observabilidade, apagamento e recuperacao.
- `docs/validation`: evidencia de release; evidencia manual ou de staging nunca e presumida.

## Requisitos

- Node.js 24 LTS
- Corepack e pnpm 11.25.0 (fixado em `package.json`)
- Docker Engine com Compose
- PowerShell 7 para o drill de restore (Windows PowerShell 5.1 tambem e suportado)
- k6 0.57.0 para carga, ou Docker para usar a imagem fixada pelo comando do projeto

URLs locais padrao:

- Web: `http://localhost:5173`
- API: `http://127.0.0.1:3000`
- OpenAPI: `http://127.0.0.1:3000/documentation/json`
- PostgreSQL: `localhost:5432`
- Mailpit SMTP/UI: `localhost:1025` e `http://localhost:8025`

## Instalacao local

Execute na raiz:

```powershell
corepack enable
corepack install
corepack pnpm install --frozen-lockfile
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/web/.env.example apps/web/.env
docker compose up -d postgres mailpit
corepack pnpm db:migrate
corepack pnpm db:seed:mvp
corepack pnpm dev
```

O Vite carrega `apps/web/.env`; os scripts locais da API carregam `apps/api/.env`. Aguarde o healthcheck
do PostgreSQL antes da migration. A migration usa `MIGRATION_DATABASE_URL` e deve rodar uma vez por
release, antes de iniciar a nova API. A API usa somente `DATABASE_URL` em runtime.

Para encerrar os servicos locais sem apagar o volume:

```powershell
docker compose down
```

Nao execute `docker compose down --volumes` em um ambiente com dados que devam ser preservados.

## Configuracao

### API

| Variavel                                | Obrigatoria | Finalidade                                                                 |
| --------------------------------------- | ----------- | -------------------------------------------------------------------------- |
| `NODE_ENV`                              | nao         | `development`, `test` ou `production`; padrao `development`                |
| `HOST` / `PORT`                         | nao         | bind da API; padroes `127.0.0.1` e `3000`                                  |
| `WEB_ORIGIN`                            | sim         | origem web exata aceita por CORS e CSRF                                    |
| `DATABASE_URL`                          | sim         | conexao do papel de runtime                                                |
| `MIGRATION_DATABASE_URL`                | sim         | conexao privilegiada usada somente pelo comando de migration               |
| `DATABASE_CONNECTION_TIMEOUT_MS`        | nao         | limite para obter conexao; padrao 5000                                     |
| `DATABASE_QUERY_TIMEOUT_MS`             | nao         | limites cliente/servidor por query; padrao 10000                           |
| `DATABASE_POOL_MAX`                     | nao         | conexoes por instancia; padrao 10, deve respeitar o limite global do banco |
| `JOB_POLL_INTERVAL_MS`                  | nao         | intervalo do worker no processo da API; padrao 1000                        |
| `AUTH_SECRET`                           | sim         | segredo aleatorio com no minimo 32 caracteres                              |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_FROM` | nao         | entrega transacional; padroes locais apontam para Mailpit                  |
| `OTEL_SERVICE_NAME`                     | nao         | nome OpenTelemetry; padrao `skill-maps-api`                                |
| `LOG_LEVEL`                             | nao         | nivel Pino; padrao `info`                                                  |

Exportadores OpenTelemetry usam as variaveis padrao do SDK na plataforma. Nao ha credencial de
telemetria no repositorio.

### Web e Compose

| Variavel                                                             | Finalidade                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------- |
| `VITE_API_BASE_URL`                                                  | URL da API em build; localmente `http://localhost:3000` |
| `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_PORT` | PostgreSQL local                                        |
| `MAILPIT_SMTP_PORT`, `MAILPIT_WEB_PORT`                              | portas locais do Mailpit                                |

Os valores versionados em `.env.example` sao exclusivamente ficticios. Em staging/producao injete
segredos pelo secret manager da plataforma; nao grave `.env`, URL com senha, token, cookie, dump,
ledger privado ou arquivo `tests/load/*-auth.json` no Git, em imagem ou em log. Rotacione imediatamente
qualquer segredo exposto e verifique o historico com o responsavel de seguranca.

## Contrato OpenAPI

O contrato de design em `specs/001-mvp-skill-maps/contracts/openapi.yaml` e sincronizado para o pacote e
gera `packages/api-contract/src/generated/`:

```powershell
corepack pnpm contract:generate
corepack pnpm contract:validate
```

A CI falha se a regeneracao produzir diff. Em pull requests e pushes ela tambem compara semanticamente
o contrato com o commit-base usando `oasdiff` fixado por digest; alteracoes incompativeis falham em vez de serem
procuradas por texto.

## Testes e qualidade

Suite completa, incluindo Testcontainers PostgreSQL:

```powershell
$env:SKILL_MAPS_DATABASE_TESTS='1'
corepack pnpm run ci
```

Portas/gates focados:

```powershell
corepack pnpm format:check
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:unit
$env:SKILL_MAPS_DATABASE_TESTS='1'; corepack pnpm test:integration
corepack pnpm contract:check
corepack pnpm build
corepack pnpm exec playwright install chromium firefox webkit
corepack pnpm test:e2e:critical
corepack pnpm test:a11y
corepack pnpm test:e2e
```

`test:e2e` executa Chromium, Firefox e WebKit em desktop, tablet e mobile. Os E2E usam respostas
ficticias interceptadas; integracao real entre API e PostgreSQL pertence aos testes de integracao e aos
cenarios de staging descritos no quickstart.

Carga exige uma URL autorizada e sessoes de teste fornecidas em runtime. Nunca use producao sem janela
e aprovacao. Exemplo de smoke local com cookie ficticio fornecido pelo operador:

```powershell
$env:LOAD_PROFILE='load'
$env:SESSION_COUNT='2'
$env:ALLOW_SESSION_REUSE='true'
$env:DASHBOARD_SESSION_COOKIES='__Host-skillmaps-session=<runtime-only-value>'
corepack pnpm test:load
```

Perfis aceitos: `load`, `spike`, `soak` e `browser`. `AUTH_SESSION_FILE`, quando usado, deve apontar
para um arquivo relativo dentro do repositorio, que e montado somente para leitura. Consulte o cabecalho de variaveis em
`tests/load/catalog-dashboard-500.js` e os criterios em
`specs/001-mvp-skill-maps/quickstart.md`. O perfil oficial usa 500 sessoes e nao permite reutilizacao.

## Imagens de producao

```powershell
docker build --pull -t skill-maps-api:local -f apps/api/Dockerfile .
docker build --pull -t skill-maps-web:local -f apps/web/Dockerfile .
```

A API roda como usuario `node` na porta 3000. O web usa nginx sem privilegio na porta 8080, expoe
`/health/live`, serve fallback SPA e encaminha `/api/` para `API_UPSTREAM` (padrao
`http://api:3000`). Bases estao fixadas por digest; dependencias usam lockfile congelado.

## Operacao e decisoes

- [Observabilidade e disponibilidade](docs/operations/observability.md)
- [Operacao de apagamento](docs/operations/account-erasure.md)
- [Restore e disaster recovery](docs/operations/disaster-recovery.md)
- [Registros de arquitetura](docs/adr/README.md)
- [Guia e cenarios de validacao](specs/001-mvp-skill-maps/quickstart.md)

Antes de release, consulte `docs/validation/mvp-release.md` e
`docs/validation/constitution-review.md`. Itens marcados `NOT EXECUTED` continuam bloqueadores; a
existencia da documentacao nao substitui evidencia humana, de staging ou de carga.
