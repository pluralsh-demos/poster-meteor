import { Link } from "react-router-dom";
import { useCart } from "./CartContext";
import { MAX_QUANTITY, MIN_QUANTITY } from "./cart";
import { unitPriceCents } from "./catalog";
import { formatCents } from "./format";
import { useCatalog } from "./useCatalog";

export function CartPage() {
  const { lines, setQuantity, removeLine } = useCart();
  const { catalog, error } = useCatalog();

  let subtotal = 0;
  let priced = catalog !== null;
  const linePrices = lines.map((line) => {
    if (catalog === null) return undefined;
    const unit = unitPriceCents(catalog, line.size, line.frame);
    if (unit === undefined || !Number.isInteger(line.quantity) || line.quantity < MIN_QUANTITY || line.quantity > MAX_QUANTITY) {
      priced = false;
      return undefined;
    }
    const total = unit * line.quantity;
    subtotal += total;
    return total;
  });

  return (
    <main className="page">
      <h1>Cart</h1>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      {catalog === null && error.length === 0 ? <p className="lede">Loading catalog…</p> : null}
      {lines.length === 0 ? (
        <p className="lede">
          Your cart is empty. <Link to="/">Browse posters</Link>
        </p>
      ) : (
        <div className="layout">
          <section className="panel">
            <h2>Posters</h2>
            {lines.map((line, index) => {
              const product = catalog?.products.find((entry) => entry.sku === line.sku);
              const frameName = catalog?.frames.find((entry) => entry.id === line.frame)?.name ?? line.frame;
              const price = linePrices[index];
              const key = `${line.sku}|${line.size}|${line.frame}|${line.customText ?? ""}`;
              return (
                <div className="cart-line" key={key}>
                  <div>
                    <h3>{product?.name ?? line.sku}</h3>
                    <p className="fine">
                      {line.size} · {frameName}
                    </p>
                    {line.customText !== undefined && line.customText.length > 0 ? <p className="cart-text">{line.customText}</p> : null}
                  </div>
                  <label className="field cart-qty">
                    <span>Quantity</span>
                    <input
                      type="number"
                      min={MIN_QUANTITY}
                      max={MAX_QUANTITY}
                      step={1}
                      value={line.quantity}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (Number.isInteger(next)) setQuantity(index, next);
                      }}
                    />
                  </label>
                  <div className="cart-actions">
                    <strong>{price === undefined ? "—" : formatCents(price)}</strong>
                    <button className="text-button" type="button" onClick={() => removeLine(index)}>
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
          <aside className="panel summary">
            <h2>Subtotal</h2>
            <p className="total-line">
              <span>Subtotal</span>
              <span>{priced ? formatCents(subtotal) : "—"}</span>
            </p>
            <Link className="place-order" to="/checkout">
              Checkout
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
