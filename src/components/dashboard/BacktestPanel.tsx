'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import {
  FlaskConical,
  Loader2,
  Play,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ArrowUpDown,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';

import {
  BacktestConfig,
  BacktestResult,
  StrategyTemplate,
  SweepResultRow,
  getStrategyTemplates,
  runBacktest,
  runSweep,
} from '@/services/backtestService';

// ── Helpers ───────────────────────────────────────

const PIE_COLORS = ['#22c55e', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899'];

function fmtNum(v: number | string | null | undefined, decimals = 2): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'string') return v;
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtUsd(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  return `${v.toFixed(2)}%`;
}

function parseDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

// ── KPI Card ──────────────────────────────────────

function KPICard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card className="flex-1 min-w-[130px]">
      <CardContent className="p-3 text-center">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className={`text-lg font-bold ${color ?? ''}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

// ── Sort helper ───────────────────────────────────

type SortDir = 'asc' | 'desc';

function useSortable<T>(data: T[], defaultKey: keyof T, defaultDir: SortDir = 'desc') {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const sorted = useMemo(() => {
    const copy = [...data];
    copy.sort((a, b) => {
      const av = a[sortKey] as unknown as number | string ?? '';
      const bv = b[sortKey] as unknown as number | string ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
    return copy;
  }, [data, sortKey, sortDir]);

  const toggle = (key: keyof T) => {
    if (key === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return { sorted, sortKey, sortDir, toggle };
}

// ── Main Component ────────────────────────────────

export function BacktestPanel() {
  // Strategy templates
  const [templates, setTemplates] = useState<StrategyTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');

  // Config form state
  const [strategy, setStrategy] = useState('IC_SPY_30DTE');
  const [underlying, setUnderlying] = useState('SPY');
  const [startDate, setStartDate] = useState('2024-01-01');
  const [endDate, setEndDate] = useState('2024-12-31');
  const [capital, setCapital] = useState(100000);
  const [targetDelta, setTargetDelta] = useState(0.16);
  const [minDte, setMinDte] = useState(30);
  const [maxDte, setMaxDte] = useState(60);
  const [profitTarget, setProfitTarget] = useState(50);
  const [stopLoss, setStopLoss] = useState(100);
  const [timeStopDte, setTimeStopDte] = useState(7);
  const [maxPositions, setMaxPositions] = useState(3);
  const [commission, setCommission] = useState(0.5);
  const [slippage, setSlippage] = useState(0.01);

  // Execution state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  // Sweep state
  const [sweepOpen, setSweepOpen] = useState(false);
  const [sweepDelta, setSweepDelta] = useState(false);
  const [sweepDeltaVals, setSweepDeltaVals] = useState('0.10,0.16,0.20');
  const [sweepMinDte, setSweepMinDte] = useState(false);
  const [sweepMinDteVals, setSweepMinDteVals] = useState('25,30,35,45');
  const [sweepProfit, setSweepProfit] = useState(false);
  const [sweepProfitVals, setSweepProfitVals] = useState('40,50,60,75');
  const [sweepLoading, setSweepLoading] = useState(false);
  const [sweepResults, setSweepResults] = useState<SweepResultRow[]>([]);

  // Load templates on mount
  useEffect(() => {
    getStrategyTemplates()
      .then(setTemplates)
      .catch(() => {});
  }, []);

  // Apply template
  const applyTemplate = useCallback(
    (id: string) => {
      const t = templates.find(t => t.id === id);
      if (!t) return;
      setSelectedTemplate(id);
      setStrategy(t.strategy);
      setUnderlying(t.underlying);
      setTargetDelta(t.target_delta);
      setMinDte(t.min_dte);
      setMaxDte(t.max_dte);
      setProfitTarget(t.profit_target_pct);
      setStopLoss(t.stop_loss_pct);
      setTimeStopDte(t.time_stop_dte);
      setMaxPositions(t.max_positions);
    },
    [templates],
  );

  // Build config from form
  const buildConfig = useCallback((): BacktestConfig => ({
    strategy,
    underlying,
    start_date: startDate,
    end_date: endDate,
    initial_capital: capital,
    target_delta: targetDelta,
    min_dte: minDte,
    max_dte: maxDte,
    profit_target_pct: profitTarget,
    stop_loss_pct: stopLoss,
    time_stop_dte: timeStopDte,
    max_positions: maxPositions,
    commission_per_contract: commission,
    slippage_pct: slippage,
  }), [strategy, underlying, startDate, endDate, capital, targetDelta, minDte, maxDte, profitTarget, stopLoss, timeStopDte, maxPositions, commission, slippage]);

  // Run backtest
  const handleRunBacktest = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runBacktest(buildConfig());
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Backtest failed');
    } finally {
      setLoading(false);
    }
  };

  // Run sweep
  const handleRunSweep = async () => {
    const params: Record<string, number[]> = {};
    if (sweepDelta) params.target_delta = sweepDeltaVals.split(',').map(Number);
    if (sweepMinDte) params.min_dte = sweepMinDteVals.split(',').map(Number);
    if (sweepProfit) params.profit_target_pct = sweepProfitVals.split(',').map(Number);
    if (Object.keys(params).length === 0) return;

    setSweepLoading(true);
    setSweepResults([]);
    try {
      const res = await runSweep(buildConfig(), params);
      setSweepResults(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sweep failed');
    } finally {
      setSweepLoading(false);
    }
  };

  // Trade sort
  const tradeSort = useSortable(result?.trades ?? [], 'entry_time' as never);

  // Equity curve data
  const equityData = useMemo(() => {
    if (!result?.equity_curve) return [];
    // Downsample for performance (max 500 points)
    const ec = result.equity_curve;
    const step = Math.max(1, Math.floor(ec.length / 500));
    return ec
      .filter((_, i) => i % step === 0 || i === ec.length - 1)
      .map(p => ({
        date: parseDate(p.timestamp),
        equity: p.equity,
        cash: p.cash,
      }));
  }, [result]);

  // Drawdown overlay data
  const drawdownData = useMemo(() => {
    if (!result?.equity_curve) return [];
    let peak = 0;
    const ec = result.equity_curve;
    const step = Math.max(1, Math.floor(ec.length / 500));
    return ec
      .filter((_, i) => i % step === 0 || i === ec.length - 1)
      .map(p => {
        if (p.equity > peak) peak = p.equity;
        const dd = peak > 0 ? ((peak - p.equity) / peak) * 100 : 0;
        return { date: parseDate(p.timestamp), drawdown: -dd };
      });
  }, [result]);

  // Exit reason pie data
  const exitReasonData = useMemo(() => {
    if (!result?.summary?.exit_reasons) return [];
    return Object.entries(result.summary.exit_reasons).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value,
    }));
  }, [result]);

  const s = result?.summary;

  return (
    <div className="space-y-6">
      {/* ── Configuration ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5" />
            Backtest Configuration
          </CardTitle>
          <CardDescription>Configure and run a historical backtest of your strategy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template selector */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Strategy Template</Label>
              <Select value={selectedTemplate} onValueChange={applyTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Underlying</Label>
              <Input value={underlying} onChange={e => setUnderlying(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-1.5">
              <Label>Starting Capital ($)</Label>
              <Input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))} />
            </div>
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Target Delta</Label>
              <Input type="number" step="0.01" value={targetDelta} onChange={e => setTargetDelta(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Max Positions</Label>
              <Input type="number" value={maxPositions} onChange={e => setMaxPositions(Number(e.target.value))} />
            </div>
          </div>

          {/* DTE & exit rules */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="space-y-1.5">
              <Label>Min DTE</Label>
              <Input type="number" value={minDte} onChange={e => setMinDte(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Max DTE</Label>
              <Input type="number" value={maxDte} onChange={e => setMaxDte(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Profit Target %</Label>
              <Input type="number" value={profitTarget} onChange={e => setProfitTarget(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Stop Loss %</Label>
              <Input type="number" value={stopLoss} onChange={e => setStopLoss(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Time Stop DTE</Label>
              <Input type="number" value={timeStopDte} onChange={e => setTimeStopDte(Number(e.target.value))} />
            </div>
          </div>

          {/* Cost model */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Commission/Contract ($)</Label>
              <Input type="number" step="0.01" value={commission} onChange={e => setCommission(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <Label>Slippage %</Label>
              <Input type="number" step="0.001" value={slippage} onChange={e => setSlippage(Number(e.target.value))} />
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
          )}

          <Button onClick={handleRunBacktest} disabled={loading} className="w-full md:w-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            {loading ? 'Running Backtest...' : 'Run Backtest'}
          </Button>
        </CardContent>
      </Card>

      {/* ── Results ───────────────────────────────── */}
      {s && result && (
        <>
          {/* Synthetic data warning */}
          {result.synthetic_chains && (
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-300">
              <span className="font-semibold">⚠️ Synthetic Option Chains</span>
              <span className="ml-2 text-yellow-400/80">
                {result.data_note || 
                  'Option chains were generated using Black-Scholes pricing with VIX-derived IV and skew approximation. Results are directionally useful but not historically precise. Use real chain data for production-grade backtests.'}
              </span>
            </div>
          )}

          {/* KPI strip */}
          <div className="flex flex-wrap gap-3">
            <KPICard label="Total Return" value={fmtPct(s.total_return_pct)} color={s.total_return_pct >= 0 ? 'text-green-400' : 'text-red-400'} />
            <KPICard label="CAGR" value={fmtPct(s.cagr_pct)} color={s.cagr_pct >= 0 ? 'text-green-400' : 'text-red-400'} />
            <KPICard label="Max Drawdown" value={fmtPct(s.max_drawdown_pct)} color="text-red-400" />
            <KPICard label="Sharpe" value={fmtNum(s.sharpe_ratio, 3)} color={s.sharpe_ratio >= 1 ? 'text-green-400' : s.sharpe_ratio >= 0 ? 'text-yellow-400' : 'text-red-400'} />
            <KPICard label="Sortino" value={fmtNum(s.sortino_ratio, 3)} />
            <KPICard label="Win Rate" value={fmtPct(s.win_rate_pct)} color={s.win_rate_pct >= 50 ? 'text-green-400' : 'text-red-400'} />
            <KPICard label="Profit Factor" value={typeof s.profit_factor === 'number' ? fmtNum(s.profit_factor, 2) : String(s.profit_factor)} />
          </div>

          {/* Equity curve */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Equity Curve
              </CardTitle>
              <CardDescription>
                {fmtUsd(s.initial_capital)} → {fmtUsd(s.final_equity)} &middot; {s.total_trades} trades &middot; {fmtPct(s.total_return_pct)} return
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }}
                      formatter={(v: number) => [fmtUsd(v), 'Equity']}
                    />
                    <Area type="monotone" dataKey="equity" stroke="#22c55e" fill="url(#equityGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Drawdown overlay */}
              {drawdownData.length > 0 && (
                <div className="h-[120px] mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={drawdownData} margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ddGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${v.toFixed(0)}%`} domain={['dataMin', 0]} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }}
                        formatter={(v: number) => [`${v.toFixed(2)}%`, 'Drawdown']}
                      />
                      <Area type="monotone" dataKey="drawdown" stroke="#ef4444" fill="url(#ddGrad)" strokeWidth={1.5} dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Exit Reason Breakdown + Additional Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Exit reasons pie */}
            {exitReasonData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Exit Reason Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={exitReasonData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {exitReasonData.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Additional stats */}
            <Card>
              <CardHeader>
                <CardTitle>Trade Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Trades</span><span className="font-mono">{s.total_trades}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Wins / Losses / Flat</span><span className="font-mono">{s.wins} / {s.losses} / {s.flat}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Avg Win</span><span className="font-mono text-green-400">{fmtUsd(s.avg_win_usd)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Avg Loss</span><span className="font-mono text-red-400">{fmtUsd(s.avg_loss_usd)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Largest Win</span><span className="font-mono text-green-400">{fmtUsd(s.largest_win_usd)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Largest Loss</span><span className="font-mono text-red-400">{fmtUsd(s.largest_loss_usd)}</span></div>
                <Separator />
                <div className="flex justify-between"><span className="text-muted-foreground">Expectancy</span><span className="font-mono">{fmtUsd(s.expectancy_usd)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Avg Duration</span><span className="font-mono">{s.avg_duration_days?.toFixed(1)} days</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Max Consec Wins</span><span className="font-mono">{s.max_consecutive_wins}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Max Consec Losses</span><span className="font-mono">{s.max_consecutive_losses}</span></div>
              </CardContent>
            </Card>
          </div>

          {/* Trade Log */}
          <Card>
            <CardHeader>
              <CardTitle>Trade Log ({result.trades.length} trades)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    {[
                      { key: 'entry_time', label: 'Entry' },
                      { key: 'exit_time', label: 'Exit' },
                      { key: 'underlying', label: 'Symbol' },
                      { key: 'strategy_name', label: 'Strategy' },
                      { key: 'entry_credit_usd', label: 'Credit' },
                      { key: 'exit_debit_usd', label: 'Debit' },
                      { key: 'realized_pnl_usd', label: 'P&L' },
                      { key: 'exit_reason', label: 'Exit Reason' },
                      { key: 'duration_days', label: 'Days' },
                    ].map(col => (
                      <th
                        key={col.key}
                        className="py-2 px-2 cursor-pointer hover:text-foreground select-none"
                        onClick={() => tradeSort.toggle(col.key as never)}
                      >
                        <span className="flex items-center gap-1">
                          {col.label}
                          {tradeSort.sortKey === col.key && (
                            <ArrowUpDown className="h-3 w-3" />
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tradeSort.sorted.map((t, i) => {
                    const pnl = t.realized_pnl_usd ?? 0;
                    const isWin = pnl > 0;
                    return (
                      <tr
                        key={i}
                        className={`border-b border-border/50 ${isWin ? 'bg-green-500/5' : pnl < 0 ? 'bg-red-500/5' : ''}`}
                      >
                        <td className="py-1.5 px-2 font-mono">{parseDate(t.entry_time)}</td>
                        <td className="py-1.5 px-2 font-mono">{t.exit_time ? parseDate(t.exit_time) : '—'}</td>
                        <td className="py-1.5 px-2 font-medium">{t.underlying}</td>
                        <td className="py-1.5 px-2">{t.strategy_name}</td>
                        <td className="py-1.5 px-2 font-mono text-green-400">{fmtUsd(t.entry_credit_usd)}</td>
                        <td className="py-1.5 px-2 font-mono text-red-400">{t.exit_debit_usd != null ? fmtUsd(t.exit_debit_usd) : '—'}</td>
                        <td className={`py-1.5 px-2 font-mono font-bold ${isWin ? 'text-green-400' : pnl < 0 ? 'text-red-400' : ''}`}>
                          {fmtUsd(pnl)}
                        </td>
                        <td className="py-1.5 px-2">
                          <Badge variant={t.exit_reason === 'profit_target' ? 'default' : t.exit_reason === 'stop_loss' ? 'destructive' : 'secondary'} className="text-[10px]">
                            {t.exit_reason?.replace(/_/g, ' ') ?? '—'}
                          </Badge>
                        </td>
                        <td className="py-1.5 px-2 font-mono">{t.duration_days ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Parameter Sweep ────────────────────────── */}
      <Collapsible open={sweepOpen} onOpenChange={setSweepOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-accent/50 transition-colors">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Parameter Sweep
                </span>
                <ChevronDown className={`h-5 w-5 transition-transform ${sweepOpen ? 'rotate-180' : ''}`} />
              </CardTitle>
              <CardDescription>Run grid search across multiple parameter combinations</CardDescription>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {/* Sweep parameter toggles */}
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Checkbox id="sw-delta" checked={sweepDelta} onCheckedChange={v => setSweepDelta(!!v)} />
                  <Label htmlFor="sw-delta" className="min-w-[120px]">Target Delta</Label>
                  <Input
                    className="max-w-xs"
                    placeholder="0.10,0.16,0.20"
                    value={sweepDeltaVals}
                    onChange={e => setSweepDeltaVals(e.target.value)}
                    disabled={!sweepDelta}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox id="sw-dte" checked={sweepMinDte} onCheckedChange={v => setSweepMinDte(!!v)} />
                  <Label htmlFor="sw-dte" className="min-w-[120px]">Min DTE</Label>
                  <Input
                    className="max-w-xs"
                    placeholder="25,30,35,45"
                    value={sweepMinDteVals}
                    onChange={e => setSweepMinDteVals(e.target.value)}
                    disabled={!sweepMinDte}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox id="sw-profit" checked={sweepProfit} onCheckedChange={v => setSweepProfit(!!v)} />
                  <Label htmlFor="sw-profit" className="min-w-[120px]">Profit Target %</Label>
                  <Input
                    className="max-w-xs"
                    placeholder="40,50,60,75"
                    value={sweepProfitVals}
                    onChange={e => setSweepProfitVals(e.target.value)}
                    disabled={!sweepProfit}
                  />
                </div>
              </div>

              <Button onClick={handleRunSweep} disabled={sweepLoading || (!sweepDelta && !sweepMinDte && !sweepProfit)}>
                {sweepLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                {sweepLoading ? 'Running Sweep...' : 'Run Sweep'}
              </Button>

              {/* Sweep results table */}
              {sweepResults.length > 0 && (
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="py-2 px-2">#</th>
                        {sweepDelta && <th className="py-2 px-2">Delta</th>}
                        {sweepMinDte && <th className="py-2 px-2">Min DTE</th>}
                        {sweepProfit && <th className="py-2 px-2">Profit %</th>}
                        <th className="py-2 px-2">Sharpe</th>
                        <th className="py-2 px-2">Return %</th>
                        <th className="py-2 px-2">Max DD %</th>
                        <th className="py-2 px-2">Win Rate</th>
                        <th className="py-2 px-2">Trades</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sweepResults.map((r, i) => {
                        const isBest = i === 0;
                        const params = (r.config as Record<string, unknown>)?.strategy_params as Record<string, number> | undefined;
                        return (
                          <tr
                            key={i}
                            className={`border-b border-border/50 ${isBest ? 'bg-green-500/10 font-semibold' : ''}`}
                          >
                            <td className="py-1.5 px-2">
                              {isBest ? <Badge className="text-[10px]">BEST</Badge> : i + 1}
                            </td>
                            {sweepDelta && <td className="py-1.5 px-2 font-mono">{params?.target_delta ?? '—'}</td>}
                            {sweepMinDte && <td className="py-1.5 px-2 font-mono">{params?.min_dte ?? '—'}</td>}
                            {sweepProfit && <td className="py-1.5 px-2 font-mono">{(r.config as Record<string, unknown>)?.profit_target_pct as number ?? '—'}</td>}
                            <td className="py-1.5 px-2 font-mono">{fmtNum(r.summary.sharpe_ratio, 3)}</td>
                            <td className={`py-1.5 px-2 font-mono ${r.summary.total_return_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {fmtPct(r.summary.total_return_pct)}
                            </td>
                            <td className="py-1.5 px-2 font-mono text-red-400">{fmtPct(r.summary.max_drawdown_pct)}</td>
                            <td className="py-1.5 px-2 font-mono">{fmtPct(r.summary.win_rate_pct)}</td>
                            <td className="py-1.5 px-2 font-mono">{r.trade_count}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
