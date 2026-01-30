import { API_BASE } from './apiBase';

// ── Types ──────────────────────────────────────────

export interface BacktestConfig {
  strategy: string;
  underlying: string;
  start_date: string;
  end_date: string;
  initial_capital: number;
  target_delta: number;
  min_dte: number;
  max_dte: number;
  profit_target_pct: number;
  stop_loss_pct: number;
  time_stop_dte: number;
  max_positions: number;
  commission_per_contract: number;
  slippage_pct: number;
}

export interface BacktestSummary {
  total_return_pct: number;
  total_return_usd: number;
  cagr_pct: number;
  final_equity: number;
  initial_capital: number;
  max_drawdown_pct: number;
  max_drawdown_duration_bars: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  total_trades: number;
  wins: number;
  losses: number;
  flat: number;
  win_rate_pct: number;
  profit_factor: number | string;
  expectancy_usd: number;
  avg_win_usd: number;
  avg_loss_usd: number;
  largest_win_usd: number;
  largest_loss_usd: number;
  gross_profit_usd: number;
  gross_loss_usd: number;
  avg_duration_days: number;
  max_consecutive_wins: number;
  max_consecutive_losses: number;
  exit_reasons: Record<string, number>;
}

export interface EquityCurvePoint {
  timestamp: string;
  equity: number;
  cash: number;
  unrealized: number;
  positions: number;
}

export interface BacktestTrade {
  trade_group_id: string;
  strategy_name: string;
  underlying: string;
  expiration: string;
  entry_time: string;
  exit_time: string | null;
  entry_credit_usd: number;
  exit_debit_usd: number | null;
  realized_pnl_usd: number | null;
  exit_reason: string | null;
  entry_commission: number;
  exit_commission: number;
  legs: Array<Record<string, unknown>>;
  duration_days: number | null;
}

export interface BacktestResult {
  summary: BacktestSummary;
  equity_curve: EquityCurvePoint[];
  trades: BacktestTrade[];
  config: Record<string, unknown>;
  broker_snapshot: Record<string, unknown>;
}

export interface StrategyTemplate {
  id: string;
  name: string;
  description: string;
  underlying: string;
  strategy: string;
  target_delta: number;
  min_dte: number;
  max_dte: number;
  profit_target_pct: number;
  stop_loss_pct: number;
  time_stop_dte: number;
  max_positions: number;
}

export interface SweepResultRow {
  summary: BacktestSummary;
  config: Record<string, unknown>;
  trade_count: number;
}

// ── API Functions ──────────────────────────────────

export async function getStrategyTemplates(): Promise<StrategyTemplate[]> {
  const res = await fetch(`${API_BASE}/api/backtest/strategies`);
  if (!res.ok) throw new Error(`Failed to load strategies: ${res.statusText}`);
  const json = await res.json();
  return json.data ?? [];
}

export async function runBacktest(config: BacktestConfig): Promise<BacktestResult> {
  const res = await fetch(`${API_BASE}/api/backtest/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Backtest failed');
  }
  const json = await res.json();
  return json.data;
}

export async function runSweep(
  config: BacktestConfig,
  sweepParams: Record<string, number[]>,
): Promise<SweepResultRow[]> {
  const res = await fetch(`${API_BASE}/api/backtest/sweep`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, sweep_params: sweepParams }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Sweep failed');
  }
  const json = await res.json();
  return json.data ?? [];
}
