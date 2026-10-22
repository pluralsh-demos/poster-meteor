# Poster Meteor

Catalog API for the Poster Meteor store. TypeScript, Fastify 5, Node 22. The process listens on `0.0.0.0:3000`.

Product data is the compiled module in `apps/api/src/catalog.ts`, loaded at startup. Catalog routes read that module. Postgres is started by Compose for checkout; browse stays up if the pool errors.

## Run

```bash
docker compose up --build
```

The API is at `http://localhost:3000`. Compose starts Postgres, then runs migrations and the order seed before the server listens.

```bash
npm test
npm run build && npm start
```

When `DATABASE_URL` is set, the process opens a `pg` pool. `POOL_MAX` defaults to 8. With it unset, catalog, health, and metrics still respond.

## Catalog

`GET /api/products` returns six posters plus the shared sizes and frames. `GET /api/products/:sku` returns one poster, or 404 for an unknown SKU.

| SKU | Name | Custom text |
| --- | --- | --- |
| `PM-PERSEID` | Perseid Night | no |
| `PM-LEONID` | Leonid Storm | no |
| `PM-HALLEY` | Halley's Return | no |
| `PM-STARMAP` | Custom Star Map (date + place line) | yes |
| `PM-NAMESTARS` | Name in the Stars | yes |
| `PM-NEBULA-LE` | Nebula by Ines Varga (limited-edition artist drop) | no |

Sizes, in cents: A3 2800, A2 4200, A1 6400. Frames: `none` 0, `black-oak` and `white-ash` 3500.

`customText` is true only for the star map and name-in-the-stars posters.

## Health and metrics

`GET /healthz` and `GET /readyz` return 200 from process health.

`GET /metrics` exposes:

- `http_requests_total{route,status}`
- `http_request_duration_seconds` (histogram, `route` label)
- `transactions_total{result}`
- `db_pool_connections{state}` (`total`, `idle`, `waiting`) when a pool exists
- `db_errors_total{sqlstate}`
- `app_build_info{pack,version,git_sha}` set to 1

Build labels come from `PACK`, `VERSION`, and `GIT_SHA` (defaults `poster-meteor`, `dev`, `unknown`). The image passes `GIT_SHA` as a build arg.

Every log line includes `pack` (`poster-meteor`), `service` (`api`), `route` (the route template, such as `/api/products/:sku`), and `ref` (empty until an order number exists). Database errors add `sqlstate`. Cookie and `Authorization` header values are redacted.

## Checkout

`POST /api/orders` and `GET /api/orders/:number` use the same process. They need Postgres. With no database configured they return 503, and catalog routes still return 200. The cart stays in the browser; this API does not set a cookie.
