import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ApiError, fetchOrder, type Order } from "./api";
import { formatCents } from "./format";

export function OrderPage() {
  const { number: numberParam } = useParams();
  const number = numberParam ?? "";
  const [order, setOrder] = useState<Order | undefined>();
  const [error, setError] = useState("");

  useEffect(() => {
    if (number.length === 0) return undefined;
    const controller = new AbortController();
    setOrder(undefined);
    setError("");

    async function load(): Promise<void> {
      try {
        const next = await fetchOrder(number, controller.signal);
        if (!controller.signal.aborted) setOrder(next);
      } catch (cause) {
        if (controller.signal.aborted) return;
        const message = cause instanceof ApiError ? cause.message : "We couldn't find that order.";
        setError(message);
      }
    }

    void load();
    return () => controller.abort();
  }, [number]);

  return (
    <main className="page">
      <h1>Order</h1>
      <p className="order-number">{number}</p>
      {order ? (
        <>
          <p className="status-line">
            Status <strong>{order.status}</strong>
          </p>
          <section className="panel">
            {order.items.map((item, index) => (
              <p className="summary-line" key={`${item.sku}-${index}`}>
                <span>
                  {item.sku}
                  <br />
                  <span className="fine">
                    {item.size} · {item.frame}
                    {item.quantity !== undefined && item.quantity > 1 ? ` · ${item.quantity}` : ""}
                    {item.customText ? ` · ${item.customText}` : ""}
                  </span>
                </span>
                <span>{typeof item.unitPrice === "number" ? formatCents(item.unitPrice) : ""}</span>
              </p>
            ))}
            <p className="total-line">
              <span>Total</span>
              <span>{formatCents(order.total)}</span>
            </p>
          </section>
        </>
      ) : error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : (
        <p className="lede">Loading this order…</p>
      )}
      <Link className="back-link" to="/checkout">
        Back to checkout
      </Link>
    </main>
  );
}
