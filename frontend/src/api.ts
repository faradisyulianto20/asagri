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

export interface NotifyStatus {
  available: boolean;
  last: {
    ok: boolean;
    error: string | null;
    to: string[];
    at: string;
  } | null;
}

export interface WaRequest {
  id: number;
  name: string;
  number: string;
  status: "pending" | "approved" | "rejected";
  created_at?: string;
  decided_at?: string | null;
  decided_by?: string | null;
}

export interface NumberRequestResult {
  status: "pending" | "approved";
  name: string;
  number: string;
  message: string;
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

export function fetchNotifyStatus(): Promise<NotifyStatus> {
  return getJson<NotifyStatus>("/api/notify/status");
}

export function testWa(
  token: string,
): Promise<{ ok: boolean; error?: string; to?: string[] }> {
  return adminFetch<{ ok: boolean; error?: string; to?: string[] }>(
    "/api/wa/test",
    token,
    { method: "POST" },
  );
}

export function disconnectWa(token: string): Promise<{ status: string }> {
  return adminFetch<{ status: string }>("/api/wa/disconnect", token, {
    method: "POST",
  });
}

export async function submitNumberRequest(
  name: string,
  number: string,
): Promise<NumberRequestResult> {
  const res = await fetch("/api/wa/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, number }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json()).detail || "";
    } catch {
      /* ignore */
    }
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json() as Promise<NumberRequestResult>;
}

export async function fetchRequestStatus(
  number: string,
): Promise<{ status: "none" | "pending" | "approved" | "rejected"; name?: string }> {
  return getJson<{
    status: "none" | "pending" | "approved" | "rejected";
    name?: string;
  }>(`/api/wa/request/status?number=${encodeURIComponent(number)}`);
}

export function fetchWaRequests(token: string): Promise<WaRequest[]> {
  return adminFetch<WaRequest[]>("/api/wa/requests", token);
}

export function approveWaRequest(
  token: string,
  id: number,
): Promise<WaRequest & { confirmation_sent?: boolean }> {
  return adminFetch<WaRequest & { confirmation_sent?: boolean }>(
    `/api/wa/requests/${id}/approve`,
    token,
    { method: "POST" },
  );
}

export function rejectWaRequest(token: string, id: number): Promise<WaRequest> {
  return adminFetch<WaRequest>(`/api/wa/requests/${id}/reject`, token, {
    method: "POST",
  });
}
