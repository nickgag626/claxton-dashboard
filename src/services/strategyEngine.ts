import { supabase } from '@/integrations/supabase/client';
import { API_BASE } from '@/services/apiBase';
import type { Strategy, Position } from '@/types/trading';

export interface TradeSignal {
  strategyName: string;
  type: string;
  underlying: string;
  expiration: string;
  credit: number;
  legs: {
    symbol: string;
    side: string;
    quantity: number;
  }[];
}

export interface ExitSignal {
  positionId: string;
  symbol: string;
  quantity: number;
  reason: 'profit_target' | 'stop_loss' | 'time_stop';
  pnlPercent?: number;
  dte?: number;
}

// Exit status for ALL positions (shows why positions didn't trigger exit)
export interface ExitStatus {
  tradeGroupId: string | null;
  symbol: string;
  strategyName: string;
  pnlPercent: number;
  profitTargetPercent: number;
  stopLossPercent: number;
  dte?: number;
  timeStopDte?: number;
  triggered: boolean;
  reason: string | null;
  blockedReason?: string;
}

export interface VerifyFillParams {
  orderId: string;
  expectedLegs: { symbol: string; quantity: number; side: string }[];
  tradeGroupId: string;
  strategyName: string;
  strategyType: string;
  underlying: string;
  expiration?: string;
}

export interface VerifyFillResult {
  verified: boolean;
  filledLegs?: string[];
  missingLegs?: string[];
  critical?: boolean;
  orderStatus?: string;
  mappingPersisted?: boolean;
  message?: string;
}

export interface StructureIntegrityResult {
  healthy: boolean;
  brokenGroups: { groupId: string; expected: number; observed: number; strategyType: string }[];
  orphanSymbols: string[];
  reason: string;
}

export interface StrategyEngineError {
  error: true;
  message: string;
  code?: string;
}

export const strategyEngine = {
  async evaluateStrategies(strategies: Strategy[], positions: Position[]): Promise<{
    signals: TradeSignal[];
    marketState: string;
    error?: StrategyEngineError;
  }> {
    try {
      // Convert dashboard Strategy → Python StrategyConfig
      const payloadStrategies = strategies.map((s) => ({
        id: s.id,
        name: s.name,
        underlying: s.underlying,
        enabled: s.enabled,
        min_dte: s.entryConditions?.minDte ?? 30,
        max_dte: s.entryConditions?.maxDte ?? 60,
        min_credit: s.entryConditions?.minPremium ?? 0.5,
        min_credit_percent: 10.0,
        target_delta: s.entryConditions?.shortDeltaTarget ?? 0.16,
        profit_target_percent: s.exitConditions?.profitTargetPercent ?? 50,
        stop_loss_percent: s.exitConditions?.stopLossPercent ?? 200,
        time_stop_dte: s.exitConditions?.timeStopDte ?? 7,
        max_positions: s.maxPositions ?? 3,
        max_risk_per_trade: s.sizing?.riskPerTrade ?? 500,

        // Phase 1 unified liquidity gate
        liquidity_max_spread_pct: s.entryConditions?.maxBidAskSpreadPerLegPercent ?? 15,
        liquidity_config: {
          // Map the per-strategy spread threshold onto both equity/index thresholds
          bid_ask_spread_pct_index: s.entryConditions?.maxBidAskSpreadPerLegPercent ?? 15,
          bid_ask_spread_pct_equity: s.entryConditions?.maxBidAskSpreadPerLegPercent ?? 15,
          option_volume_min: s.entryConditions?.optionVolumeMin ?? 100,
          open_interest_min: s.entryConditions?.openInterestMin ?? 500,
          max_quote_age_seconds: s.entryConditions?.maxQuoteAgeSeconds ?? 300,
          underlying_volume_min_pct_of_avg: s.entryConditions?.underlyingVolumeMinPctOfAvg ?? 50,
        },

        // Phase 1 IVR regime gate (separate from dashboard IV Rank filter)
        ivr_config: s.entryConditions?.enableIvrGate
          ? {
              short_premium_min_ivr: s.entryConditions?.ivrShortPremiumMin ?? 40,
              long_premium_max_ivr: s.entryConditions?.ivrLongPremiumMax ?? 30,
            }
          : undefined,
      }));

      const res = await fetch(`${API_BASE}/api/engine/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategies: payloadStrategies }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        const message = json?.error || `HTTP ${res.status}`;
        console.error('Error evaluating strategies:', message);
        return {
          signals: [],
          marketState: 'error',
          error: { error: true, message, code: 'EVALUATE_ERROR' },
        };
      }

      const data = json.data || {};
      const signals: TradeSignal[] = (data.signals || []).map((sig: any) => ({
        strategyName: sig.strategy_name,
        type: 'signal',
        underlying: sig.underlying,
        expiration: sig.expiration,
        credit: sig.expected_credit,
        legs: sig.legs,
      }));

      return { signals, marketState: data.market_state || 'open' };
    } catch (error) {
      console.error('Error evaluating strategies:', error);
      return {
        signals: [],
        marketState: 'error',
        error: {
          error: true,
          message: error instanceof Error ? error.message : 'Unknown error evaluating strategies',
          code: 'EVALUATE_EXCEPTION',
        },
      };
    }
  },

  async executeSignal(signal: TradeSignal & { allowEntryNetting?: boolean }): Promise<{
    success: boolean;
    orderId?: string;
    error?: string;
    blocked?: 'cooldown' | 'conflict' | 'in_flight';
    entry_conflict?: boolean;
    conflict_symbols?: string[];
    conflictDetails?: string[];
    conflicts?: Array<{
      symbol: string;
      proposedSide: string;
      existingQty: number;
      conflict: string;
      resolution: string;
    }>;
    allow_entry_netting?: boolean;
    tradeGroupId?: string;
    // Verified Entry response fields
    verified?: boolean;
    critical?: boolean;
    filledLegs?: string[];
    missingLegs?: string[];
    bailOutOrders?: Array<{
      symbol: string;
      orderId?: string;
      error?: string;
      side: string;
    }>;
    orderStatus?: string;
    mappingPersisted?: boolean;
    message?: string;
  }> {
    try {
      const res = await fetch(`${API_BASE}/api/engine/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy_name: signal.strategyName,
          underlying: signal.underlying,
          expiration: signal.expiration,
          legs: signal.legs,
          expected_credit: signal.credit,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        return { success: false, error: json?.error || `HTTP ${res.status}` };
      }

      return {
        success: true,
        orderId: String(json?.data?.order_id ?? ''),
      };
    } catch (error) {
      console.error('Error executing signal:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  },

  async checkExits(strategies: Strategy[], positions: Position[]): Promise<{
    exitSignals: ExitSignal[];
    exitStatus?: ExitStatus[];
    marketState: string;
    error?: StrategyEngineError;
  }> {
    try {
      // Backend check-exits endpoint currently does not need full payload from UI.
      const res = await fetch(`${API_BASE}/api/engine/check-exits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      const json = await res.json();
      if (!res.ok || !json?.success) {
        const message = json?.error || `HTTP ${res.status}`;
        console.error('Error checking exits:', message);
        return {
          exitSignals: [],
          marketState: 'error',
          error: { error: true, message, code: 'CHECK_EXITS_ERROR' },
        };
      }

      const data = json.data || {};
      const exitSignals: ExitSignal[] = (data.exit_signals || []).map((s: any) => ({
        positionId: String(s.position_id),
        symbol: String(s.symbol || ''),
        quantity: Number(s.quantity || 0),
        reason: (s.reason || 'profit_target') as any,
        pnlPercent: s.pnl_percent,
        dte: s.dte,
      }));

      return { exitSignals, marketState: 'open' };
    } catch (error) {
      console.error('Error checking exits:', error);
      return {
        exitSignals: [],
        marketState: 'error',
        error: {
          error: true,
          message: error instanceof Error ? error.message : 'Unknown error checking exits',
          code: 'CHECK_EXITS_EXCEPTION',
        },
      };
    }
  },

  /**
   * Verify that all legs of an order were filled before persisting to position_group_map.
   * Checks order status first (primary source of truth), then verifies positions.
   * If order status is 'filled' but positions not showing, waits extra 5 seconds.
   */
  async verifyFill(params: VerifyFillParams): Promise<VerifyFillResult> {
    // Deprecated path: used to call Supabase Edge Function. The EC2 engine logs fills server-side.
    console.warn('[strategyEngine.verifyFill] Not implemented on EC2 path; returning fail-open response.');
    return { verified: false, critical: false, message: 'verifyFill not implemented (EC2 engine path)' };
  },

  /**
   * Check structure integrity of current positions.
   * Returns orphans and broken groups that would block new entries.
   */
  async checkStructureIntegrity(positions: Position[]): Promise<StructureIntegrityResult> {
    try {
      const { data, error } = await supabase.functions.invoke('strategy-engine', {
        body: {
          action: 'check_structure_integrity',
          positions,
        },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking structure integrity:', error);
      return { 
        healthy: true, // Fail open to avoid blocking during errors
        brokenGroups: [], 
        orphanSymbols: [], 
        reason: 'integrity_check_failed' 
      };
    }
  },

  /**
   * Clean up stale position_group_map entries.
   * @param aggressive - If true, deletes ALL mappings for symbols not at broker (no 24h cutoff)
   */
  async cleanupMaps(aggressive: boolean = false): Promise<{ deletedCount: number; activeSymbolsCount: number; aggressive?: boolean }> {
    try {
      const { data, error } = await supabase.functions.invoke('strategy-engine', {
        body: {
          action: 'cleanup_maps',
          aggressive,
        },
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error cleaning up maps:', error);
      return { deletedCount: 0, activeSymbolsCount: 0 };
    }
  },

  /**
   * Delete position_group_map entries for a specific trade group.
   * Call this after a successful close to prevent stale mapping accumulation.
   */
  async deleteGroupMappings(tradeGroupId: string): Promise<{ success: boolean; deletedCount: number }> {
    try {
      const { data, error } = await supabase.functions.invoke('strategy-engine', {
        body: {
          action: 'delete_group_mappings',
          tradeGroupId,
        },
      });

      if (error) throw error;
      return data || { success: true, deletedCount: 0 };
    } catch (error) {
      console.error('Error deleting group mappings:', error);
      return { success: false, deletedCount: 0 };
    }
  },
};
