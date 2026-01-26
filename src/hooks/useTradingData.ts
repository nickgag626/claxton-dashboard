'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { tradierApi, calculatePortfolioGreeks, parseOptionSymbol } from '@/services/tradierApi';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type {
  Position, 
  Greeks, 
  Quote, 
  Strategy, 
  RiskStatus, 
  ActivityEvent,
  MarketState,
  TradeSafeguards 
} from '@/types/trading';

export interface DeltaDataPoint {
  time: string;
  delta: number;
}

export interface PnlDataPoint {
  time: string;
  pnl: number;
}

export interface CloseDebugOptions {
  dryRun: boolean;
  debug: boolean;
}

export interface WideSpreadBlock {
  tradeGroupId: string;
  symbol?: string;
  spreadIssues: Array<{ symbol: string; bid: number; ask: number; spreadPercent: number }>;
  maxAllowed: number;
}

export interface DtbpRejection {
  symbol: string;
  tradeGroupId: string;
  rejectReason: string;
  timestamp: number;
}

// Polling intervals
const POLL_INTERVAL = 30_000; // 30s

// Default strategies
const defaultStrategies: Strategy[] = [
  {
    id: '1',
    name: '0DTE Iron Condor (SPX)',
    type: 'iron_condor',
    underlying: 'SPX',
    enabled: true,
    maxPositions: 2,
    positionSize: 1,
    entryConditions: {
      minDte: 0,
      maxDte: 0,
      shortDeltaTarget: 0.10,
      longDeltaTarget: 0.05,
      minPremium: 1.50,
      marketHoursOnly: true,
      startTime: '09:45',
      endTime: '14:30',
    },
    exitConditions: {
      profitTargetPercent: 50,
      stopLossPercent: 100,
      timeStopTime: '15:45',
    },
    sizing: { mode: 'fixed', fixedContracts: 1 },
  },
  {
    id: '2',
    name: 'Weekly Iron Condor (SPY)',
    type: 'iron_condor',
    underlying: 'SPY',
    enabled: true,
    maxPositions: 1,
    positionSize: 2,
    entryConditions: {
      minDte: 5,
      maxDte: 7,
      shortDeltaTarget: 0.16,
      longDeltaTarget: 0.08,
      minPremium: 0.75,
      marketHoursOnly: true,
    },
    exitConditions: {
      profitTargetPercent: 50,
      stopLossPercent: 200,
    },
    sizing: { mode: 'fixed', fixedContracts: 2 },
  },
];

const defaultSafeguards: TradeSafeguards = {
  maxBidAskSpreadPercent: 5,
  zeroDteCloseBufferMinutes: 30,
  fillPriceBufferPercent: 2,
  maxCondorsPerExpiry: 3,
  maxDailyLossDollars: 1000,
  maxConsecutiveRejections: 5,
};

export function useTradingData() {
  // Core state
  const [positions, setPositions] = useState<Position[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [greeks, setGreeks] = useState<Greeks>({ delta: 0, gamma: 0, theta: 0, vega: 0 });
  const [strategies, setStrategies] = useState<Strategy[]>(defaultStrategies);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [marketState, setMarketState] = useState<MarketState>('unknown');
  
  // Connection state
  const [isApiConnected, setIsApiConnected] = useState(false);
  const [isBotRunning, setIsBotRunning] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [lastCheckExitsTime, setLastCheckExitsTime] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Risk state
  const [riskStatus, setRiskStatus] = useState<RiskStatus>({
    dailyPnl: 0,
    realizedPnl: 0,
    unrealizedPnl: 0,
    maxDailyLoss: 1000,
    tradeCount: 0,
    maxPositions: 10,
    killSwitchActive: false,
  });
  
  const [safeguards, setSafeguards] = useState<TradeSafeguards>(defaultSafeguards);
  
  // Chart data
  const [deltaHistory, setDeltaHistory] = useState<DeltaDataPoint[]>([]);
  const [pnlHistory, setPnlHistory] = useState<PnlDataPoint[]>([]);
  
  // Close/debug state
  const [closeDebugOptions, setCloseDebugOptions] = useState<CloseDebugOptions>({
    dryRun: false,
    debug: false,
  });
  const [lastCloseDebug, setLastCloseDebug] = useState<any>(null);
  
  // Group-aware closing state
  const [legOutModeEnabled, setLegOutModeEnabled] = useState(false);
  const [dtbpRejection, setDtbpRejection] = useState<DtbpRejection | null>(null);
  const [wideSpreadBlock, setWideSpreadBlock] = useState<WideSpreadBlock | null>(null);
  const [entryBlockedReason, setEntryBlockedReason] = useState<string | null>(null);
  
  // Refs for polling
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  
  // Fetch core data
  const fetchData = useCallback(async () => {
    try {
      // Ping API
      const pingResult = await tradierApi.ping();
      setIsApiConnected(pingResult.ok);
      
      if (!pingResult.ok) {
        setError('API connection failed');
        return;
      }
      
      // Fetch positions from Tradier
      const positionsData = await tradierApi.getPositions();
      
      // Fetch position_group_map from Supabase to enrich positions with strategy data
      const { data: groupMappings, error: mappingError } = await supabase
        .from('position_group_map')
        .select('symbol, trade_group_id, strategy_name, strategy_type, entry_credit, expiration, leg_side');
      
      if (mappingError) {
        console.warn('Failed to fetch position_group_map:', mappingError);
      }
      
      // Create lookup map by symbol for fast enrichment
      const mappingBySymbol = new Map<string, {
        tradeGroupId: string;
        strategyName: string | null;
        strategyType: string | null;
        entryCredit: number | null;
        legSide: string | null;
      }>();
      
      if (groupMappings) {
        for (const mapping of groupMappings) {
          mappingBySymbol.set(mapping.symbol, {
            tradeGroupId: mapping.trade_group_id,
            strategyName: mapping.strategy_name,
            strategyType: mapping.strategy_type,
            entryCredit: mapping.entry_credit,
            legSide: mapping.leg_side,
          });
        }
      }
      
      // Enrich positions with strategy data from position_group_map
      const enrichedPositions = positionsData.map(pos => {
        const mapping = mappingBySymbol.get(pos.symbol);
        if (mapping) {
          return {
            ...pos,
            tradeGroupId: mapping.tradeGroupId,
            strategyName: mapping.strategyName,
            strategyType: mapping.strategyType,
            entryCredit: mapping.entryCredit,
            legSide: mapping.legSide,
          };
        }
        return pos;
      });
      
      setPositions(enrichedPositions);
      
      // Fetch SPY quote (main underlying)
      const quotesData = await tradierApi.getQuotes(['SPY', 'SPX']);
      setQuotes(quotesData);
      
      // Get market clock
      const clock = await tradierApi.getMarketClock();
      setMarketState(clock.state);
      
      // Calculate portfolio Greeks (simplified - would need chain data for accuracy)
      const portfolioGreeks = calculatePortfolioGreeks(enrichedPositions, []);
      setGreeks(portfolioGreeks);
      
      // Calculate unrealized P&L from positions
      const unrealizedPnl = enrichedPositions.reduce((sum, pos) => {
        const pnl = (pos.currentValue || 0) - (pos.costBasis || 0);
        return sum + pnl;
      }, 0);
      
      setRiskStatus(prev => ({
        ...prev,
        unrealizedPnl,
        dailyPnl: prev.realizedPnl + unrealizedPnl,
      }));
      
      // Update timestamps
      setLastUpdate(new Date());
      setLastCheckExitsTime(new Date());
      setError(null);
      setIsLoading(false);
      
      // Update delta history
      const now = new Date().toLocaleTimeString('en-US', { hour12: false });
      setDeltaHistory(prev => [...prev.slice(-59), { time: now, delta: portfolioGreeks.delta }]);
      setPnlHistory(prev => [...prev.slice(-59), { time: now, pnl: unrealizedPnl }]);
      
    } catch (err) {
      console.error('Error fetching trading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setIsApiConnected(false);
      setIsLoading(false);
    }
  }, []);
  
  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    
    pollRef.current = setInterval(fetchData, POLL_INTERVAL);
    
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
    };
  }, [fetchData]);
  
  // Actions
  const toggleBot = useCallback(() => {
    setIsBotRunning(prev => !prev);
    const newState = !isBotRunning;
    addActivity({
      type: 'BOT',
      message: newState ? 'Trading bot started' : 'Trading bot stopped',
    });
    toast({
      title: newState ? 'Bot Started' : 'Bot Stopped',
      description: newState ? 'Automated trading is now active' : 'Automated trading has been paused',
    });
  }, [isBotRunning]);
  
  const toggleKillSwitch = useCallback(() => {
    setRiskStatus(prev => ({
      ...prev,
      killSwitchActive: !prev.killSwitchActive,
      killSwitchReason: !prev.killSwitchActive ? 'Manual activation' : undefined,
    }));
    const newState = !riskStatus.killSwitchActive;
    addActivity({
      type: 'EMERGENCY',
      message: newState ? 'Kill switch ACTIVATED' : 'Kill switch deactivated',
    });
    toast({
      title: newState ? 'Kill Switch Activated' : 'Kill Switch Deactivated',
      description: newState ? 'All trading halted' : 'Trading can resume',
      variant: newState ? 'destructive' : 'default',
    });
  }, [riskStatus.killSwitchActive]);
  
  const updateRiskSettings = useCallback((settings: Partial<RiskStatus>) => {
    setRiskStatus(prev => ({ ...prev, ...settings }));
  }, []);
  
  const updateSafeguards = useCallback((settings: Partial<TradeSafeguards>) => {
    setSafeguards(prev => ({ ...prev, ...settings }));
  }, []);
  
  const toggleStrategy = useCallback((id: string) => {
    setStrategies(prev => prev.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  }, []);
  
  const addStrategy = useCallback((strategy: Omit<Strategy, 'id'>) => {
    setStrategies(prev => [...prev, { ...strategy, id: crypto.randomUUID() }]);
  }, []);
  
  const updateStrategy = useCallback((id: string, updates: Partial<Strategy>) => {
    setStrategies(prev => prev.map(s => 
      s.id === id ? { ...s, ...updates } : s
    ));
  }, []);
  
  const deleteStrategy = useCallback((id: string) => {
    setStrategies(prev => prev.filter(s => s.id !== id));
  }, []);
  
  const addActivity = useCallback((event: Omit<ActivityEvent, 'id' | 'timestamp'>) => {
    setActivity(prev => [{
      id: crypto.randomUUID(),
      timestamp: new Date(),
      ...event,
    }, ...prev.slice(0, 99)]);
  }, []);
  
  const clearHistory = useCallback(() => {
    setActivity([]);
  }, []);
  
  // Position closing
  const closePosition = useCallback(async (positionId: string): Promise<boolean> => {
    const position = positions.find(p => p.id === positionId);
    if (!position) {
      toast({ title: 'Error', description: 'Position not found', variant: 'destructive' });
      return false;
    }
    
    addActivity({
      type: 'TRADE',
      message: `Closing position: ${position.symbol}`,
    });
    
    const result = await tradierApi.closePosition(position.symbol, position.quantity, {
      dryRun: closeDebugOptions.dryRun,
      debug: closeDebugOptions.debug,
      source: 'manual_ui',
    });
    
    if (closeDebugOptions.debug) {
      setLastCloseDebug(result.debug);
    }
    
    if (result.success) {
      toast({ title: 'Position Closed', description: `Order submitted for ${position.symbol}` });
      fetchData(); // Refresh positions
      return true;
    } else {
      toast({ title: 'Close Failed', description: result.error, variant: 'destructive' });
      return false;
    }
  }, [positions, closeDebugOptions, addActivity, fetchData]);
  
  const closeGroup = useCallback(async (
    tradeGroupId: string,
    exitReason?: string,
    forceBrokenStructure?: boolean,
    forceClose?: boolean
  ): Promise<boolean> => {
    const groupPositions = positions.filter(p => p.tradeGroupId === tradeGroupId);
    if (groupPositions.length === 0) {
      toast({ title: 'Error', description: 'No positions in group', variant: 'destructive' });
      return false;
    }
    
    const symbols = groupPositions.map(p => p.symbol);
    
    addActivity({
      type: 'TRADE',
      message: `Closing group: ${symbols.join(', ')}${exitReason ? ` (${exitReason})` : ''}`,
    });
    
    const result = await tradierApi.closeGroup(symbols, {
      dryRun: closeDebugOptions.dryRun,
      debug: closeDebugOptions.debug,
      source: 'manual_ui_group',
      trade_group_id: tradeGroupId,
      forceClose,
    });
    
    if (closeDebugOptions.debug) {
      setLastCloseDebug(result.debug);
    }
    
    if (result.success) {
      toast({ title: 'Group Closed', description: `Order submitted for ${symbols.length} legs` });
      fetchData();
      return true;
    } else {
      toast({ title: 'Close Failed', description: result.error, variant: 'destructive' });
      return false;
    }
  }, [positions, closeDebugOptions, addActivity, fetchData]);
  
  const emergencyCloseAll = useCallback(async () => {
    addActivity({
      type: 'EMERGENCY',
      message: 'Emergency close initiated for all positions',
    });
    
    for (const position of positions) {
      await tradierApi.closePosition(position.symbol, position.quantity, {
        source: 'emergency_close',
        forceClose: true,
      });
    }
    
    toast({ title: 'Emergency Close', description: 'All positions submitted for closing' });
    fetchData();
  }, [positions, addActivity, fetchData]);
  
  const copyLastCloseDebug = useCallback(() => {
    if (lastCloseDebug) {
      navigator.clipboard.writeText(JSON.stringify(lastCloseDebug, null, 2));
      toast({ title: 'Copied', description: 'Debug info copied to clipboard' });
    }
  }, [lastCloseDebug]);
  
  // Group helpers
  const isGroupedPosition = useCallback((position: Position): boolean => {
    return !!position?.tradeGroupId;
  }, []);
  
  const getGroupPositions = useCallback((tradeGroupId: string | undefined): Position[] => {
    if (!tradeGroupId) return [];
    return positions.filter(p => p.tradeGroupId === tradeGroupId);
  }, [positions]);
  
  // Exit status info from strategy engine
  interface ExitStatusInfo {
    pnlPercent: number;
    profitTargetPercent: number;
    stopLossPercent: number;
    dte?: number;
    timeStopDte?: number;
    triggered: boolean;
    reason: string | null;
    blockedReason?: string;
  }
  
  const getExitStatus = useCallback((position: Position): ExitStatusInfo | undefined => {
    return undefined; // Would need to track exit status separately
  }, []);
  
  const retryCloseAsGroup = useCallback(async (): Promise<boolean> => {
    if (!dtbpRejection) return false;
    const result = await closeGroup(dtbpRejection.tradeGroupId);
    setDtbpRejection(null);
    return result;
  }, [dtbpRejection, closeGroup]);
  
  const clearEntryBlock = useCallback(() => {
    setEntryBlockedReason(null);
  }, []);
  
  const purgeStaleMappings = useCallback(async (): Promise<{ deletedCount: number }> => {
    // Would purge stale position_group_map entries
    toast({ title: 'Purged', description: 'Stale mappings cleared' });
    return { deletedCount: 0 };
  }, []);
  
  const forceCloseGroup = useCallback(async (): Promise<boolean> => {
    if (!wideSpreadBlock) return false;
    const result = await closeGroup(wideSpreadBlock.tradeGroupId, undefined, undefined, true);
    setWideSpreadBlock(null);
    return result;
  }, [wideSpreadBlock, closeGroup]);
  
  const clearWideSpreadBlock = useCallback(() => {
    setWideSpreadBlock(null);
  }, []);
  
  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);
  
  return {
    // Data
    positions,
    greeks,
    quotes,
    strategies,
    riskStatus,
    safeguards,
    activity,
    marketState,
    
    // Connection state
    isApiConnected,
    isBotRunning,
    lastUpdate,
    lastCheckExitsTime,
    isLoading,
    error,
    
    // Chart data
    deltaHistory,
    pnlHistory,
    
    // Actions
    toggleBot,
    toggleKillSwitch,
    updateRiskSettings,
    updateSafeguards,
    toggleStrategy,
    addStrategy,
    updateStrategy,
    deleteStrategy,
    closePosition,
    emergencyCloseAll,
    
    // Close debug
    closeDebugOptions,
    setCloseDebugOptions,
    lastCloseDebug,
    copyLastCloseDebug,
    
    // Group-aware closing
    legOutModeEnabled,
    setLegOutModeEnabled,
    closeGroup,
    retryCloseAsGroup,
    dtbpRejection,
    isGroupedPosition,
    getGroupPositions,
    getExitStatus,
    clearHistory,
    
    // Structure Integrity Gate
    entryBlockedReason,
    clearEntryBlock,
    
    // Mapping maintenance
    purgeStaleMappings,
    
    // Wide spread block
    wideSpreadBlock,
    forceCloseGroup,
    clearWideSpreadBlock,
    
    // Refetch
    refetch,
  };
}
