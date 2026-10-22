import { Link } from "react-router-dom";
import { useCart } from "./CartContext";

export function SiteHeader() {
  const { lines } = useCart();

  return (
    <header className="site-header">
      <div className="brand-lockup">
        <Link className="brand" to="/">
          Poster Meteor
        </Link>
        <p className="demo-label">Demo store</p>
      </div>
      <Link className="cart-link" to="/cart">
        Cart ({lines.length})
      </Link>
    </header>
  );
}
