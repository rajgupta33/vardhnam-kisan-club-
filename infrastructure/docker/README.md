# Docker

## What exists

- `apps/marketplace-api/Dockerfile` — a multi-stage build producing the API and
  worker image. Both processes ship from the **same** image and differ only in
  entrypoint, so they can never drift apart in dependencies while sharing a
  database and job payload format.
- `apps/business-web/Dockerfile` — a multi-stage standalone Next.js image for
  the Business Portal.
- `/.dockerignore` — keeps dependencies, build output, secrets and mobile
  workspaces out of the repository-root context while retaining the Business
  Portal source required by Railway's generated npm workspace builder.
- `apps/marketplace-api/Dockerfile.dockerignore` — excludes the Business Portal
  implementation when the API Dockerfile is selected, while retaining its npm
  workspace manifest for lockfile resolution.
- `apps/business-web/Dockerfile.dockerignore` — keeps the Business Portal build
  context limited to its source and the shared packages it imports.
- `docker-compose.yml` — PostgreSQL and Redis by default, with the containerised
  API and worker behind an opt-in profile.

## Build stages

| Stage      | Purpose                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `deps`     | `npm ci` for the API workspace only, including dev dependencies needed to compile.                                  |
| `build`    | Runs the API workspace build; its `prebuild` lifecycle generates Prisma before `nest build`.                       |
| `migrator` | Keeps the Prisma CLI so `migrate deploy` can run as a deployment step. **Not** the serving image.                   |
| `runtime`  | Production dependencies plus compiled output, the generated Prisma client, and the schema. Runs as the `node` user. |

The image is built from the **repository root**, because the lockfile that makes
the install reproducible lives there:

```bash
docker build -f apps/marketplace-api/Dockerfile -t vardhnam-api .
docker build -f apps/business-web/Dockerfile -t vardhnam-business-web .
```

## Railway service settings

Keep the build context at the repository root for every Node.js service. Do not
set a service root to an individual workspace, because both images require the
root `package-lock.json` and npm workspace metadata.

The root context also supports Railway's generated npm build plan. This is a
fallback for service auto-detection; explicitly selecting the Dockerfiles below
remains the reproducible deployment configuration.

| Railway service | Root directory | Dockerfile path | Start command |
| --------------- | -------------- | --------------- | ------------- |
| Marketplace API | blank or `/` | `apps/marketplace-api/Dockerfile` | image default |
| Queue worker | blank or `/` | `apps/marketplace-api/Dockerfile` | `node dist/src/worker.js` |
| Business Portal | blank or `/` | `apps/business-web/Dockerfile` | image default |

Use the final `runtime` stage for the API and portal services. Run database
migrations separately with the API image's `migrator` target; do not run them in
the API or worker startup commands.

Railway injects `PORT`. Both HTTP processes listen on `0.0.0.0`, so they accept
traffic through Railway's proxy. Configure `DATABASE_URL` and `REDIS_URL` with
Railway private-network URLs, and use `/api/v1/health` and
`/api/v1/health/ready` for API liveness and readiness checks.

## Local usage

The default is unchanged, so the documented developer workflow still works — data
stores in containers, application on the host with hot reload:

```bash
docker compose up -d
```

To run the containerised API and worker, which is what a deployment actually
ships:

```bash
docker compose --profile app up -d --build
```

Migrations are a **separate one-shot service**, never a step in either process's
startup. With more than one replica, concurrent `migrate deploy` calls race, and
a failed migration should stop a rollout rather than crash-loop a container:

```bash
docker compose --profile migrate run --rm migrate
```

## Probes

`/health` is liveness — it answers as long as the process is serving.
`/health/ready` is readiness — it checks PostgreSQL, Redis and the queues.

The image's `HEALTHCHECK` deliberately uses **liveness only**. A dependency being
briefly unreachable should stop traffic being routed to the container, which is
readiness, not a reason to kill and restart it. Wire `/health/ready` to the
orchestrator's readiness probe.

## Still open before a real deployment

These are deliberately not solved here, because they depend on the hosting
decision that has not been made:

1. **Secrets.** `docker-compose.yml` carries a development-only
   `JWT_ACCESS_SECRET` so the local stack starts without extra setup. Every
   deployed environment must inject secrets from real secret management —
   `JWT_ACCESS_SECRET`, `DATABASE_URL`, `REDIS_URL`, `PAYMENT_WEBHOOK_SECRET`.
2. **Image registry and tagging.** No registry is chosen and no tag scheme is
   defined; nothing pushes images.
3. **Orchestration.** No Kubernetes manifests, ECS task definitions or equivalent
   exist. Replica counts, resource limits and rolling-update settings are unmade
   decisions.
4. **Shared rate-limit store.** The throttler counts in memory, per process, so
   the effective ceiling behind N replicas is N × `RATE_LIMIT_LIMIT`. A shared
   store is required before scaling the API beyond one instance.
5. **Observability.** Logs are structured JSON on stdout and carry a correlation
   ID, which is the right shape for aggregation, but no metrics, tracing or log
   sink is configured.
6. **TLS and ingress.** The container serves plain HTTP and expects to sit behind
   a terminating proxy.
