import { Link } from "react-router-dom";
import { unitPriceCents } from "./catalog";
import { formatCents } from "./format";
import { PosterPreview } from "./PosterPreview";
import { useCatalog } from "./useCatalog";

export function CatalogPage() {
  const { catalog, error } = useCatalog();

  return (
    <main className="page">
      <h1>Posters</h1>
      <p className="lede">Choose a poster to size, frame, and add to your cart.</p>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {catalog === null && error.length === 0 ? <p className="lede">Loading catalog…</p> : null}
      {catalog !== null && catalog.products.length === 0 ? <p className="lede">No posters are in the catalog.</p> : null}
      {catalog !== null && catalog.products.length > 0 ? (
        <div className="catalog-grid">
          {catalog.products.map((product) => {
            const price = unitPriceCents(catalog, "A3", "none");
            return (
              <Link key={product.sku} className="catalog-card" to={`/products/${encodeURIComponent(product.sku)}`}>
                <PosterPreview sku={product.sku} name={product.name} size="A3" frame="none" fill />
                <h2>{product.name}</h2>
                <p className="card-price">
                  <span className="fine">A3, unframed</span>
                  <strong>{price === undefined ? "—" : formatCents(price)}</strong>
                </p>
              </Link>
            );
          })}
        </div>
      ) : null}
    </main>
  );
}
