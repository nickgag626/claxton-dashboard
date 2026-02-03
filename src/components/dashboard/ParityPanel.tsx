'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Scale,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Play,
} from 'lucide-react';
import {
  parityService,
  type ParityReport,
  type ParitySummary,
} from '@/services/parityService';

// ── Helpers ──────────────────────────────────────

function matchRateColor(rate: number): string {
  if (rate >= 95) return 'text-green-400';
  if (rate >= 85) return 'text-yellow-400';
  return 'text-red-400';
}

function matchRateBadge(rate: number): 'default' | 'secondary' | 'destructive' {
  if (rate >= 95) return 'default';
  if (rate >= 85) return 'secondary';
  return 'destructive';
}

function rowDivergenceClass(divergence: number): string {
  const abs = Math.abs(divergence);
  if (abs <= 5) return 'border-l-2 border-l-green-500/40';
  if (abs <= 25) return 'border-l-2 border-l-yellow-500/40';
  return 'border-l-2 border-l-red-500/40';
}

function fmtBps(n: number): string {
  return n.toFixed(1);
}

function fmtUsd(n: number): string {
  const sign = n < 0 ? '-' : n > 0 ? '+' : '';
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function fmtPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Component ────────────────────────────────────

export function ParityPanel() {
  const [reports, setReports] = useState<ParityReport[]>([]);
  const [summary, setSummary] = useState<ParitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(7);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await parityService.getReport(days);
      setReports(data.reports || []);
      setSummary(data.summary || null);
    } catch (e: any) {
      setError(e.message || 'Failed to fetch parity data');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRunCheck = async () => {
    setRunning(true);
    try {
      await parityService.runCheck();
      // Refresh data after running
      await fetchData();
    } catch (e: any) {
      setError(e.message || 'Failed to run parity check');
    } finally {
      setRunning(false);
    }
  };

  const toggleRow = (id: string) => {
    setExpandedRow(expandedRow === id ? null : id);
  };

  // ── Render ──

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scale className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Paper / Live Parity</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex rounded-md border border-border">
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  days === d
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                } ${d === 7 ? 'rounded-l-md' : ''} ${d === 30 ? 'rounded-r-md' : ''}`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRunCheck}
            disabled={running}
          >
            {running ? (
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            ) : (
              <Play className="h-3 w-3 mr-1" />
            )}
            Run Parity Check
          </Button>
          <Button size="sm" variant="ghost" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !summary && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && reports.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Scale className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h4 className="text-lg font-medium text-muted-foreground mb-2">
              No parity reports yet
            </h4>
            <p className="text-sm text-muted-foreground/70 max-w-md">
              Run your first parity check to compare paper and live trading
              results, or wait for the automated daily comparison.
            </p>
            <Button
              className="mt-4"
              size="sm"
              onClick={handleRunCheck}
              disabled={running}
            >
              {running ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <Play className="h-3 w-3 mr-1" />
              )}
              Run First Check
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Decision Match Rate */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Decision Match</span>
                {summary.decisionMatchRate >= 95 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                ) : summary.decisionMatchRate >= 85 ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                )}
              </div>
              <div className={`text-2xl font-mono font-bold ${matchRateColor(summary.decisionMatchRate)}`}>
                {fmtPct(summary.decisionMatchRate)}
              </div>
            </CardContent>
          </Card>

          {/* Avg Fill Slippage */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Avg Slippage</span>
              </div>
              <div className="text-2xl font-mono font-bold">
                {fmtBps(summary.avgSlippage)}
                <span className="text-sm text-muted-foreground ml-1">bps</span>
              </div>
            </CardContent>
          </Card>

          {/* P&L Divergence */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">P&L Divergence</span>
              </div>
              <div className={`text-2xl font-mono font-bold ${
                Math.abs(summary.avgFillDivergence) <= 5
                  ? 'text-green-400'
                  : Math.abs(summary.avgFillDivergence) <= 25
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}>
                {fmtUsd(summary.avgFillDivergence)}
              </div>
            </CardContent>
          </Card>

          {/* Days Tracked */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Days Tracked</span>
              </div>
              <div className="text-2xl font-mono font-bold">
                {summary.totalDays}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Daily Report Table */}
      {reports.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Daily Reports
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 w-8"></th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2 text-right">Trades</th>
                    <th className="px-4 py-2 text-right">Match Rate</th>
                    <th className="px-4 py-2 text-right">Slippage (bps)</th>
                    <th className="px-4 py-2 text-right">Paper P&L</th>
                    <th className="px-4 py-2 text-right">Live P&L</th>
                    <th className="px-4 py-2 text-right">Divergence</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <ReportRow
                      key={r.id}
                      report={r}
                      expanded={expandedRow === r.id}
                      onToggle={() => toggleRow(r.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Report Row ───────────────────────────────────

function ReportRow({
  report,
  expanded,
  onToggle,
}: {
  report: ParityReport;
  expanded: boolean;
  onToggle: () => void;
}) {
  const divergence = (report.paper_pnl_usd || 0) - (report.live_pnl_usd || 0);

  return (
    <>
      <tr
        className={`border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors ${rowDivergenceClass(divergence)}`}
        onClick={onToggle}
      >
        <td className="px-4 py-2.5">
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </td>
        <td className="px-4 py-2.5 font-medium">{fmtDate(report.report_date)}</td>
        <td className="px-4 py-2.5 text-right font-mono">{report.total_trades}</td>
        <td className="px-4 py-2.5 text-right">
          <Badge variant={matchRateBadge(report.decision_match_rate)} className="font-mono text-xs">
            {fmtPct(report.decision_match_rate)}
          </Badge>
        </td>
        <td className="px-4 py-2.5 text-right font-mono">
          {fmtBps(report.avg_fill_slippage_bps || 0)}
        </td>
        <td className="px-4 py-2.5 text-right font-mono">
          {fmtUsd(report.paper_pnl_usd || 0)}
        </td>
        <td className="px-4 py-2.5 text-right font-mono">
          {fmtUsd(report.live_pnl_usd || 0)}
        </td>
        <td className={`px-4 py-2.5 text-right font-mono font-semibold ${
          Math.abs(divergence) <= 5
            ? 'text-green-400'
            : Math.abs(divergence) <= 25
            ? 'text-yellow-400'
            : 'text-red-400'
        }`}>
          {fmtUsd(divergence)}
        </td>
      </tr>

      {/* Expanded Details */}
      {expanded && report.details && report.details.length > 0 && (
        <tr>
          <td colSpan={8} className="bg-muted/20 px-8 py-3">
            <div className="text-xs space-y-1">
              <div className="font-medium text-muted-foreground mb-2">
                Trade Details
              </div>
              <div className="grid grid-cols-5 gap-2 text-muted-foreground font-medium pb-1 border-b border-border/30">
                <span>Symbol</span>
                <span className="text-right">Paper Fill</span>
                <span className="text-right">Live Fill</span>
                <span className="text-right">Slippage</span>
                <span className="text-right">Decision</span>
              </div>
              {report.details.map((detail: any, idx: number) => (
                <div key={idx} className="grid grid-cols-5 gap-2 py-0.5">
                  <span className="font-mono">{detail.symbol || '-'}</span>
                  <span className="text-right font-mono">
                    {detail.paper_fill ? `$${detail.paper_fill.toFixed(2)}` : '-'}
                  </span>
                  <span className="text-right font-mono">
                    {detail.live_fill ? `$${detail.live_fill.toFixed(2)}` : '-'}
                  </span>
                  <span className="text-right font-mono">
                    {detail.slippage_bps ? `${detail.slippage_bps.toFixed(1)} bps` : '-'}
                  </span>
                  <span className="text-right">
                    {detail.decision_match ? (
                      <CheckCircle2 className="h-3 w-3 text-green-400 inline" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-400 inline" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}

      {/* Expanded but no details */}
      {expanded && (!report.details || report.details.length === 0) && (
        <tr>
          <td colSpan={8} className="bg-muted/20 px-8 py-3">
            <span className="text-xs text-muted-foreground">
              No trade-level details available for this report.
            </span>
          </td>
        </tr>
      )}
    </>
  );
}
