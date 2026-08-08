import { useCallback, useEffect, useState } from "react";
import { fetchHistory, fetchLatest, fetchWaStatus } from "../api";
import type { HistoryPoint, LatestData, WaStatus } from "../api";

export function useDashboardData() {
  const [latest, setLatest] = useState<LatestData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [wa, setWa] = useState<WaStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [l, h, w] = await Promise.all([
        fetchLatest(),
        fetchHistory(24),
        fetchWaStatus(),
      ]);
      setLatest(l);
      setHistory(h);
      setWa(w);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  return { latest, history, wa, error, loading };
}
