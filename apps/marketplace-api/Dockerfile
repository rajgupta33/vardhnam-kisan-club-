# syntax=docker/dockerfile:1
#
# Marketplace API and worker.
#
# One image serves both processes: they are the same Nest application and differ
# only in entrypoint (`main.js` listens for HTTP, `worker.js` consumes queues).
# Building them separately would let the two drift apart in dependencies while
# still sharing a database and a job payload format.
#
# Build from the REPOSITORY ROOT, not from this directory -- the lockfile that
# makes the install reproducible lives there:
#
#   docker build -f apps/marketplace-api/Dockerfile -t vardhnam-api .

# ---------------------------------------------------------------------------
# deps -- full install, including dev dependencies needed to compile
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Debian rather than Alpine: Prisma's query engine needs OpenSSL and glibc, and
# the musl builds are a recurring source of "engine not found" failures.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Only the manifests first, so the install layer is cached until a dependency
# actually changes. The API declares no `@vardhnam/*` workspace dependency, so
# no other workspace manifest is needed here.
COPY package.json package-lock.json ./
COPY apps/marketplace-api/package.json apps/marketplace-api/

RUN npm ci --workspace @vardhnam/marketplace-api --include-workspace-root

# ---------------------------------------------------------------------------
# build -- generate the Prisma client and compile TypeScript
# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app

# The API's tsconfig extends this. Without it TypeScript silently falls back to
# its own defaults -- ES5 target, no `esModuleInterop` -- and the build fails
# with dozens of errors that look nothing like a missing file.
COPY tsconfig.base.json ./

COPY apps/marketplace-api/ apps/marketplace-api/

# The API build lifecycle generates Prisma first (`prebuild`) because the
# TypeScript compilation imports the generated models and enums. Keeping that
# prerequisite in package.json also makes Railway's generated builder reliable.
RUN npm --workspace @vardhnam/marketplace-api run build

# ---------------------------------------------------------------------------
# migrator -- keeps the Prisma CLI, which the runtime image deliberately drops
# ---------------------------------------------------------------------------
# Migrations are a deployment step, not something a serving process should do on
# boot: with more than one replica, concurrent `migrate deploy` calls race, and a
# failed migration should stop a rollout rather than crash-loop a pod. Run this
# image to completion before rolling the API and worker forward.
FROM build AS migrator
WORKDIR /app/apps/marketplace-api
CMD ["npm", "run", "prisma:deploy"]

# ---------------------------------------------------------------------------
# runtime -- production dependencies and compiled output only
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps/marketplace-api/package.json apps/marketplace-api/

RUN npm ci --omit=dev --workspace @vardhnam/marketplace-api --include-workspace-root \
  && npm cache clean --force

# The generated Prisma client is a build artefact, not a package: `npm ci` alone
# leaves `@prisma/client` unusable because generation never ran here. Copying it
# from the build stage avoids shipping the Prisma CLI just to regenerate it.
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client

COPY --from=build /app/apps/marketplace-api/dist apps/marketplace-api/dist
# Schema and migrations travel with the image so the migrator stage above and
# this image are always the same version of both.
COPY --from=build /app/apps/marketplace-api/prisma apps/marketplace-api/prisma

# Internal-test demo product rows reference these deterministic local object
# keys. Package the approved pack shots with the image so Railway does not lose
# them on every ephemeral-container deployment. This is not a replacement for
# durable object storage before a real pilot.
RUN set -eux; \
  storage_dir=apps/marketplace-api/.storage/product_image/seed; \
  assets_dir=apps/marketplace-api/prisma/seed-assets/products; \
  mkdir -p $storage_dir; \
  cp $assets_dir/adiyogi.png $storage_dir/adiyogi-research-paddy-seed.png; \
  cp $assets_dir/aman-plus.png $storage_dir/aman-plus-research-paddy-seed.png; \
  cp $assets_dir/gauri.png $storage_dir/gauri-research-paddy-seed.png; \
  cp $assets_dir/basant-gold-9180.png $storage_dir/basant-gold-9180-hybrid-maize-seed.png; \
  cp $assets_dir/chanakya-4590.png $storage_dir/chanakya-4590-hybrid-maize-seed.png; \
  cp $assets_dir/vm-lakshmi-1246.png $storage_dir/vm-lakshmi-1246-hybrid-mustard-seed.png; \
  for image in $storage_dir/*.png; do printf 'image/png' > $image.meta; done; \
  chown -R node:node apps/marketplace-api/.storage

# The base image ships an unprivileged `node` user; nothing here needs root.
USER node

WORKDIR /app/apps/marketplace-api
EXPOSE 3001

# Liveness only. Readiness (`/health/ready`, which checks the database, Redis and
# queues) belongs to the orchestrator, because a dependency being briefly
# unreachable should stop traffic being routed here -- not kill the container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/'+(process.env.API_PREFIX||'api/v1')+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Overridden to `dist/src/worker.js` for the queue consumer -- see the `worker`
# service in docker-compose.yml.
CMD ["node", "dist/src/main.js"]
