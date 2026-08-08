export interface LatestData {
  available: boolean;
  temperature?: number;
  humidity?: number;
  relay_fan?: boolean;
  relay_humidifier?: boolean;
  relay_3?: boolean;
  relay_4?: boolean;
  buzzer?: boolean;
  sensor_error?: boolean;
  created_at?: string;
}

export interface HistoryPoint {
  time: string;
  temperature: number;
  humidity: number;
  relay_fan: boolean;
  relay_humidifier: boolean;
}

export interface WaStatus {
  connected: boolean;
  registered: boolean;
  starting?: boolean;
  number?: string | null;
  qr?: string | null;
  error?: string | null;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

export function fetchLatest(): Promise<LatestData> {
  return getJson<LatestData>("/api/latest");
}

export function fetchHistory(hours = 24): Promise<HistoryPoint[]> {
  return getJson<HistoryPoint[]>(`/api/history?hours=${hours}`);
}

export function fetchWaStatus(): Promise<WaStatus> {
  return getJson<WaStatus>("/api/wa/status");
}
