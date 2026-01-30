import { API_BASE } from '@/services/apiBase';

// ── Types ──────────────────────────────────────────────

export interface PortfolioRiskSnapshot {
  timestamp: string;
  net_delta_shares: number;
  net_gamma_shares_per_dollar: number;
  net_vega_usd_per_1vol: number;
  net_theta_usd_per_day: number;
  beta_weighted_delta: number;
  pnl_1pct_up: number;
  pnl_1pct_down: number;
  pnl_2pct_up: number;
  pnl_2pct_down: number;
  pnl_5pct_down: number;
  var_95_1d: number;
  var_99_1d: number;
  max_single_position_pct: number;
  max_single_underlying_pct: number;
  delta_utilization_pct: number;
  gamma_utilization_pct: number;
  vega_utilization_pct: number;
  breaches: string[];
}

export interface RiskTrigger {
  level: 'WARNING' | 'CRITICAL';
  metric: string;
  message: string;
  value: number;
  cap: number;
}

export interface ScenarioRow {
  move_pct: number;
  pnl_usd: number;
  pnl_pct_of_portfolio: number;
}

export interface RiskCaps {
  max_delta_shares: number;
  max_gamma: number;
  max_vega: number;
  max_theta_daily: number;
  max_var_99_1d: number;
  max_single_position_pct: number;
}

// ── API Calls ──────────────────────────────────────────

export async function getRiskSnapshot(): Promise<{
  data: PortfolioRiskSnapshot;
  position_count: number;
}> {
  const res = await fetch(`${API_BASE}/api/risk/snapshot`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to fetch risk snapshot');
  return json;
}

export async function getRiskHistory(
  limit = 100,
): Promise<PortfolioRiskSnapshot[]> {
  const res = await fetch(`${API_BASE}/api/risk/history?limit=${limit}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to fetch risk history');
  return json.data;
}

export async function getScenarios(): Promise<{
  data: ScenarioRow[];
  portfolio_value: number;
}> {
  const res = await fetch(`${API_BASE}/api/risk/scenarios`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to fetch scenarios');
  return json;
}

export async function getRiskTriggers(): Promise<RiskTrigger[]> {
  const res = await fetch(`${API_BASE}/api/risk/triggers`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to fetch triggers');
  return json.data;
}

export async function updateRiskCaps(
  caps: Partial<RiskCaps>,
): Promise<RiskCaps> {
  const res = await fetch(`${API_BASE}/api/risk/caps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(caps),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to update risk caps');
  return json.data;
}
