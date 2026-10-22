import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CartPage } from "./CartPage";
import { CartProvider } from "./CartContext";
import { CatalogPage } from "./CatalogPage";
import { CheckoutPage } from "./CheckoutPage";
import { OrderPage } from "./OrderPage";
import { ProductPage } from "./ProductPage";
import { SiteHeader } from "./SiteHeader";

export function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <div className="app">
          <SiteHeader />
          <Routes>
            <Route path="/" element={<CatalogPage />} />
            <Route path="/products/:sku" element={<ProductPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/checkout" element={<CheckoutPage />} />
            <Route path="/orders/:number" element={<OrderPage />} />
          </Routes>
        </div>
      </CartProvider>
    </BrowserRouter>
  );
}
