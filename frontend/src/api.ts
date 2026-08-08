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
  source?: string;
  created_at?: string;
}

export interface HistoryPoint {
  time: string;
  temperature: number;
  humidity: number;
  relay_fan: boolean;
  relay_humidifier: boolean;
  source?: string;
}

export interface WaStatus {
  connected: boolean;
  registered: boolean;
  starting?: boolean;
  number?: string | null;
  qr?: string | null;
  error?: string | null;
}

export interface Thresholds {
  fan_on: number;
  fan_off: number;
  humid_on: number;
  humid_off: number;
  extreme_temp: number;
  extreme_humidity: number;
}

export interface AdminSettings {
  whatsapp_to: string;
  msg_fan_on: string;
  msg_humid_on: string;
  msg_extreme: string;
  cooldown_minutes: string;
  thresholds: Thresholds;
}

export interface SimulateResult {
  id: number;
  temperature: number;
  humidity: number;
  relay_fan: boolean;
  relay_humidifier: boolean;
  buzzer: boolean;
  source: string;
  created_at: string;
}

export interface LoginResult {
  token: string;
  username: string;
}

export const TOKEN_KEY = "asagri_admin_token";
export const USERNAME_KEY = "asagri_admin_user";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

async function adminFetch<T>(
  url: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      "X-Admin-Token": token,
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USERNAME_KEY);
    window.dispatchEvent(new Event("asagri:unauthorized"));
    throw new Error("Sesi berakhir, silakan login ulang");
  }
  if (!res.ok) throw new Error(`${url} (HTTP ${res.status})`);
  return res.json() as Promise<T>;
}

export async function loginAdmin(
  username: string,
  password: string,
): Promise<LoginResult> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<LoginResult>;
}

export function logoutAdmin(token: string): Promise<{ status: string }> {
  return adminFetch<{ status: string }>("/api/auth/logout", token, {
    method: "POST",
  });
}

export function fetchMe(token: string): Promise<{ username: string }> {
  return adminFetch<{ username: string }>("/api/auth/me", token);
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

export function fetchThresholds(): Promise<Thresholds> {
  return getJson<Thresholds>("/api/thresholds");
}

export function fetchAdminSettings(token: string): Promise<AdminSettings> {
  return adminFetch<AdminSettings>("/api/settings", token);
}

export function updateAdminSettings(
  token: string,
  data: Partial<Pick<AdminSettings, "whatsapp_to" | "msg_fan_on" | "msg_humid_on" | "msg_extreme" | "cooldown_minutes">>,
): Promise<AdminSettings> {
  return adminFetch<AdminSettings>("/api/settings", token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function simulateReading(
  token: string,
  temperature: number,
  humidity: number,
): Promise<SimulateResult> {
  return adminFetch<SimulateResult>("/api/simulate", token, {
    method: "POST",
    body: JSON.stringify({ temperature, humidity }),
  });
}

export function disconnectWa(token: string): Promise<{ status: string }> {
  return adminFetch<{ status: string }>("/api/wa/disconnect", token, {
    method: "POST",
  });
}
