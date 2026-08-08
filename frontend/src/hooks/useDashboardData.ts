import { useCallback, useEffect, useState } from "react";
import {
  fetchHistory,
  fetchLatest,
  fetchNotifyStatus,
  fetchThresholds,
  fetchWaStatus,
} from "../api";
import type {
  HistoryPoint,
  LatestData,
  NotifyStatus,
  Thresholds,
  WaStatus,
} from "../api";

export function useDashboardData() {
  const [latest, setLatest] = useState<LatestData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [wa, setWa] = useState<WaStatus | null>(null);
  const [notify, setNotify] = useState<NotifyStatus | null>(null);
  const [thresholds, setThresholds] = useState<Thresholds | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [l, h, w, n, th] = await Promise.all([
        fetchLatest(),
        fetchHistory(24),
        fetchWaStatus(),
        fetchNotifyStatus(),
        fetchThresholds(),
      ]);
      setLatest(l);
      setHistory(h);
      setWa(w);
      setNotify(n);
      setThresholds(th);
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

  return { latest, history, wa, notify, thresholds, error, loading };
}
