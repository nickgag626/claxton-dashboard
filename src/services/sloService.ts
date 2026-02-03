import { API_BASE } from './apiBase';

// ── Types ──────────────────────────────────────────────────────────────
export interface Alert {
  id: string;
  level: string;
  message: string;
  details: Record<string, unknown>;
  trade_group_id: string | null;
  acknowledged: boolean;
  acknowledged_at: string | null;
  created_at: string;
}

export interface AlertSummary {
  total_unacknowledged: number;
  by_level: Record<string, number>;
}

export interface ConfigState {
  config_hash: string | null;
  engine_sha: string | null;
  snapshot: Record<string, unknown> | null;
}

export interface ConfigAuditEntry {
  id: string;
  config_hash: string;
  engine_sha: string | null;
  config_snapshot: Record<string, unknown>;
  changed_keys: string[];
  source: string;
  created_at: string;
}

// ── API Calls ──────────────────────────────────────────────────────────

export async function fetchAlerts(params?: {
  level?: string;
  acknowledged?: boolean;
  limit?: number;
}): Promise<Alert[]> {
  const qs = new URLSearchParams();
  if (params?.level) qs.set('level', params.level);
  if (params?.acknowledged !== undefined)
    qs.set('acknowledged', String(params.acknowledged));
  if (params?.limit) qs.set('limit', String(params.limit));

  const url = `${API_BASE}/api/alerts?${qs.toString()}`;
  const res = await fetch(url);
  const json = await res.json();
  return json.data ?? [];
}

export async function fetchAlertSummary(): Promise<AlertSummary> {
  const res = await fetch(`${API_BASE}/api/alerts/summary`);
  const json = await res.json();
  return (
    json.data ?? { total_unacknowledged: 0, by_level: {} }
  );
}

export async function acknowledgeAlert(
  alertId: string,
): Promise<boolean> {
  const res = await fetch(
    `${API_BASE}/api/alerts/${alertId}/acknowledge`,
    { method: 'POST' },
  );
  const json = await res.json();
  return json.success === true;
}

export async function fetchConfigCurrent(): Promise<ConfigState> {
  const res = await fetch(`${API_BASE}/api/config/current`);
  const json = await res.json();
  return (
    json.data ?? { config_hash: null, engine_sha: null, snapshot: null }
  );
}

export async function fetchConfigAudit(
  limit = 20,
): Promise<ConfigAuditEntry[]> {
  const res = await fetch(
    `${API_BASE}/api/config/audit?limit=${limit}`,
  );
  const json = await res.json();
  return json.data ?? [];
}

export async function fetchHealthCheck(): Promise<Record<string, unknown>> {
  const res = await fetch(`${API_BASE}/health`);
  return res.json();
}
