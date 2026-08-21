# syntax=docker/dockerfile:1
#
# Business Portal production image. Build from the repository root:
#
#   docker build -f apps/business-web/Dockerfile -t vardhnam-business-web .

FROM node:22-bookworm-slim AS deps
WORKDIR /app

# Keep dependency installation cacheable while preserving the npm workspace
# links used by the portal.
COPY package.json package-lock.json ./
COPY apps/business-web/package.json apps/business-web/
COPY packages/api-client/package.json packages/api-client/
COPY packages/design-tokens/package.json packages/design-tokens/
COPY packages/shared-types/package.json packages/shared-types/

RUN npm ci --workspace @vardhnam/business-web --include-workspace-root

FROM deps AS build
WORKDIR /app

COPY tsconfig.base.json ./
COPY apps/business-web/ apps/business-web/
COPY packages/api-client/ packages/api-client/
COPY packages/design-tokens/ packages/design-tokens/
COPY packages/shared-types/ packages/shared-types/

# The workspace packages publish from dist. Build them before Next resolves
# their entrypoints, then emit Next's self-contained standalone server.
RUN npm --workspace @vardhnam/api-client run build \
  && npm --workspace @vardhnam/design-tokens run build \
  && npm --workspace @vardhnam/shared-types run build \
  && npm --workspace @vardhnam/business-web run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0

COPY --from=build --chown=node:node /app/apps/business-web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/business-web/.next/static ./apps/business-web/.next/static

USER node
EXPOSE 3000

# Next's generated server reads Railway's PORT and HOSTNAME environment values.
CMD ["node", "apps/business-web/server.js"]
