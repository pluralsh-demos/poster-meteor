CREATE TABLE IF NOT EXISTS schema_migrations (
  filename text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE order_number_seq
  AS integer
  START WITH 10000
  INCREMENT BY 1
  MINVALUE 10000
  NO CYCLE;

CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE,
  email text NOT NULL,
  ship_to jsonb NOT NULL,
  status text NOT NULL,
  subtotal integer NOT NULL,
  tax integer,
  total integer NOT NULL,
  levy_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders (id),
  sku text NOT NULL,
  size text NOT NULL,
  frame text NOT NULL,
  custom_text text,
  unit_price integer NOT NULL
);

CREATE INDEX order_items_order_id_idx ON order_items (order_id);
