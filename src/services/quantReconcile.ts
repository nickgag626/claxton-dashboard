import { API_BASE } from './apiBase';

export type ReconcileStatus = {
  pending_groups: number;
  last_successful_reconcile_at?: string | null;
  anomalies_open?: number;
  anomalies_by_severity?: Record<string, number>;
  anomalies_by_type?: Record<string, number>;
};

export type ReconcileAnomaly = {
  id: string;
  anomaly_key: string;
  type: string;
  severity: string;
  broker?: string | null;
  broker_order_id?: string | null;
  intent_id?: string | null;
  details?: any;
  first_seen_at?: string;
  last_seen_at?: string;
  resolved_at?: string | null;
  resolved_by?: string | null;
};

export type TriggerReconcileResponse = {
  summary: any;
  anomalies: ReconcileAnomaly[];
};

export type ReconcileAnomalyAction = {
  id: string;
  anomaly_id: string;
  action_type: string;
  actor: string;
  note?: string | null;
  created_at_utc: string;
};

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const msg = json?.error || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return json.data as T;
}

async function apiPost<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const msg = json?.error || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return json.data as T;
}

export const quantReconcile = {
  status: () => apiGet<ReconcileStatus>('/api/reconcile/status'),

  anomalies: (opts?: { open_only?: boolean; severity?: string; type?: string }) => {
    const params = new URLSearchParams();
    params.set('open_only', String(opts?.open_only ?? true));
    if (opts?.severity) params.set('severity', opts.severity);
    if (opts?.type) params.set('type', opts.type);
    return apiGet<{ anomalies: ReconcileAnomaly[] }>(`/api/reconcile/anomalies?${params.toString()}`);
  },

  trigger: (opts?: { run_engine?: boolean; run_entry_reconcile?: boolean }) => {
    const params = new URLSearchParams();
    params.set('run_engine', String(opts?.run_engine ?? true));
    params.set('run_entry_reconcile', String(opts?.run_entry_reconcile ?? true));
    return apiPost<TriggerReconcileResponse>(`/api/reconcile/trigger?${params.toString()}`);
  },

  resolveAnomaly: (id: string, resolvedBy: string = 'manual') => {
    const params = new URLSearchParams();
    params.set('resolved_by', resolvedBy);
    return apiPost<{ resolved: boolean; id: string }>(`/api/reconcile/anomalies/${id}/resolve?${params.toString()}`);
  },

  anomalyActions: (id: string) => apiGet<{ actions: ReconcileAnomalyAction[] }>(`/api/reconcile/anomalies/${id}/actions`),
};
