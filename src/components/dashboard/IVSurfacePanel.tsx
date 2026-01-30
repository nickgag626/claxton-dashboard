'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Loader2,
  AlertCircle,
  Target,
  BarChart3,
  Calendar,
  Lightbulb,
} from 'lucide-react';
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
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  getIVSurface,
  getSmartDTE,
  type IVSurfaceResponse,
  type SmartDTEResponse,
} from '@/services/ivSurfaceService';

export function IVSurfacePanel() {
  const [symbol, setSymbol] = useState('SPY');
  const [inputSymbol, setInputSymbol] = useState('SPY');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [surfaceData, setSurfaceData] = useState<IVSurfaceResponse | null>(null);
  const [dteData, setDteData] = useState<SmartDTEResponse | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [surface, dte] = await Promise.all([
        getIVSurface(symbol),
        getSmartDTE(symbol),
      ]);
      setSurfaceData(surface);
      setDteData(dte);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IV surface');
    } finally {
      setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputSymbol.trim()) {
      setSymbol(inputSymbol.trim().toUpperCase());
    }
  };

  const analysis = surfaceData?.analysis;

  // Format IV as percentage
  const fmtIV = (v: number | null | undefined) => {
    if (v == null) return '—';
    const pct = Math.abs(v) < 1 ? v * 100 : v;
    return `${pct.toFixed(1)}%`;
  };

  // Format slope direction
  const slopeLabel = (slope: number | undefined) => {
    if (slope == null) return 'Unknown';
    if (slope > 0.0001) return 'Contango';
    if (slope < -0.0001) return 'Backwardation';
    return 'Flat';
  };

  return (
    <div className="space-y-4">
      {/* Symbol Selector */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                IV Surface Intelligence
              </CardTitle>
              <CardDescription>
                Implied volatility surface analysis — skew, term structure, and recommendations
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputSymbol}
              onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
              placeholder="Symbol (e.g., SPY)"
              className="w-32"
            />
            <Button type="submit" size="sm" disabled={loading}>
              Analyze
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-4 flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error}</span>
          </CardContent>
        </Card>
      )}

      {loading && !surfaceData && (
        <Card>
          <CardContent className="py-8 flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Building IV surface for {symbol}...</p>
          </CardContent>
        </Card>
      )}

      {surfaceData && !analysis && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            {surfaceData.message || 'No IV data available for this symbol.'}
          </CardContent>
        </Card>
      )}

      {analysis && (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard
              label="ATM IV"
              value={fmtIV(analysis.atm_iv)}
              icon={<BarChart3 className="h-4 w-4" />}
              color={analysis.atm_iv > 0.25 ? 'text-amber-500' : 'text-green-500'}
            />
            <MetricCard
              label="25Δ Skew"
              value={fmtIV(analysis.skew_25d)}
              icon={
                analysis.skew_25d > 0 ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )
              }
              sublabel={analysis.skew_25d > 0 ? 'Puts > Calls' : 'Calls > Puts'}
              color={analysis.skew_25d > 0.03 ? 'text-amber-500' : 'text-blue-500'}
            />
            <MetricCard
              label="Skew Ratio"
              value={analysis.skew_ratio_25d.toFixed(2)}
              icon={<Target className="h-4 w-4" />}
              sublabel={analysis.skew_ratio_25d > 1 ? 'Normal' : 'Inverted'}
              color={analysis.skew_ratio_25d > 1.2 ? 'text-amber-500' : 'text-green-500'}
            />
            <MetricCard
              label="Smile Width"
              value={fmtIV(analysis.smile_width)}
              icon={<BarChart3 className="h-4 w-4" />}
              sublabel="Tail premium"
            />
          </div>

          {/* Term Structure Chart */}
          {analysis.term_structure.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  Term Structure
                  <Badge
                    variant={
                      analysis.term_structure_slope > 0.0001
                        ? 'default'
                        : analysis.term_structure_slope < -0.0001
                          ? 'destructive'
                          : 'secondary'
                    }
                  >
                    {slopeLabel(analysis.term_structure_slope)}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  ATM implied volatility by days to expiration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analysis.term_structure}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="dte"
                        label={{ value: 'DTE', position: 'insideBottomRight', offset: -5 }}
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        tickFormatter={(v: number) =>
                          `${(Math.abs(v) < 1 ? v * 100 : v).toFixed(1)}%`
                        }
                        tick={{ fontSize: 12 }}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          `${(Math.abs(value) < 1 ? value * 100 : value).toFixed(2)}%`,
                          'ATM IV',
                        ]}
                        labelFormatter={(label) => `DTE: ${label}`}
                      />
                      <Line
                        type="monotone"
                        dataKey="atm_iv"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Skew Analysis */}
          {analysis.skew_by_expiration.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Skew Analysis by Expiration</CardTitle>
                <CardDescription>
                  25-delta put vs call IV across expirations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={analysis.skew_by_expiration
                        .filter((s) => s.put_iv_25d != null && s.call_iv_25d != null)
                        .map((s) => ({
                          ...s,
                          put_iv_pct:
                            s.put_iv_25d != null
                              ? Math.abs(s.put_iv_25d) < 1
                                ? s.put_iv_25d * 100
                                : s.put_iv_25d
                              : 0,
                          call_iv_pct:
                            s.call_iv_25d != null
                              ? Math.abs(s.call_iv_25d) < 1
                                ? s.call_iv_25d * 100
                                : s.call_iv_25d
                              : 0,
                        }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="dte" tick={{ fontSize: 12 }} />
                      <YAxis
                        tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value: number, name: string) => [
                          `${value.toFixed(1)}%`,
                          name === 'put_iv_pct' ? '25Δ Put IV' : '25Δ Call IV',
                        ]}
                        labelFormatter={(label) => `DTE: ${label}`}
                      />
                      <Legend
                        formatter={(value) =>
                          value === 'put_iv_pct' ? '25Δ Put IV' : '25Δ Call IV'
                        }
                      />
                      <Bar dataKey="put_iv_pct" fill="hsl(0, 70%, 60%)" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="call_iv_pct" fill="hsl(210, 70%, 60%)" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis.recommendation.split(';').map((rec, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded-md"
                >
                  <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  <span>{rec.trim()}</span>
                </div>
              ))}
              {analysis.richest_expiration && (
                <div className="flex items-start gap-2 text-sm bg-amber-500/10 p-2 rounded-md">
                  <Target className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Richest expiration:</strong> {analysis.richest_expiration} — highest
                    ATM IV, best premium selling target
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Smart DTE */}
          {dteData && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Smart DTE Recommendation
                </CardTitle>
                <CardDescription>
                  Optimal DTE range based on VIX regime, IV term structure, and earnings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/50 p-3 rounded-md">
                    <p className="text-xs text-muted-foreground">Strategy Default</p>
                    <p className="text-lg font-bold">
                      {dteData.original_min_dte}–{dteData.original_max_dte}
                      <span className="text-sm font-normal text-muted-foreground ml-1">DTE</span>
                    </p>
                  </div>
                  <div className="bg-primary/10 p-3 rounded-md border border-primary/20">
                    <p className="text-xs text-muted-foreground">Recommended</p>
                    <p className="text-lg font-bold text-primary">
                      {dteData.recommended_min_dte}–{dteData.recommended_max_dte}
                      <span className="text-sm font-normal text-muted-foreground ml-1">DTE</span>
                    </p>
                  </div>
                </div>

                {dteData.vix != null && (
                  <div className="text-sm text-muted-foreground">
                    Current VIX: <strong>{dteData.vix.toFixed(1)}</strong>
                  </div>
                )}

                {dteData.earnings_dates.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Next earnings: <strong>{dteData.earnings_dates[0]}</strong>
                  </div>
                )}

                <div className="space-y-1">
                  {dteData.reasons.map((reason, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded-md"
                    >
                      <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// === Helper Components ===

function MetricCard({
  label,
  value,
  icon,
  sublabel,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  sublabel?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
          {icon}
          {label}
        </div>
        <p className={`text-xl font-bold ${color || ''}`}>{value}</p>
        {sublabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
        )}
      </CardContent>
    </Card>
  );
}
