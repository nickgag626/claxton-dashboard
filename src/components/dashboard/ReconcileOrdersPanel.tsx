'use client';

import { useEffect, useMemo, useState } from 'react';
import { quantReconcile, ReconcileAnomaly, ReconcileStatus } from '@/services/quantReconcile';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { RefreshCw, AlertTriangle, ShieldAlert } from 'lucide-react';

function severityBadgeVariant(sev?: string) {
  const s = (sev || '').toUpperCase();
  if (s === 'P0') return { variant: 'destructive' as const, label: 'P0' };
  if (s === 'P1') return { variant: 'secondary' as const, label: 'P1' };
  if (s === 'P2') return { variant: 'outline' as const, label: 'P2' };
  return { variant: 'outline' as const, label: s || '?' };
}

export function ReconcileOrdersPanel() {
  const [status, setStatus] = useState<ReconcileStatus | null>(null);
  const [anomalies, setAnomalies] = useState<ReconcileAnomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTrigger, setLastTrigger] = useState<any>(null);

  const p0Count = useMemo(() => (status?.anomalies_by_severity?.P0 ?? 0), [status]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [st, an] = await Promise.all([
        quantReconcile.status(),
        quantReconcile.anomalies({ open_only: true }),
      ]);
      setStatus(st);
      setAnomalies(an.anomalies || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load reconcile data');
    } finally {
      setLoading(false);
    }
  }

  async function triggerReconcile() {
    setTriggering(true);
    setError(null);
    try {
      const res = await quantReconcile.trigger({ run_engine: true, run_entry_reconcile: true });
      setLastTrigger(res);
      // refresh after trigger
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Trigger failed');
    } finally {
      setTriggering(false);
    }
  }

  async function resolveAnomaly(id: string) {
    try {
      await quantReconcile.resolveAnomaly(id, 'dashboard');
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to resolve anomaly');
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Reconcile API error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            Reconcile / Orders (Ops)
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button size="sm" onClick={triggerReconcile} disabled={triggering}>
              <RefreshCw className={`h-4 w-4 mr-2 ${triggering ? 'animate-spin' : ''}`} />
              Trigger Reconcile
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
            <div>
              <div className="text-muted-foreground">Pending groups</div>
              <div className="font-semibold">{status?.pending_groups ?? '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Last successful entry reconcile</div>
              <div className="font-semibold">{status?.last_successful_reconcile_at ?? '—'}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Open anomalies</div>
              <div className="font-semibold">{status?.anomalies_open ?? anomalies.length}</div>
            </div>
            <div>
              <div className="text-muted-foreground">P0</div>
              <div className="font-semibold">{p0Count}</div>
            </div>
          </div>

          {lastTrigger?.summary && (
            <Alert>
              <AlertTitle>Last trigger summary</AlertTitle>
              <AlertDescription>
                <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(lastTrigger.summary, null, 2)}</pre>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anomalies (open)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Broker</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {anomalies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    No open anomalies.
                  </TableCell>
                </TableRow>
              ) : (
                anomalies.map((a) => {
                  const sev = severityBadgeVariant(a.severity);
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Badge variant={sev.variant}>{sev.label}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{a.type}</TableCell>
                      <TableCell>{a.broker || '—'}</TableCell>
                      <TableCell className="font-mono text-xs">{a.broker_order_id || '—'}</TableCell>
                      <TableCell className="text-xs">{a.last_seen_at || '—'}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm">Details</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <DialogHeader>
                                <DialogTitle>{a.type} — {a.anomaly_key}</DialogTitle>
                              </DialogHeader>
                              <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(a.details ?? {}, null, 2)}</pre>
                            </DialogContent>
                          </Dialog>

                          <Button variant="secondary" size="sm" onClick={() => resolveAnomaly(a.id)}>
                            Resolve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
