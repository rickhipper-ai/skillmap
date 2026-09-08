FROM node:24.8.0-alpine@sha256:3e843c608bb5232f39ecb2b25e41214b958b0795914707374c8acc28487dea17 AS build

WORKDIR /workspace
RUN corepack enable && corepack prepare pnpm@11.25.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY database/package.json database/package.json
COPY packages/api-contract/package.json packages/api-contract/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api apps/api
COPY database/migrations database/migrations
RUN pnpm --filter @skill-maps/api build \
    && pnpm --filter @skill-maps/api deploy --legacy --prod /opt/skill-maps-api

FROM node:24.8.0-alpine@sha256:3e843c608bb5232f39ecb2b25e41214b958b0795914707374c8acc28487dea17 AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /opt/skill-maps-api/ ./
COPY --from=build --chown=node:node /workspace/database/migrations /database/migrations

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/src/server.js"]
