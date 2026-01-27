'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Brain, 
  RefreshCw, 
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Settings,
  TrendingUp,
  Gauge,
  ShieldCheck
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://tlilzsovehqryoyywean.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRsaWx6c292ZWhxcnlveXl3ZWFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3MjEwOTQsImV4cCI6MjA4MzI5NzA5NH0.H9ke0r2KVKr0EVkk7xADf-tqkQPqpq1EJX5WP5ndEwo';
const supabase = createClient(supabaseUrl, supabaseKey);

// API base URL
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

interface MCPConfig {
  enabled: boolean;
  min_iv_rank: number;
  skip_low_vol: boolean;
  regime?: {
    type: string;
    vix: number;
    description: string;
  };
}

export function MCPPanel() {
  const [signals, setSignals] = useState<MCPSignal[]>([]);
  const [stats, setStats] = useState<MCPStats | null>(null);
  const [config, setConfig] = useState<MCPConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Local state for editing
  const [editEnabled, setEditEnabled] = useState(false);
  const [editMinIVRank, setEditMinIVRank] = useState(25);
  const [editSkipLowVol, setEditSkipLowVol] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/api/mcp/status`);
      const data = await response.json();
      if (data.success) {
        setConfig(data.data);
        setEditEnabled(data.data.enabled);
        setEditMinIVRank(data.data.min_iv_rank || 25);
        setEditSkipLowVol(data.data.skip_low_vol ?? true);
      }
    } catch (err) {
      console.error('Error fetching MCP config:', err);
    }
  }, []);

  const saveConfig = async () => {
    setIsSaving(true);
    try {
      const params = new URLSearchParams();
      params.append('enabled', editEnabled.toString());
      params.append('min_iv_rank', editMinIVRank.toString());
      params.append('skip_low_vol', editSkipLowVol.toString());
      
      const response = await fetch(`${API_BASE}/api/mcp/configure?${params.toString()}`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        setConfig(data.data);
        setShowSettings(false);
      } else {
        setError(data.error || 'Failed to save config');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchSignals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Fetch recent signals from Supabase
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
      // Calculate avg score from all signals that have a composite_score
      const signalsWithScore = recentSignals.filter(s => s.composite_score !== null && s.composite_score !== undefined);
      const avgScore = signalsWithScore.length > 0 
        ? signalsWithScore.reduce((sum, s) => sum + (s.composite_score || 0), 0) / signalsWithScore.length
        : 0;
      
      setStats({
        signals_24h: recentSignals.length,
        opportunities_24h: opportunities.length,
        trades_24h: trades.length,
        avg_score_24h: avgScore,
        last_signal_at: signalsData?.[0]?.created_at || ''
      });
      
    } catch (err) {
      console.error('Error fetching MCP data:', err);
      // Don't set error for signals - config might still work
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
    fetchSignals();
    
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
    
    // Refresh config every 30 seconds
    const interval = setInterval(() => {
      fetchConfig();
      fetchSignals();
    }, 30000);
    
    return () => {
      channel.unsubscribe();
      clearInterval(interval);
    };
  }, [fetchConfig, fetchSignals]);

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
      'LOW_VOL': 'bg-green-100 text-green-800',
      'normal': 'bg-blue-100 text-blue-800',
      'NORMAL': 'bg-blue-100 text-blue-800',
      'elevated': 'bg-yellow-100 text-yellow-800',
      'ELEVATED': 'bg-yellow-100 text-yellow-800',
      'crisis': 'bg-red-100 text-red-800',
      'CRISIS': 'bg-red-100 text-red-800',
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

  return (
    <div className="space-y-4">
      {/* MCP Control Panel */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                MCP Intelligence
              </CardTitle>
              <CardDescription>
                Market regime detection, IV analysis, and smart entry gating
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={config?.enabled ? "default" : "secondary"}>
                {config?.enabled ? "ENABLED" : "DISABLED"}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        
        {showSettings && (
          <CardContent className="border-t pt-4">
            <div className="space-y-6">
              {/* Master Enable/Disable */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="mcp-enabled" className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    MCP Intelligence Gate
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    When enabled, all entries must pass MCP checks
                  </p>
                </div>
                <Switch
                  id="mcp-enabled"
                  checked={editEnabled}
                  onCheckedChange={setEditEnabled}
                />
              </div>
              
              <Separator />
              
              {/* Min IV Rank */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="flex items-center gap-2">
                    <Gauge className="h-4 w-4" />
                    Minimum IV Rank
                  </Label>
                  <span className="font-mono text-sm font-bold">{editMinIVRank}%</span>
                </div>
                <Slider
                  value={[editMinIVRank]}
                  onValueChange={([v]) => setEditMinIVRank(v)}
                  min={0}
                  max={100}
                  step={5}
                  disabled={!editEnabled}
                  className="w-full"
                />
                <p className="text-sm text-muted-foreground">
                  Skip entries when IV rank is below this threshold (premium selling less favorable)
                </p>
              </div>
              
              <Separator />
              
              {/* Skip Low Vol */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="skip-low-vol" className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Skip Low Volatility Regime
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Block entries when VIX &lt; 15 (premiums too compressed)
                  </p>
                </div>
                <Switch
                  id="skip-low-vol"
                  checked={editSkipLowVol}
                  onCheckedChange={setEditSkipLowVol}
                  disabled={!editEnabled}
                />
              </div>
              
              <Separator />
              
              {/* Save Button */}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowSettings(false)}>
                  Cancel
                </Button>
                <Button onClick={saveConfig} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        )}
        
        {/* Current Regime Status */}
        {config?.regime && (
          <CardContent className={showSettings ? '' : 'pt-0'}>
            <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm text-muted-foreground">Current Regime</p>
                <div className="flex items-center gap-2 mt-1">
                  {getRegimeBadge(config.regime.type)}
                  <span className="text-sm">VIX: {config.regime.vix?.toFixed(1)}</span>
                </div>
              </div>
              {config.regime.description && (
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{config.regime.description}</p>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

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
            <CardTitle className="text-base">Activity Feed</CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchSignals} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {signals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No MCP signals yet</p>
              <p className="text-sm mt-2">
                Signals will appear here when the daemon scans for opportunities.
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {signals.filter(s => s.signal_type !== 'scan').slice(0, 20).map((signal) => (
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
                      {getRegimeBadge(signal.market_regime)}
                    </div>
                    
                    {(signal.composite_score !== null || signal.iv_rank !== null || signal.trend || signal.rsi_14 !== null) && (
                      <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {signal.trend && (
                          <div>
                            <span className="text-muted-foreground">Trend:</span>{' '}
                            <span className={`font-medium ${
                              signal.trend === 'bullish' ? 'text-green-600' : 
                              signal.trend === 'bearish' ? 'text-red-600' : ''
                            }`}>{signal.trend}</span>
                          </div>
                        )}
                        {signal.composite_score !== null && signal.composite_score !== undefined && (
                          <div>
                            <span className="text-muted-foreground">Score:</span>{' '}
                            <span className={`font-medium ${
                              signal.composite_score > 0 ? 'text-green-600' : 
                              signal.composite_score < 0 ? 'text-red-600' : ''
                            }`}>{signal.composite_score > 0 ? '+' : ''}{signal.composite_score.toFixed(2)}</span>
                          </div>
                        )}
                        {signal.iv_rank !== null && signal.iv_rank !== undefined && (
                          <div>
                            <span className="text-muted-foreground">IV Rank:</span>{' '}
                            <span className="font-medium">{signal.iv_rank.toFixed(0)}%</span>
                          </div>
                        )}
                        {signal.rsi_14 !== null && signal.rsi_14 !== undefined && (
                          <div>
                            <span className="text-muted-foreground">RSI:</span>{' '}
                            <span className={`font-medium ${
                              signal.rsi_14 < 30 ? 'text-green-600' : 
                              signal.rsi_14 > 70 ? 'text-red-600' : ''
                            }`}>{signal.rsi_14.toFixed(0)}</span>
                          </div>
                        )}
                        {signal.credit && (
                          <div>
                            <span className="text-muted-foreground">Credit:</span>{' '}
                            <span className="font-medium text-green-600">${signal.credit.toFixed(2)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {signal.signal_type === 'skip' && signal.action_result && (
                      <p className="text-sm text-muted-foreground mt-1">{signal.action_result}</p>
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
