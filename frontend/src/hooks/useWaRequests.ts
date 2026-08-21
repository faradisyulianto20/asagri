import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchWaRequests } from "../api";
import type { WaRequest } from "../api";

export function useWaRequests(token: string | null) {
  const [requests, setRequests] = useState<WaRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!token) {
      setRequests(null);
      setError(null);
      setLoading(false);
      return;
    }
    fetchWaRequests(token)
      .then((data) => {
        setRequests(data);
        setError(null);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token) {
      setRequests(null);
      setError(null);
      setLoading(false);
      return;
    }
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, [load, token]);

  const reload = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetchWaRequests(token)
      .then((data) => {
        setRequests(data);
        setError(null);
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error(`Gagal memuat permintaan: ${msg}`);
      })
      .finally(() => setLoading(false));
  }, [token]);

  return { requests, error, loading, reload };
}
