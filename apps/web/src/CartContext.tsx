import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  CART_STORAGE_KEY,
  addToCart,
  readCart,
  removeCartLine,
  subscribeCart,
  updateCartQuantity,
  type CartDraft,
  type CartLine,
  type CartUpdate,
} from "./cart";

type CartApi = {
  lines: CartLine[];
  addLine: (draft: CartDraft) => CartUpdate;
  setQuantity: (index: number, quantity: number) => CartUpdate;
  removeLine: (index: number) => CartUpdate;
};

const CartContext = createContext<CartApi | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [lines, setLines] = useState<CartLine[]>(() => readCart());

  useEffect(() => {
    setLines(readCart());
  }, [pathname]);

  useEffect(() => subscribeCart(() => setLines(readCart())), []);

  useEffect(() => {
    function onStorage(event: StorageEvent): void {
      if (event.key === null || event.key === CART_STORAGE_KEY) setLines(readCart());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const api = useMemo<CartApi>(
    () => ({
      lines,
      addLine: (draft) => addToCart(draft),
      setQuantity: (index, quantity) => updateCartQuantity(index, quantity),
      removeLine: (index) => removeCartLine(index),
    }),
    [lines],
  );

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart(): CartApi {
  const cart = useContext(CartContext);
  if (cart === undefined) throw new Error("useCart must be used within CartProvider");
  return cart;
}
