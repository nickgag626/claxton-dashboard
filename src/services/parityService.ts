import { API_BASE } from '@/services/apiBase';

export interface ParityReport {
  id: string;
  report_date: string;
  total_trades: number;
  matched_decisions: number;
  decision_match_rate: number;
  avg_fill_slippage_bps: number;
  avg_pnl_divergence_usd: number;
  paper_pnl_usd: number;
  live_pnl_usd: number;
  details: any[];
  created_at: string;
}

export interface ParitySummary {
  totalDays: number;
  avgSlippage: number;
  avgFillDivergence: number;
  decisionMatchRate: number;
}

export const parityService = {
  async getReport(days: number = 7): Promise<{ reports: ParityReport[]; summary: ParitySummary }> {
    const res = await fetch(`${API_BASE}/api/parity/report?days=${days}`);
    const data = await res.json();
    return data.data || { reports: [], summary: { totalDays: 0, avgSlippage: 0, avgFillDivergence: 0, decisionMatchRate: 0 } };
  },

  async runCheck(): Promise<any> {
    const res = await fetch(`${API_BASE}/api/parity/run`, { method: 'POST' });
    return res.json();
  }
};
