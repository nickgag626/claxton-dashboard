'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  HeartPulse,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bell,
  BellOff,
  Shield,
  Hash,
  Clock,
} from 'lucide-react';
import {
  fetchAlerts,
  fetchAlertSummary,
  acknowledgeAlert,
  fetchConfigCurrent,
  fetchConfigAudit,
  fetchHealthCheck,
  type Alert,
  type AlertSummary,
  type ConfigState,
  type ConfigAuditEntry,
} from '@/services/sloService';

// ── Refresh interval ─────────────────────────────
const REFRESH_MS = 30_000; // 30 seconds

// ── Helpers ──────────────────────────────────────

function levelBadge(level: string) {
  switch (level) {
    case 'P0':
      return (
        <Badge variant="destructive" className="font-mono text-xs">
          🔴 P0
        </Badge>
      );
    case 'P1':
      return (
        <Badge variant="secondary" className="font-mono text-xs bg-yellow-600/20 text-yellow-400 border-yellow-600/40">
          🟡 P1
        </Badge>
      );
    case 'P2':
      return (
        <Badge variant="secondary" className="font-mono text-xs bg-green-600/20 text-green-400 border-green-600/40">
          🟢 P2
        </Badge>
      );
    case 'CRITICAL':
      return (
        <Badge variant="destructive" className="font-mono text-xs">
          🚨 CRIT
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="font-mono text-xs">
          {level}
        </Badge>
      );
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type SystemStatus = 'healthy' | 'degraded' | 'critical';

function deriveStatus(summary: AlertSummary | null): SystemStatus {
  if (!summary) return 'healthy';
  if ((summary.by_level['P0'] ?? 0) > 0) return 'critical';
  if ((summary.by_level['CRITICAL'] ?? 0) > 0) return 'critical';
  if ((summary.by_level['P1'] ?? 0) > 0) return 'degraded';
  return 'healthy';
}

function statusBadgeDisplay(status: SystemStatus) {
  switch (status) {
    case 'critical':
      return (
        <div className="flex items-center gap-2">
          <XCircle className="h-6 w-6 text-red-500 animate-pulse" />
          <span className="text-lg font-bold text-red-400">Critical</span>
        </div>
      );
    case 'degraded':
      return (
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-yellow-500" />
          <span className="text-lg font-bold text-yellow-400">Degraded</span>
        </div>
      );
    default:
      return (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
          <span className="text-lg font-bold text-green-400">Healthy</span>
        </div>
      );
  }
}

function sloColor(value: number, greenMax: number, yellowMax: number): string {
  if (value <= greenMax) return 'text-green-400';
  if (value <= yellowMax) return 'text-yellow-400';
  return 'text-red-400';
}

function sloColorInverse(value: number, greenMin: number, yellowMin: number): string {
  if (value >= greenMin) return 'text-green-400';
  if (value >= yellowMin) return 'text-yellow-400';
  return 'text-red-400';
}

// ── Component ────────────────────────────────────

export function SLOPanel() {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [config, setConfig] = useState<ConfigState | null>(null);
  const [audit, setAudit] = useState<ConfigAuditEntry[]>([]);
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [acking, setAcking] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [alertsData, summaryData, configData, auditData, healthData] =
        await Promise.all([
          fetchAlerts({ level: levelFilter === 'all' ? undefined : levelFilter, limit: 50 }),
          fetchAlertSummary(),
          fetchConfigCurrent(),
          fetchConfigAudit(5),
          fetchHealthCheck().catch(() => null),
        ]);
      setAlerts(alertsData);
      setSummary(summaryData);
      setConfig(configData);
      setAudit(auditData);
      setHealth(healthData);
    } catch (err) {
      console.error('SLO refresh failed:', err);
    } finally {
      setLoading(false);
    }
  }, [levelFilter]);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(iv);
  }, [refresh]);

  const handleAck = async (id: string) => {
    setAcking(id);
    const ok = await acknowledgeAlert(id);
    if (ok) {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, acknowledged: true, acknowledged_at: new Date().toISOString() }
            : a,
        ),
      );
      // Refresh summary
      fetchAlertSummary().then(setSummary).catch(() => {});
    }
    setAcking(null);
  };

  // Derive SLO values
  const systemStatus = deriveStatus(summary);
  const p0Count = summary?.by_level['P0'] ?? 0;
  const p1Count = summary?.by_level['P1'] ?? 0;
  const reconcile = health?.reconcile as Record<string, unknown> | undefined;
  const lastReconcileAt = reconcile?.last_successful_reconcile_at as string | undefined;
  const reconcileAgeMin = lastReconcileAt
    ? Math.floor((Date.now() - new Date(lastReconcileAt).getTime()) / 60_000)
    : null;

  if (loading) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Health at a Glance ─────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-primary" />
              System Health
            </div>
            <Button variant="ghost" size="sm" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {statusBadgeDisplay(systemStatus)}
            <div className="text-sm text-muted-foreground">
              {summary?.total_unacknowledged ?? 0} unacknowledged alerts
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── SLO Cards ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Reconcile Age */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground mb-1">Reconcile Age</div>
            <div
              className={`text-2xl font-bold ${
                reconcileAgeMin === null
                  ? 'text-muted-foreground'
                  : sloColor(reconcileAgeMin, 5, 15)
              }`}
            >
              {reconcileAgeMin !== null ? `${reconcileAgeMin}m` : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {reconcileAgeMin !== null && reconcileAgeMin <= 5
                ? '✓ OK'
                : reconcileAgeMin !== null && reconcileAgeMin <= 15
                ? '⚠ Stale'
                : reconcileAgeMin !== null
                ? '🔴 Overdue'
                : 'No data'}
            </div>
          </CardContent>
        </Card>

        {/* Anomaly Count */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground mb-1">Anomalies</div>
            <div className="text-2xl font-bold text-muted-foreground">
              {(reconcile?.pending_groups as number) ?? '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Pending groups</div>
          </CardContent>
        </Card>

        {/* Fill Rate (placeholder — requires order stats endpoint) */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground mb-1">Fill Rate (24h)</div>
            <div className="text-2xl font-bold text-muted-foreground">—</div>
            <div className="text-xs text-muted-foreground mt-1">Orders filled / submitted</div>
          </CardContent>
        </Card>

        {/* Reject Rate (placeholder) */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground mb-1">Reject Rate (24h)</div>
            <div className="text-2xl font-bold text-muted-foreground">—</div>
            <div className="text-xs text-muted-foreground mt-1">Orders rejected / submitted</div>
          </CardContent>
        </Card>

        {/* P0 Alerts */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground mb-1">P0 Alerts</div>
            <div className={`text-2xl font-bold ${p0Count > 0 ? 'text-red-400' : 'text-green-400'}`}>
              {p0Count}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {p0Count > 0 ? '🔴 Unacked' : '✓ Clear'}
            </div>
          </CardContent>
        </Card>

        {/* P1 Alerts */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4 pb-3 px-4">
            <div className="text-xs text-muted-foreground mb-1">P1 Alerts</div>
            <div className={`text-2xl font-bold ${p1Count > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
              {p1Count}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {p1Count > 0 ? '🟡 Unacked' : '✓ Clear'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Recent Alerts Table ───────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Recent Alerts
            </div>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="P0">P0</SelectItem>
                <SelectItem value="P1">P1</SelectItem>
                <SelectItem value="P2">P2</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="TRADE">Trade</SelectItem>
                <SelectItem value="INFO">Info</SelectItem>
              </SelectContent>
            </Select>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No alerts found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Time</TableHead>
                    <TableHead className="w-[80px]">Level</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="w-[80px]">Status</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {alert.created_at ? timeAgo(alert.created_at) : '—'}
                      </TableCell>
                      <TableCell>{levelBadge(alert.level)}</TableCell>
                      <TableCell className="text-sm max-w-[400px] truncate">
                        {alert.message}
                      </TableCell>
                      <TableCell>
                        {alert.acknowledged ? (
                          <Badge
                            variant="outline"
                            className="text-xs text-green-400 border-green-600/40"
                          >
                            <BellOff className="h-3 w-3 mr-1" />
                            Acked
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-xs text-orange-400 border-orange-600/40"
                          >
                            <Bell className="h-3 w-3 mr-1" />
                            Open
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!alert.acknowledged && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            disabled={acking === alert.id}
                            onClick={() => handleAck(alert.id)}
                          >
                            {acking === alert.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              'Ack'
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Config Info ───────────────────────────── */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Config &amp; Version
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Hash className="h-3 w-3" /> Config Hash
              </div>
              <code className="text-sm font-mono text-primary">
                {config?.config_hash ? config.config_hash.slice(0, 16) + '…' : '—'}
              </code>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Hash className="h-3 w-3" /> Engine SHA
              </div>
              <code className="text-sm font-mono text-primary">
                {config?.engine_sha ? config.engine_sha.slice(0, 12) : '—'}
              </code>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                <Clock className="h-3 w-3" /> Last Config Change
              </div>
              <code className="text-sm font-mono text-muted-foreground">
                {audit.length > 0 ? timeAgo(audit[0].created_at) : '—'}
              </code>
            </div>
          </div>

          {/* Audit trail */}
          {audit.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-muted-foreground mb-2">Recent Config Changes</div>
              <div className="space-y-1">
                {audit.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 text-xs font-mono bg-muted/30 rounded px-2 py-1"
                  >
                    <span className="text-muted-foreground w-20 shrink-0">
                      {entry.created_at ? timeAgo(entry.created_at) : '—'}
                    </span>
                    <span className="text-primary">
                      {entry.config_hash.slice(0, 12)}
                    </span>
                    <span className="text-muted-foreground">{entry.source}</span>
                    {entry.changed_keys.length > 0 && (
                      <span className="text-yellow-400">
                        Δ {entry.changed_keys.join(', ')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
