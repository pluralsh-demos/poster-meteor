import { useEffect, useState } from "react";
import { ApiError, fetchCatalog, isAbortError } from "./api";
import type { Catalog } from "./catalog";

export function useCatalog(): { catalog: Catalog | null; error: string } {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchCatalog(controller.signal)
      .then((next) => {
        setCatalog(next);
      })
      .catch((cause: unknown) => {
        if (isAbortError(cause)) return;
        setError(cause instanceof ApiError ? cause.message : "The catalog did not load.");
      });
    return () => controller.abort();
  }, []);

  return { catalog, error };
}
