# Poster Meteor

Demo storefront and store API for Poster Meteor. TypeScript, Fastify 5, Node 22. The API listens on `0.0.0.0:3000`. The storefront is a React app.

Product data is the compiled module in `apps/api/src/catalog.ts`, loaded at startup. Catalog routes read that module. The storefront loads the same data with `GET /api/products`. Postgres is started by Compose for checkout; browse stays up if the pool errors.

## Run

```bash
docker compose up --build
```

The storefront is at `http://localhost:8080`. The API is at `http://localhost:3000`. Compose starts Postgres, waits until it is healthy, then runs migrations and the order seed before the API listens. The `web` service builds `apps/web/Dockerfile` (Vite, then nginx). nginx serves the SPA with `try_files` and proxies `/api/` to `http://api:3000`. The API image remains the repo `Dockerfile`.

```bash
docker compose up api web --no-deps --build
```

That starts the API and the storefront without Postgres. The API listens without connecting, and catalog routes still respond.

```bash
npm test
npm run build && npm start
```

`npm run build` compiles the API, `migrate`, and `seed` into `apps/api/dist`. With `DATABASE_URL` set:

```bash
npm run migrate
npm run seed
```

`migrate` applies `apps/api/migrations/*.sql` in filename order and records each file in `schema_migrations`. A later run skips files already recorded. `seed` inserts 2000 historical orders only when `orders` is empty, then exits. A later run inserts nothing.

When `DATABASE_URL` is set, the process opens a `pg` pool. `POOL_MAX` defaults to 8. With it unset, catalog, health, and metrics still respond. Order routes return 503.

Vite stays available for local UI work. It proxies `/api` to `http://127.0.0.1:3000`.

```bash
npm install --prefix apps/web
npm run dev --prefix apps/web
```

Open `http://localhost:5173`.

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

## Orders

`POST /api/orders` places an order. `GET /api/orders/:number` returns it, or 404. Both need Postgres. With no database configured they return 503 (`Orders are unavailable`), and catalog routes still return 200. The cart stays in the browser; this API does not set a cookie.

The body is `email`, `shipTo` (`name`, `line1`, optional `line2`, `city`, `region`, `postalCode`, `country`), `items[]` (`sku`, `size`, `frame`, optional `customText`, `quantity`), and `payment` (`brand`, `last4`). Payment is required, then discarded. It is never stored. Log redaction covers `payment` the same way it covers cookies and `Authorization`.

Validation returns 400 and leaves `transactions_total` unchanged:

- SKU, size, and frame must exist in the catalog
- Custom text is required, and at most 60 characters, only for `PM-STARMAP` and `PM-NAMESTARS`. The other four posters reject it
- Quantity is 1–10. Each unit is stored as its own `order_items` row

Each line is priced as `size.priceCents + frame.priceCents` from `catalog.ts`. Checkout does not compute a tax line. `subtotal` and `total` are equal. New orders use status `received`.

A successful create returns 201:

```json
{
  "number": "PM-12000",
  "status": "received",
  "subtotal": 2800,
  "total": 2800,
  "items": [
    {
      "sku": "PM-PERSEID",
      "size": "A3",
      "frame": "none",
      "customText": null,
      "unitPrice": 2800
    }
  ]
}
```

`GET /api/orders/:number` returns the same shape. Numbers come from `order_number_seq`, which starts at 10000 (`PM-10000`). After the seed, the next checkout is `PM-12000`.

The order and its items are inserted in one transaction. A committed order increments `transactions_total{result="success"}`. A database failure after validation returns 500 with `We couldn't place your order` and omits the SQL error. That increments `transactions_total{result="error"}` and `db_errors_total{sqlstate}`. The error log includes `sqlstate` and the Postgres message. The create success log and `GET /api/orders/:number` set `ref` to the order number.

`tax` and `levy_ref` exist so a later integration can fill them. Checkout leaves both null.

## Migrations and seed

`apps/api/migrations/0001_orders.sql` creates `orders`, `order_items`, `order_number_seq`, and `schema_migrations`.

| Table | Columns |
| --- | --- |
| `orders` | `id`, `number` (unique), `email`, `ship_to` (jsonb), `status`, `subtotal`, `tax`, `total`, `levy_ref`, `created_at`, `updated_at` |
| `order_items` | `id`, `order_id`, `sku`, `size`, `frame`, `custom_text`, `unit_price` |
| `schema_migrations` | `filename` (primary key), `applied_at` |

Money columns are integer cents. `order_number_seq` starts at 10000.

The seed writes `PM-10000` through `PM-11999` when `orders` is empty, all with status `received` and `created_at` spread over the past year. SKU weights are Perseid 20, Leonid 15, Halley 15, Star Map 20, Name in the Stars 20, and Nebula 10. Sizes and frames come from the catalog. The unit price is size cents plus the flat frame price. The sequence is left so the next checkout is `PM-12000`.

## Storefront

`apps/web` is the React storefront. Every page shows the Poster Meteor wordmark, which links to `/`, a Demo store label, and a cart link with the line count.

| Path | Page |
| --- | --- |
| `/` | Catalog grid from `GET /api/products`. Each card shows `thumb.webp`, the name, and the A3 unframed price, and links to the product page. |
| `/products/:sku` | Size (A3, A2, A1), frame (None, Black Oak, White Ash), quantity (1–10), and custom text when that poster allows it. The price is size cents plus frame cents, times quantity. |
| `/cart` | Lines, quantity, remove, and subtotal, with a link to `/checkout`. |
| `/checkout` | Shipping and payment. See below. |
| `/orders/:number` | Confirmation and status. |

Add to cart writes `localStorage["poster-meteor.cart"]`. A line is `{ sku, size, frame, customText?, quantity }`. A line merges with one that matches sku, size, frame, and trimmed custom text, and the merged quantity stays within 1–10. Custom text is only for `PM-STARMAP` and `PM-NAMESTARS`: trimmed, 1–60 characters. The cart is still there after a reload.

The product preview uses the WebP copied for that SKU. A3, A2, and A1 share the same image, and size scales it. The frame is a CSS border. Wood swatches sit beside the frame choices. `PM-STARMAP` and `PM-NAMESTARS` show `hero.webp` until the text field has a value, then `hero-blank.webp` with that text overlaid. `lifestyle.webp` ships with each poster for later pages.

Images live in `apps/web/public/posters`, so the nginx image includes them. The folder name is the SKU in lowercase (`/posters/pm-perseid/thumb.webp`). Swatches are `/posters/swatches/black-oak.webp` and `/posters/swatches/white-ash.webp`. The catalog response has no image field.

The catalog, product, and cart pages render only what `GET /api/products` and `GET /api/products/:sku` return. When that request fails, they say the catalog did not load. An unknown SKU says the poster could not be found. Those pages keep working with Postgres stopped, because catalog routes never query it.

## Checkout page

`/checkout` reads the same `poster-meteor.cart` value. An empty cart still shows one editable line, defaulting to `PM-PERSEID` / `A3` / `none`.

`/orders/:number` is both the confirmation and the status page. It shows the order number and status `received`.

Shipping and payment fields submit to `POST /api/orders`. The page shows the API's status value and does not add later fulfillment steps.

## Health and metrics

`GET /healthz` and `GET /readyz` return 200 from process health. Neither checks the database.

`GET /metrics` exposes:

- `http_requests_total{route,status}`
- `http_request_duration_seconds` (histogram, `route` label)
- `transactions_total{result}` (`success` after a committed order, `error` when a validated checkout fails in Postgres)
- `db_pool_connections{state}` (`total`, `idle`, `waiting`) when a pool exists
- `db_errors_total{sqlstate}` for pool errors and failed order queries
- `app_build_info{pack,version,git_sha}` set to 1

Build labels come from `PACK`, `VERSION`, and `GIT_SHA` (defaults `poster-meteor`, `dev`, `unknown`). The image passes `GIT_SHA` as a build arg.

Every log line includes `pack` (`poster-meteor`), `service` (`api`), `route` (the route template, such as `/api/products/:sku`), and `ref` (the order number on create and on `GET /api/orders/:number`, otherwise empty). Database errors add `sqlstate`. Cookie values, the `Authorization` header, and `payment` are redacted.
