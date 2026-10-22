import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, fetchProduct, isAbortError } from "./api";
import { useCart } from "./CartContext";
import { MAX_QUANTITY, MIN_QUANTITY, sameCartConfiguration } from "./cart";
import { unitPriceCents, type CatalogProductDetail } from "./catalog";
import { formatCents } from "./format";
import { PosterPreview } from "./PosterPreview";

const CUSTOM_TEXT_MAX = 60;

export function ProductPage() {
  const { sku } = useParams();
  const { lines, addLine } = useCart();
  const [product, setProduct] = useState<CatalogProductDetail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [size, setSize] = useState("A3");
  const [frame, setFrame] = useState("none");
  const [quantity, setQuantity] = useState(1);
  const [customText, setCustomText] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setSize("A3");
    setFrame("none");
    setQuantity(1);
    setCustomText("");
    setNotice("");
    setFormError("");
  }, [sku]);

  useEffect(() => {
    if (sku === undefined || sku.length === 0) {
      setProduct(null);
      setLoadError("We couldn't find that poster.");
      return;
    }
    const controller = new AbortController();
    setProduct(null);
    setLoadError("");
    fetchProduct(sku, controller.signal)
      .then((next) => {
        setProduct(next);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setProduct(null);
        setLoadError(cause instanceof ApiError ? cause.message : "The catalog did not load.");
      });
    return () => controller.abort();
  }, [sku]);

  useEffect(() => {
    if (product === null) return;
    setSize((current) => {
      if (product.sizes.some((entry) => entry.id === current)) return current;
      return product.sizes.find((entry) => entry.id === "A3")?.id ?? product.sizes[0]?.id ?? current;
    });
    setFrame((current) => {
      if (product.frames.some((entry) => entry.id === current)) return current;
      return product.frames.find((entry) => entry.id === "none")?.id ?? product.frames[0]?.id ?? current;
    });
  }, [product]);

  function clearMessages(): void {
    setNotice("");
    setFormError("");
  }

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (product === null) return;
    const draft = {
      sku: product.sku,
      size,
      frame,
      quantity,
      allowsCustomText: product.customText,
      ...(product.customText ? { customText } : {}),
    };
    const previous = lines.find((line) => sameCartConfiguration(line, draft));
    const previousQuantity = previous?.quantity ?? 0;
    const result = addLine(draft);
    if (!result.ok) {
      setNotice("");
      setFormError(result.error);
      return;
    }
    setFormError("");
    if (previousQuantity >= MAX_QUANTITY) {
      setNotice("This poster is already in your cart at the maximum of 10.");
    } else if (previousQuantity + quantity > MAX_QUANTITY) {
      setNotice("Added to cart. Quantity is capped at 10.");
    } else {
      setNotice("Added to cart.");
    }
  }

  if (loadError.length > 0) {
    return (
      <main className="page">
        <p className="alert" role="alert">
          {loadError}
        </p>
        <Link className="back-link" to="/">
          All posters
        </Link>
      </main>
    );
  }

  if (product === null) {
    return (
      <main className="page">
        <p className="lede">Loading catalog…</p>
      </main>
    );
  }

  const unit = unitPriceCents(product, size, frame);
  const price = unit === undefined ? undefined : unit * quantity;

  return (
    <main className="page">
      <h1>{product.name}</h1>
      <p className="lede">Size, frame, and quantity update the price before you add it to the cart.</p>
      <div className="product-layout">
        <PosterPreview
          sku={product.sku}
          name={product.name}
          size={size}
          frame={frame}
          {...(product.customText ? { customText } : {})}
        />
        <form className="panel stack" onSubmit={onSubmit}>
          <fieldset className="choice-set">
            <legend>Size</legend>
            <div className="choices">
              {product.sizes.map((entry) => (
                <label key={entry.id} className="choice">
                  <input
                    type="radio"
                    name="size"
                    value={entry.id}
                    checked={size === entry.id}
                    onChange={() => {
                      setSize(entry.id);
                      clearMessages();
                    }}
                  />
                  <span>{entry.id}</span>
                  <span className="fine">{formatCents(entry.priceCents)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="choice-set">
            <legend>Frame</legend>
            <div className="choices">
              {product.frames.map((entry) => (
                <label key={entry.id} className="choice">
                  <input
                    type="radio"
                    name="frame"
                    value={entry.id}
                    checked={frame === entry.id}
                    onChange={() => {
                      setFrame(entry.id);
                      clearMessages();
                    }}
                  />
                  <span>{entry.name}</span>
                  <span className="fine">{formatCents(entry.priceCents)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            <span>Quantity</span>
            <input
              type="number"
              min={MIN_QUANTITY}
              max={MAX_QUANTITY}
              step={1}
              value={quantity}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (!Number.isInteger(next)) return;
                setQuantity(Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, next)));
                clearMessages();
              }}
              required
            />
          </label>
          {product.customText ? (
            <label className="field">
              <span>Custom text</span>
              <input
                value={customText}
                maxLength={CUSTOM_TEXT_MAX}
                onChange={(event) => {
                  setCustomText(event.target.value);
                  clearMessages();
                }}
                required
                autoComplete="off"
              />
              <span className="fine">
                {customText.length}/{CUSTOM_TEXT_MAX}
              </span>
            </label>
          ) : null}
          <p className="total-line">
            <span>Price</span>
            <span>{price === undefined ? "—" : formatCents(price)}</span>
          </p>
          {unit !== undefined && quantity > 1 ? <p className="fine">{formatCents(unit)} each</p> : null}
          {formError ? (
            <p className="alert" role="alert">
              {formError}
            </p>
          ) : null}
          {notice ? (
            <p className="notice" role="status">
              {notice} <Link to="/cart">View cart</Link>
            </p>
          ) : null}
          <button className="place-order" type="submit">
            Add to cart
          </button>
        </form>
      </div>
    </main>
  );
}
