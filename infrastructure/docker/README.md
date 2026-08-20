# Docker

## What exists

- `apps/marketplace-api/Dockerfile` — a multi-stage build producing the API and
  worker image. Both processes ship from the **same** image and differ only in
  entrypoint, so they can never drift apart in dependencies while sharing a
  database and job payload format.
- `/.dockerignore` — keeps `node_modules`, build output, secrets and the mobile
  and web workspaces out of the build context.
- `docker-compose.yml` — PostgreSQL and Redis by default, with the containerised
  API and worker behind an opt-in profile.

## Build stages

| Stage      | Purpose                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------- |
| `deps`     | `npm ci` for the API workspace only, including dev dependencies needed to compile.                                  |
| `build`    | `prisma generate`, then `nest build`.                                                                               |
| `migrator` | Keeps the Prisma CLI so `migrate deploy` can run as a deployment step. **Not** the serving image.                   |
| `runtime`  | Production dependencies plus compiled output, the generated Prisma client, and the schema. Runs as the `node` user. |

The image is built from the **repository root**, because the lockfile that makes
the install reproducible lives there:

```bash
docker build -f apps/marketplace-api/Dockerfile -t vardhnam-api .
```

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
