'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ScrollText,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
} from 'lucide-react';
import { auditService, type AuditEvent, type RunInfo } from '@/services/auditService';

const REFRESH_MS = 30_000;
const PAGE_SIZE = 50;

// ── Event type config ────────────────────────────
const EVENT_TYPES: Record<string, { icon: string; color: string; label: string }> = {
  order_intent: { icon: '📋', color: 'text-blue-400', label: 'Order Intent' },
  broker_order: { icon: '🏦', color: 'text-purple-400', label: 'Broker Order' },
  fill: { icon: '💰', color: 'text-green-400', label: 'Fill' },
  reconcile: { icon: '🔄', color: 'text-orange-400', label: 'Reconcile' },
  config_change: { icon: '⚙️', color: 'text-gray-400', label: 'Config Change' },
  alert: { icon: '🚨', color: 'text-red-400', label: 'Alert' },
};

function getEventMeta(type: string) {
  return EVENT_TYPES[type] || { icon: '📌', color: 'text-muted-foreground', label: type };
}

function formatTs(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    return ts;
  }
}

// ── Run Info Header ──────────────────────────────
function RunInfoHeader({ info }: { info: RunInfo | null }) {
  if (!info) return null;
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {info.config_hash && (
        <Badge variant="outline" className="font-mono text-xs px-3 py-1 bg-zinc-800/60 border-zinc-700">
          Config: {info.config_hash.slice(0, 12)}
        </Badge>
      )}
      {info.engine_sha && (
        <Badge variant="outline" className="font-mono text-xs px-3 py-1 bg-zinc-800/60 border-zinc-700">
          Engine: {info.engine_sha.slice(0, 10)}
        </Badge>
      )}
      {info.dataset_version && (
        <Badge variant="outline" className="font-mono text-xs px-3 py-1 bg-zinc-800/60 border-zinc-700">
          Dataset: {info.dataset_version}
        </Badge>
      )}
      {info.last_replay && (
        <Badge variant="outline" className="font-mono text-xs px-3 py-1 bg-zinc-800/60 border-zinc-700">
          Last Replay: {formatTs(info.last_replay)}
        </Badge>
      )}
    </div>
  );
}

// ── Timeline Event ───────────────────────────────
function TimelineEvent({ event, onTraceClick }: { event: AuditEvent; onTraceClick: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getEventMeta(event.event_type);

  return (
    <div className="flex gap-3 relative">
      {/* Timeline line */}
      <div className="flex flex-col items-center">
        <span className="text-lg leading-none">{meta.icon}</span>
        <div className="w-px flex-1 bg-zinc-700 mt-1" />
      </div>
      {/* Content */}
      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs text-muted-foreground">{formatTs(event.timestamp)}</span>
          <Badge variant="secondary" className={`text-xs ${meta.color} bg-transparent border-0 px-0`}>
            {meta.label}
          </Badge>
          {event.trade_group_id && (
            <button
              onClick={() => onTraceClick(event.trade_group_id!)}
              className="font-mono text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2"
            >
              {event.trade_group_id.slice(0, 8)}…
            </button>
          )}
          {event.order_id && (
            <span className="font-mono text-xs text-muted-foreground">
              ord:{event.order_id.slice(0, 8)}
            </span>
          )}
        </div>
        {/* Summary */}
        {event.details && (
          <div className="mt-1">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {typeof event.details === 'string' ? event.details : (event.details.message || event.details.summary || 'Details')}
            </button>
            {expanded && (
              <pre className="mt-1 text-xs font-mono bg-zinc-900/60 rounded p-2 overflow-x-auto max-h-48 text-muted-foreground">
                {JSON.stringify(event.details, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Order Trace View ─────────────────────────────
function OrderTraceView({ traceId, events }: { traceId: string; events: AuditEvent[] }) {
  const filtered = events.filter(
    e => e.trade_group_id === traceId || e.order_id === traceId
  );

  if (filtered.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-6">
        No events found for <span className="font-mono">{traceId}</span>
      </div>
    );
  }

  // Group by lifecycle stage
  const stages = [
    { key: 'order_intent', label: 'Intent', icon: '📋' },
    { key: 'broker_order', label: 'Broker Order', icon: '🏦' },
    { key: 'fill', label: 'Fills', icon: '💰' },
    { key: 'reconcile', label: 'Reconcile', icon: '🔄' },
  ];

  return (
    <Card className="border-zinc-800 bg-zinc-900/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Search className="h-4 w-4" />
          Order Trace: <span className="font-mono text-blue-400">{traceId}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stages.map(stage => {
            const stageEvents = filtered.filter(e => e.event_type === stage.key);
            if (stageEvents.length === 0) return null;
            return (
              <div key={stage.key}>
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-1">
                  <span>{stage.icon}</span> {stage.label} ({stageEvents.length})
                </div>
                {stageEvents.map(evt => (
                  <div key={evt.id} className="ml-6 mb-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground">{formatTs(evt.timestamp)}</span>
                      {evt.details && (
                        <span className="text-foreground truncate">
                          {typeof evt.details === 'string' ? evt.details : (evt.details.message || evt.details.summary || JSON.stringify(evt.details).slice(0, 80))}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
          {/* Any other event types */}
          {filtered.filter(e => !stages.some(s => s.key === e.event_type)).length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">Other Events</div>
              {filtered.filter(e => !stages.some(s => s.key === e.event_type)).map(evt => (
                <div key={evt.id} className="ml-6 mb-1 text-xs">
                  <span className="font-mono text-muted-foreground">{formatTs(evt.timestamp)}</span>{' '}
                  <Badge variant="secondary" className="text-xs">{evt.event_type}</Badge>{' '}
                  {evt.details && (typeof evt.details === 'string' ? evt.details : (evt.details.message || ''))}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Panel ───────────────────────────────────
export function AuditTrailPanel() {
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchId, setSearchId] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [typeFilters, setTypeFilters] = useState<Set<string>>(new Set(Object.keys(EVENT_TYPES)));
  const [traceId, setTraceId] = useState<string | null>(null);

  const loadData = useCallback(async (append = false) => {
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const [info, trail] = await Promise.all([
        auditService.getRunInfo(),
        auditService.getTrail({
          tradeGroupId: activeSearch || undefined,
          limit: PAGE_SIZE,
        }),
      ]);

      setRunInfo(info);
      setEvents(prev => append ? [...prev, ...trail] : trail);
    } catch (err: any) {
      setError(err.message || 'Failed to load audit data');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [activeSearch]);

  useEffect(() => {
    loadData();
    const iv = setInterval(() => loadData(), REFRESH_MS);
    return () => clearInterval(iv);
  }, [loadData]);

  const handleSearch = () => {
    setActiveSearch(searchId.trim());
    setTraceId(null);
  };

  const handleTraceClick = (id: string) => {
    setTraceId(id);
  };

  const toggleTypeFilter = (type: string) => {
    setTypeFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const filteredEvents = events.filter(e => typeFilters.has(e.event_type));

  return (
    <Card className="border-zinc-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Audit Trail & Run Info
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => loadData()} disabled={loading}>
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

        {/* Run Info */}
        <RunInfoHeader info={runInfo} />

        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by trade_group_id or order_id…"
                value={searchId}
                onChange={e => setSearchId(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="pl-9 bg-zinc-900/60 border-zinc-700 font-mono text-sm"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={handleSearch}>
              Search
            </Button>
            {activeSearch && (
              <Button variant="ghost" size="sm" onClick={() => { setSearchId(''); setActiveSearch(''); setTraceId(null); }}>
                Clear
              </Button>
            )}
          </div>

          {/* Type filter chips */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
            {Object.entries(EVENT_TYPES).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => toggleTypeFilter(key)}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  typeFilters.has(key)
                    ? 'border-zinc-600 bg-zinc-800 text-foreground'
                    : 'border-zinc-800 bg-transparent text-muted-foreground opacity-50'
                }`}
              >
                <span>{meta.icon}</span> {meta.label}
              </button>
            ))}
          </div>
        </div>

        {/* Order Trace View */}
        {traceId && <OrderTraceView traceId={traceId} events={events} />}

        {/* Timeline */}
        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            No audit events found{activeSearch ? ` for "${activeSearch}"` : ''}.
          </div>
        ) : (
          <div className="space-y-0">
            {filteredEvents.map(event => (
              <TimelineEvent key={event.id} event={event} onTraceClick={handleTraceClick} />
            ))}
          </div>
        )}

        {/* Load More */}
        {filteredEvents.length >= PAGE_SIZE && (
          <div className="text-center pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => loadData(true)}
              disabled={loadingMore}
            >
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load More
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
