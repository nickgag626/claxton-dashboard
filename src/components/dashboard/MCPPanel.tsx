'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Brain, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tlilzsovehqryoyywean.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsaWx6c292ZWhxcnlveXl3ZWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MjEwOTQsImV4cCI6MjA4MzI5NzA5NH0.H9ke0r2KVKr0EVkk7xADf-tqkQPqpq1EJX5WP5ndEwo';
const supabase = createClient(supabaseUrl, supabaseKey);

interface MCPSignal {
  id: string;
  created_at: string;
  symbol: string;
  signal_type: string;
  composite_score?: number;
  iv_rank?: number;
  rsi_14?: number;
  trend?: string;
  strategy?: string;
  expiration?: string;
  short_strike?: number;
  long_strike?: number;
  credit?: number;
  max_loss?: number;
  prob_profit?: number;
  risk_reward?: number;
  vix?: number;
  market_regime?: string;
  acted_on: boolean;
  action_result?: string;
  details?: Record<string, unknown>;
}

interface MCPStats {
  signals_24h: number;
  opportunities_24h: number;
  trades_24h: number;
  avg_score_24h: number;
  last_signal_at: string;
}

export function MCPPanel() {
  const [signals, setSignals] = useState<MCPSignal[]>([]);
  const [stats, setStats] = useState<MCPStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch recent signals
      const { data: signalsData, error: signalsError } = await supabase
        .from('mcp_signals')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (signalsError) throw signalsError;
      setSignals(signalsData || []);
      
      // Calculate stats
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentSignals = (signalsData || []).filter(
        s => new Date(s.created_at) > oneDayAgo
      );
      
      const opportunities = recentSignals.filter(s => s.signal_type === 'opportunity');
      const trades = recentSignals.filter(s => s.signal_type === 'trade_entry');
      const avgScore = opportunities.length > 0 
        ? opportunities.reduce((sum, s) => sum + (s.composite_score || 0), 0) / opportunities.length
        : 0;
      
      setStats({
        signals_24h: recentSignals.length,
        opportunities_24h: opportunities.length,
        trades_24h: trades.length,
        avg_score_24h: avgScore,
        last_signal_at: signalsData?.[0]?.created_at || ''
      });
      
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching MCP data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch MCP data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    // Subscribe to realtime updates
    const channel = supabase
      .channel('mcp_signals_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'mcp_signals' },
        (payload) => {
          setSignals(prev => [payload.new as MCPSignal, ...prev.slice(0, 49)]);
        }
      )
      .subscribe();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    
    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [fetchData]);

  const getSignalIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return <Zap className="h-4 w-4 text-yellow-500" />;
      case 'trade_entry': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'trade_exit': return <XCircle className="h-4 w-4 text-blue-500" />;
      case 'skip': return <XCircle className="h-4 w-4 text-gray-400" />;
      case 'scan': return <Activity className="h-4 w-4 text-gray-500" />;
      case 'regime_change': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getRegimeBadge = (regime: string | undefined) => {
    if (!regime) return null;
    const colors: Record<string, string> = {
      'low_vol': 'bg-green-100 text-green-800',
      'normal': 'bg-blue-100 text-blue-800',
      'elevated': 'bg-yellow-100 text-yellow-800',
      'crisis': 'bg-red-100 text-red-800'
    };
    return (
      <Badge variant="outline" className={colors[regime] || ''}>
        {regime.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            MCP Smart Engine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <p className="font-medium">Unable to load MCP data</p>
            <p className="text-sm mt-2">{error}</p>
            <p className="text-sm mt-4">
              Make sure the <code className="bg-muted px-1 rounded">mcp_signals</code> table exists in Supabase.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.signals_24h || 0}</div>
            <p className="text-xs text-muted-foreground">Scans (24h)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{stats?.opportunities_24h || 0}</div>
            <p className="text-xs text-muted-foreground">Opportunities</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats?.trades_24h || 0}</div>
            <p className="text-xs text-muted-foreground">Trades Taken</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{stats?.avg_score_24h?.toFixed(1) || '-'}</div>
            <p className="text-xs text-muted-foreground">Avg Score</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">
              {stats?.last_signal_at ? formatTimeAgo(stats.last_signal_at) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">Last Signal</p>
          </CardContent>
        </Card>
      </div>

      {/* Signals Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                MCP Smart Engine Activity
              </CardTitle>
              <CardDescription>
                Real-time signals from IV rank, RSI, trend analysis, and market regime detection
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No MCP signals yet</p>
              <p className="text-sm mt-2">
                The MCP daemon will log signals here when it scans for opportunities.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {signals.filter(s => s.signal_type !== 'scan').map((signal) => (
                <div 
                  key={signal.id} 
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    signal.signal_type === 'opportunity' ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20' :
                    signal.signal_type === 'trade_entry' ? 'bg-green-50 border-green-200 dark:bg-green-950/20' :
                    signal.signal_type === 'skip' ? 'bg-gray-50 border-gray-200 dark:bg-gray-950/20' :
                    'bg-background'
                  }`}
                >
                  <div className="mt-0.5">
                    {getSignalIcon(signal.signal_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{signal.symbol}</span>
                      <Badge variant="outline" className="text-xs">
                        {signal.signal_type.replace('_', ' ')}
                      </Badge>
                      {signal.strategy && (
                        <Badge variant="secondary" className="text-xs">
                          {signal.strategy.replace('_', ' ')}
                        </Badge>
                      )}
                      {getRegimeBadge(signal.market_regime)}
                    </div>
                    
                    {/* Opportunity details */}
                    {signal.signal_type === 'opportunity' && (
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {signal.composite_score && (
                          <div>
                            <span className="text-muted-foreground">Score:</span>{' '}
                            <span className="font-medium">{signal.composite_score.toFixed(1)}</span>
                          </div>
                        )}
                        {signal.iv_rank && (
                          <div>
                            <span className="text-muted-foreground">IV Rank:</span>{' '}
                            <span className="font-medium">{signal.iv_rank.toFixed(0)}%</span>
                          </div>
                        )}
                        {signal.prob_profit && (
                          <div>
                            <span className="text-muted-foreground">PoP:</span>{' '}
                            <span className="font-medium">{signal.prob_profit.toFixed(0)}%</span>
                          </div>
                        )}
                        {signal.credit && (
                          <div>
                            <span className="text-muted-foreground">Credit:</span>{' '}
                            <span className="font-medium text-green-600">${signal.credit.toFixed(2)}</span>
                          </div>
                        )}
                        {signal.short_strike && signal.long_strike && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Strikes:</span>{' '}
                            <span className="font-medium">{signal.long_strike}/{signal.short_strike}</span>
                            {signal.expiration && (
                              <span className="text-muted-foreground ml-2">exp {signal.expiration}</span>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Skip reason */}
                    {signal.signal_type === 'skip' && signal.action_result && (
                      <p className="text-sm text-muted-foreground mt-1">{signal.action_result}</p>
                    )}
                    
                    {/* Trade result */}
                    {signal.signal_type === 'trade_entry' && (
                      <p className="text-sm text-green-600 mt-1">
                        ✓ Trade executed: {signal.credit && `$${signal.credit.toFixed(2)} credit`}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {formatTime(signal.created_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
