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
  ShieldCheck,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Power,
  Zap,
  Server,
  Key,
} from 'lucide-react';
import { adminService, type EnvironmentInfo, type SecretStatus, type SystemInfo } from '@/services/adminService';

const REFRESH_MS = 30_000;

// ── Environment Banner ───────────────────────────
function EnvironmentBanner({ env }: { env: EnvironmentInfo | null }) {
  if (!env) return null;

  const config: Record<string, { bg: string; border: string; text: string; icon: string; label: string; pulse?: boolean }> = {
    paper: { bg: 'bg-green-900/30', border: 'border-green-600/50', text: 'text-green-400', icon: '🟢', label: 'PAPER — Safe for Testing' },
    live: { bg: 'bg-red-900/30', border: 'border-red-600/50', text: 'text-red-400', icon: '🔴', label: 'LIVE — Real Money', pulse: true },
    dev: { bg: 'bg-blue-900/30', border: 'border-blue-600/50', text: 'text-blue-400', icon: '🔵', label: 'DEV — Development' },
  };
  const c = config[env.environment] || config.dev;

  return (
    <div className={`rounded-lg border-2 ${c.bg} ${c.border} p-4 mb-4 ${c.pulse ? 'animate-pulse' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{c.icon}</span>
          <div>
            <div className={`text-lg font-bold ${c.text}`}>{c.label}</div>
            <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
              <span>Broker: <span className="font-mono text-foreground">{env.primary_broker}</span></span>
              <span>Shadow: <span className={env.shadow_mode ? 'text-yellow-400' : 'text-foreground'}>{env.shadow_mode ? 'ON' : 'OFF'}</span></span>
              <span>Streaming: <span className={env.streaming_enabled ? 'text-green-400' : 'text-foreground'}>{env.streaming_enabled ? 'ON' : 'OFF'}</span></span>
              <span>MCP: <span className={env.mcp_enabled ? 'text-green-400' : 'text-foreground'}>{env.mcp_enabled ? 'ON' : 'OFF'}</span></span>
              <span>Bot: <span className={env.bot_enabled ? 'text-green-400' : 'text-red-400'}>{env.bot_enabled ? 'RUNNING' : 'STOPPED'}</span></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Secrets Health Table ─────────────────────────
const EXPECTED_SECRETS = [
  'TRADIER_API_TOKEN',
  'SUPABASE_SERVICE_KEY',
  'TELEGRAM_BOT_TOKEN',
  'IBKR_HOST',
  'IBKR_PORT',
  'IBKR_CLIENT_ID',
];

function SecretsHealth({ secrets }: { secrets: SecretStatus[] }) {
  // Merge expected with actual
  const rows: { name: string; configured: boolean; last_rotated?: string }[] = EXPECTED_SECRETS.map(name => {
    const found = secrets.find(s => s.name === name);
    return {
      name,
      configured: found?.configured ?? false,
      last_rotated: found?.last_rotated,
    };
  });

  // Also include any extras from API
  secrets.forEach(s => {
    if (!EXPECTED_SECRETS.includes(s.name)) {
      rows.push({ name: s.name, configured: s.configured, last_rotated: s.last_rotated });
    }
  });

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Key className="h-4 w-4" />
          Secrets Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800">
              <TableHead className="text-xs">Secret Name</TableHead>
              <TableHead className="text-xs text-center">Status</TableHead>
              <TableHead className="text-xs">Last Rotated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(row => (
              <TableRow key={row.name} className="border-zinc-800">
                <TableCell className="font-mono text-xs">{row.name}</TableCell>
                <TableCell className="text-center">
                  {row.configured ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400 inline" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400 inline" />
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {row.last_rotated || '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── System Info ──────────────────────────────────
function SystemInfoCard({ info }: { info: SystemInfo | null }) {
  if (!info) return null;

  const items: { label: string; value: string | undefined }[] = [
    { label: 'Engine SHA', value: info.engine_sha?.slice(0, 10) },
    { label: 'Config Hash', value: info.config_hash?.slice(0, 12) },
    { label: 'Uptime', value: info.uptime },
    { label: 'Python', value: info.python_version },
    { label: 'Hostname', value: info.hostname },
    { label: 'Monitor Mode', value: info.monitor_mode },
    { label: 'Entry Interval', value: info.entry_interval ? `${info.entry_interval}s` : undefined },
    { label: 'Exit Interval', value: info.exit_interval ? `${info.exit_interval}s` : undefined },
  ];

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Server className="h-4 w-4" />
          System Info
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {items.map(item => (
            <div key={item.label}>
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="font-mono text-sm">{item.value || '—'}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Danger Zone ──────────────────────────────────
function DangerZone({ env, onStopBot, onKillSwitch }: {
  env: EnvironmentInfo | null;
  onStopBot: () => void;
  onKillSwitch: () => void;
}) {
  const [confirmStop, setConfirmStop] = useState(false);
  const [confirmKill, setConfirmKill] = useState(false);
  const [acting, setActing] = useState(false);

  const handleStop = async () => {
    setActing(true);
    try {
      await adminService.stopBot();
      onStopBot();
    } catch {
      // ignore
    }
    setActing(false);
    setConfirmStop(false);
  };

  const handleKill = async () => {
    setActing(true);
    try {
      await adminService.toggleKillSwitch(true);
      onKillSwitch();
    } catch {
      // ignore
    }
    setActing(false);
    setConfirmKill(false);
  };

  return (
    <Card className="border-red-900/50 bg-red-950/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-red-400">
          <AlertTriangle className="h-4 w-4" />
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stop Bot */}
        <div className="flex items-center justify-between gap-4 p-3 rounded border border-zinc-800 bg-zinc-900/40">
          <div>
            <div className="text-sm font-medium">Stop Bot</div>
            <div className="text-xs text-muted-foreground">Gracefully stop the trading bot. No new entries will be placed.</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!confirmStop ? (
              <Button variant="destructive" size="sm" onClick={() => setConfirmStop(true)} disabled={!env?.bot_enabled}>
                <Power className="h-3.5 w-3.5 mr-1" /> Stop
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-red-400">
                  <input type="checkbox" id="confirm-stop" className="rounded" onChange={e => e.target.checked && handleStop()} disabled={acting} />
                  Confirm
                </label>
                <Button variant="ghost" size="sm" onClick={() => setConfirmStop(false)} disabled={acting}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Kill Switch */}
        <div className="flex items-center justify-between gap-4 p-3 rounded border border-red-900/30 bg-red-950/20">
          <div>
            <div className="text-sm font-medium text-red-400">Kill Switch</div>
            <div className="text-xs text-muted-foreground">Emergency stop — closes all positions and halts all trading immediately.</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!confirmKill ? (
              <Button variant="destructive" size="sm" onClick={() => setConfirmKill(true)}>
                <Zap className="h-3.5 w-3.5 mr-1" /> Kill Switch
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-red-400">
                  <input type="checkbox" id="confirm-kill" className="rounded" onChange={e => e.target.checked && handleKill()} disabled={acting} />
                  I understand
                </label>
                <Button variant="ghost" size="sm" onClick={() => setConfirmKill(false)} disabled={acting}>
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Panel ───────────────────────────────────
export function AdminPanel() {
  const [env, setEnv] = useState<EnvironmentInfo | null>(null);
  const [secrets, setSecrets] = useState<SecretStatus[]>([]);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [envData, secretsData, sys] = await Promise.all([
        adminService.getEnvironment(),
        adminService.getSecretsStatus(),
        adminService.getSystemInfo(),
      ]);
      setEnv(envData);
      setSecrets(secretsData);
      setSysInfo(sys);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, REFRESH_MS);
    return () => clearInterval(iv);
  }, [loadData]);

  return (
    <Card className="border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Admin & Security
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={loadData} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="text-sm text-red-400 bg-red-900/20 rounded p-2 border border-red-800/40">
            {error}
          </div>
        )}

        {loading && !env ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <EnvironmentBanner env={env} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SecretsHealth secrets={secrets} />
              <SystemInfoCard info={sysInfo} />
            </div>
            <DangerZone env={env} onStopBot={loadData} onKillSwitch={loadData} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
