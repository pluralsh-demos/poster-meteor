import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { CheckoutPage } from "./CheckoutPage";
import { OrderPage } from "./OrderPage";

export function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="site-header">
          <div className="brand">Poster Meteor</div>
          <p className="demo-label">Demo store</p>
        </header>
        <Routes>
          <Route path="/" element={<Navigate to="/checkout" replace />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/orders/:number" element={<OrderPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
