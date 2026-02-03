import { API_BASE } from '@/services/apiBase';

export interface AuditEvent {
  id: string;
  event_type: string; // order_intent | broker_order | fill | reconcile | config_change | alert
  timestamp: string;
  trade_group_id?: string;
  order_id?: string;
  details: any;
}

export interface RunInfo {
  config_hash: string;
  engine_sha: string;
  dataset_version?: string;
  last_replay?: string;
}

export const auditService = {
  async getTrail(params: { tradeGroupId?: string; limit?: number }): Promise<AuditEvent[]> {
    const qs = new URLSearchParams();
    if (params.tradeGroupId) qs.set('trade_group_id', params.tradeGroupId);
    if (params.limit) qs.set('limit', String(params.limit));
    const res = await fetch(`${API_BASE}/api/ops/audit-trail?${qs}`);
    const data = await res.json();
    return data.data || [];
  },
  async getRunInfo(): Promise<RunInfo> {
    const res = await fetch(`${API_BASE}/api/config/current`);
    const data = await res.json();
    return data.data || {};
  },
  async getDataManifests(runId?: string): Promise<any[]> {
    const qs = runId ? `?run_id=${runId}` : '';
    const res = await fetch(`${API_BASE}/api/data/manifests${qs}`);
    const data = await res.json();
    return data.data || [];
  }
};
