# Poster Meteor runbook

One slot is one namespace. Workload names are unqualified. The chart is `deploy/chart` (`poster-meteor`), rendered with `deploy/values.yaml`.

## Names

| Kind | Name |
| --- | --- |
| CNPG Cluster | `poster-meteor` |
| App secret (`uri` is `DATABASE_URL`) | `poster-meteor-app` |
| API Deployment and Service | `api` (port 3000) |
| API HorizontalPodAutoscaler | `api` |
| Web Deployment and Service | `web` (port 8080) |
| Ingress | `poster-meteor` |
| Migrate Job | `poster-meteor-migrate` |
| Seed Job | `poster-meteor-seed` |

This release renders `api` and `web`. `worker` in `deploy/values.yaml` is reserved for a later release.

The ingress host is `<pack.hostnamePrefix>-<slot.number>.<domain>`. Defaults render `poster-meteor-01.backlot.plural.sh`. Class is `nginx`. TLS secret name is `ingress.tlsSecretName` (`backlot-wildcard-tls`). `/api` routes to `api`; every other path routes to `web`.

Postgres is one instance, version 16, database `poster_meteor`, owner `poster`. `spec.postgresql.parameters.max_connections` is the string `postgres.maxConnections` (`"60"`).

## Install and upgrade

The cluster must already run the CloudNativePG operator. Images are `ghcr.io/pluralsh-demos/poster-meteor` (API, from `Dockerfile`) and `ghcr.io/pluralsh-demos/poster-meteor-web` (storefront, from `Dockerfile.web`). Tags come from `api.image.tag` and `web.image.tag`. Both default to `dev`.

`poster-meteor-migrate` is a `pre-install,pre-upgrade` hook. On the first install the Cluster manifest has not been applied, so `poster-meteor-app` is missing and the hook exits 0. On upgrade the secret exists: the hook waits until Postgres accepts a connection, then runs `node apps/api/dist/migrate.js` before API pods roll. A new image with no new SQL file still succeeds.

The `api` initContainer waits until `poster-meteor-app` exists and runs the same migrate command. The server does not listen until that container exits. `migrate` holds an advisory lock, so the hook and the initContainer can overlap.

`poster-meteor-seed` is a `post-install,post-upgrade` hook. It waits for Postgres, runs migrate, then `node apps/api/dist/seed.js`. Seed writes 2000 orders only when `orders` is empty. A later upgrade leaves those rows in place.

Both Jobs delete themselves on success (`before-hook-creation,hook-succeeded`).

## Scale

Checkout capacity follows `api.autoscaling.minReplicas` and `api.autoscaling.maxReplicas` (3 and 6). The Deployment replica count is the HPA minimum. The API container requests 100m CPU and 256Mi memory, and the HPA targets 70% CPU. Change the minimum in `deploy/values.yaml` and upgrade the release. That does not require a chart change, and it does not create worker pods.

`POOL_MAX` on the API is `api.db.poolMax` (8).
