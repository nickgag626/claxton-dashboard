'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Loader2,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
} from 'recharts';
import {
  getRiskSnapshot,
  getRiskHistory,
  getScenarios,
  getRiskTriggers,
  type PortfolioRiskSnapshot,
  type RiskTrigger,
  type ScenarioRow,
} from '@/services/riskService';

// ── Helpers ──────────────────────────────────────

function utilizationColor(pct: number): string {
  if (pct > 80) return 'text-red-400';
  if (pct > 50) return 'text-yellow-400';
  return 'text-green-400';
}

function progressColor(pct: number): string {
  if (pct > 80) return 'bg-red-500';
  if (pct > 50) return 'bg-yellow-500';
  return 'bg-green-500';
}

function fmtNum(n: number, decimals = 0): string {
  if (Math.abs(n) >= 1000) {
    return n.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return n.toFixed(decimals);
}

function fmtDollar(n: number): string {
  const sign = n < 0 ? '-' : '+';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ── Component ────────────────────────────────────

export function RiskBook() {
  const [snapshot, setSnapshot] = useState<PortfolioRiskSnapshot | null>(null);
  const [triggers, setTriggers] = useState<RiskTrigger[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [history, setHistory] = useState<PortfolioRiskSnapshot[]>([]);
  const [positionCount, setPositionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [snapRes, trigRes, scenRes, histRes] = await Promise.all([
        getRiskSnapshot(),
        getRiskTriggers(),
        getScenarios(),
        getRiskHistory(100),
      ]);
      setSnapshot(snapRes.data);
      setPositionCount(snapRes.position_count);
      setTriggers(trigRes);
      setScenarios(scenRes.data);
      setHistory(histRes);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000); // auto-refresh every 60s
    return () => clearInterval(id);
  }, [refresh]);

  // ── Loading / Error states ──
  if (loading && !snapshot) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="ml-3 text-muted-foreground">Loading risk data…</span>
      </div>
    );
  }

  if (error && !snapshot) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="pt-6 text-center">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-destructive" />
          <p className="text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-1" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const s = snapshot!;
  const hasCritical = triggers.some((t) => t.level === 'CRITICAL');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasCritical ? (
            <ShieldAlert className="h-5 w-5 text-red-400" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-green-400" />
          )}
          <span className="text-sm text-muted-foreground">
            {positionCount} position{positionCount !== 1 ? 's' : ''} tracked
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* ── Risk Alerts ── */}
      {triggers.length > 0 ? (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
              Active Risk Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {triggers.map((t, i) => (
              <div key={i} className="flex items-start gap-2">
                <Badge
                  variant={t.level === 'CRITICAL' ? 'destructive' : 'outline'}
                  className={
                    t.level === 'CRITICAL'
                      ? ''
                      : 'border-yellow-500 text-yellow-400'
                  }
                >
                  {t.level}
                </Badge>
                <span className="text-sm text-muted-foreground">{t.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-4 text-center text-muted-foreground text-sm flex items-center justify-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-400" />
            No active risk alerts ✅
          </CardContent>
        </Card>
      )}

      {/* ── Greeks Summary Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <GreekCard label="Net Delta" value={s.net_delta_shares} unit="shares" utilPct={s.delta_utilization_pct} />
        <GreekCard label="Net Gamma" value={s.net_gamma_shares_per_dollar} unit="Γ" decimals={4} utilPct={s.gamma_utilization_pct} />
        <GreekCard label="Net Vega" value={s.net_vega_usd_per_1vol} unit="$/vol" utilPct={s.vega_utilization_pct} />
        <GreekCard label="Net Theta" value={s.net_theta_usd_per_day} unit="$/day" />
        <GreekCard label="β-Weighted Δ" value={s.beta_weighted_delta} unit="SPY eq" />
      </div>

      {/* ── VAR + Utilisation row ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* VAR Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Value at Risk (1-Day)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">VAR 95%</span>
              <span className="font-mono text-sm">${fmtNum(s.var_95_1d)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">VAR 99%</span>
              <span className="font-mono text-sm font-bold">${fmtNum(s.var_99_1d)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Utilisation Gauges */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Cap Utilisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <UtilBar label="Delta" pct={s.delta_utilization_pct} />
            <UtilBar label="Gamma" pct={s.gamma_utilization_pct} />
            <UtilBar label="Vega" pct={s.vega_utilization_pct} />
          </CardContent>
        </Card>
      </div>

      {/* ── Scenario Analysis ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Scenario P&L (Delta-Gamma Approx)</CardTitle>
        </CardHeader>
        <CardContent>
          {scenarios.length > 0 ? (
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scenarios} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis
                    dataKey="move_pct"
                    tickFormatter={(v: number) => `${v > 0 ? '+' : ''}${v}%`}
                    tick={{ fill: '#999', fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(v: number) => `$${v >= 0 ? '' : '-'}${Math.abs(v).toLocaleString()}`}
                    tick={{ fill: '#999', fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                    labelFormatter={(v: number) => `Move: ${v > 0 ? '+' : ''}${v}%`}
                    formatter={(value: number) => [fmtDollar(value), 'P&L']}
                  />
                  <ReferenceLine y={0} stroke="#555" />
                  <Bar dataKey="pnl_usd" radius={[3, 3, 0, 0]}>
                    {scenarios.map((row, idx) => (
                      <Cell key={idx} fill={row.pnl_usd >= 0 ? '#22c55e' : '#ef4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-muted-foreground text-sm py-6">
              No scenario data — open positions required
            </p>
          )}

          {/* Table under chart */}
          {scenarios.length > 0 && (
            <div className="mt-3 max-h-[180px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-1 text-left">Move</th>
                    <th className="py-1 text-right">P&L ($)</th>
                    <th className="py-1 text-right">% of Portfolio</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((row, i) => (
                    <tr key={i} className="border-b border-border/30">
                      <td className="py-1">
                        {row.move_pct > 0 ? (
                          <span className="text-green-400 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />+{row.move_pct}%
                          </span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1">
                            <TrendingDown className="h-3 w-3" />{row.move_pct}%
                          </span>
                        )}
                      </td>
                      <td className={`py-1 text-right font-mono ${row.pnl_usd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmtDollar(row.pnl_usd)}
                      </td>
                      <td className={`py-1 text-right font-mono ${row.pnl_pct_of_portfolio >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {row.pnl_pct_of_portfolio > 0 ? '+' : ''}{row.pnl_pct_of_portfolio.toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Delta History Chart ── */}
      {history.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Net Delta History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history.map((h, i) => ({ idx: i, delta: h.net_delta_shares }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="idx" tick={false} />
                  <YAxis tick={{ fill: '#999', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                    formatter={(value: number) => [`${fmtNum(value, 1)} shares`, 'Net Delta']}
                  />
                  <ReferenceLine y={0} stroke="#555" />
                  <Line
                    type="monotone"
                    dataKey="delta"
                    stroke="#60a5fa"
                    dot={false}
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Concentration ── */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Max Single Position</p>
            <p className="text-lg font-mono font-bold">{s.max_single_position_pct.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3 text-center">
            <p className="text-xs text-muted-foreground mb-1">Max Single Underlying</p>
            <p className="text-lg font-mono font-bold">{s.max_single_underlying_pct.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────

function GreekCard({
  label,
  value,
  unit,
  decimals = 0,
  utilPct,
}: {
  label: string;
  value: number;
  unit: string;
  decimals?: number;
  utilPct?: number;
}) {
  const colorClass = utilPct != null ? utilizationColor(utilPct) : 'text-foreground';
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-lg font-mono font-bold ${colorClass}`}>{fmtNum(value, decimals)}</p>
        <p className="text-[10px] text-muted-foreground">{unit}</p>
        {utilPct != null && (
          <p className={`text-[10px] mt-0.5 ${utilizationColor(utilPct)}`}>{utilPct.toFixed(0)}% of cap</p>
        )}
      </CardContent>
    </Card>
  );
}

function UtilBar({ label, pct }: { label: string; pct: number }) {
  const capped = Math.min(pct, 100);
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-xs font-mono ${utilizationColor(pct)}`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progressColor(pct)}`}
          style={{ width: `${capped}%` }}
        />
      </div>
    </div>
  );
}
