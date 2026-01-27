import { supabase } from '@/integrations/supabase/client';
import { API_BASE } from '@/services/apiBase';
import type { StrategyEvaluation, EventType, Decision, Gate, EvaluationInputs, ProposedOrder } from '@/types/evaluation';

// Generate a hash for de-duplication
function generateDecisionHash(config: Record<string, any>, inputs: EvaluationInputs, gates: Gate[]): string {
  const payload = JSON.stringify({ config, inputs, gates: gates.map(g => ({ name: g.name, pass: g.pass })) });
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export const evaluationService = {
  // Fetch latest evaluation for a strategy
  async getLatestEvaluation(strategyId: string): Promise<StrategyEvaluation | null> {
    const { data, error } = await supabase
      .from('strategy_evaluations')
      .select('*')
      .eq('strategy_id', strategyId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return null;
    return this.mapToEvaluation(data);
  },

  // Fetch evaluations for a trade group
  async getEvaluationsForTradeGroup(tradeGroupId: string): Promise<StrategyEvaluation[]> {
    const { data, error } = await supabase
      .from('strategy_evaluations')
      .select('*')
      .eq('trade_group_id', tradeGroupId)
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map(d => this.mapToEvaluation(d));
  },

  // Fetch recent evaluations for a strategy
  async getRecentEvaluations(strategyId: string, limit = 50): Promise<StrategyEvaluation[]> {
    const { data, error } = await supabase
      .from('strategy_evaluations')
      .select('*')
      .eq('strategy_id', strategyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];
    return data.map(d => this.mapToEvaluation(d));
  },

  // Check if we should save (de-dupe identical evaluations)
  async shouldSaveEvaluation(
    strategyId: string, 
    config: Record<string, any>, 
    inputs: EvaluationInputs, 
    gates: Gate[],
    eventType: EventType
  ): Promise<boolean> {
    // Always save action events
    if (eventType !== 'evaluation') return true;

    const latest = await this.getLatestEvaluation(strategyId);
    if (!latest) return true;

    const newHash = generateDecisionHash(config, inputs, gates);
    const oldHash = generateDecisionHash(
      latest.config_json, 
      latest.inputs_json, 
      latest.gates_json
    );

    // Save if hash changed
    return newHash !== oldHash;
  },

  // Trigger a manual evaluation for a strategy (routes to EC2 Python engine)
  // NOTE: This no longer calls the Supabase Edge Function (CORS issues / deprecated path).
  async runEvaluation(strategyId: string, options?: { 
    overrideMarketStatus?: string;
    overrideTimeET?: string;
  }): Promise<StrategyEvaluation | null> {
    try {
      // 1) Load strategy config from Supabase
      const { data: stratRow, error: stratErr } = await supabase
        .from('strategies')
        .select('*')
        .eq('id', strategyId)
        .single();

      if (stratErr || !stratRow) {
        console.error('Error loading strategy for runEvaluation:', stratErr);
        return null;
      }

      // 2) Ask the Python engine to evaluate (single-strategy)
      const payloadStrategies = [
        {
          id: stratRow.id,
          name: stratRow.name,
          underlying: stratRow.underlying,
          enabled: stratRow.enabled,
          min_dte: stratRow.entry_conditions?.minDte ?? 30,
          max_dte: stratRow.entry_conditions?.maxDte ?? 60,
          min_credit: stratRow.entry_conditions?.minPremium ?? 0.5,
          min_credit_percent: 10.0,
          target_delta: stratRow.entry_conditions?.shortDeltaTarget ?? 0.16,
          profit_target_percent: stratRow.exit_conditions?.profitTargetPercent ?? 50,
          stop_loss_percent: stratRow.exit_conditions?.stopLossPercent ?? 200,
          time_stop_dte: stratRow.exit_conditions?.timeStopDte ?? 7,
          max_positions: stratRow.max_positions ?? 3,
          max_risk_per_trade: (stratRow.entry_conditions?.sizing?.riskPerTrade) ?? 500,
        },
      ];

      const evalRes = await fetch(`${API_BASE}/api/engine/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategies: payloadStrategies }),
      });

      const evalJson = await evalRes.json();
      const signals = evalJson?.success ? (evalJson?.data?.signals || []) : [];

      // 3) If we got a signal, execute it immediately
      let decision: Decision = 'SKIP';
      let reason = 'no_signal';
      let tradeGroupId: string | null = null;

      if (signals.length > 0) {
        const sig = signals[0];
        const execRes = await fetch(`${API_BASE}/api/engine/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            strategy_name: sig.strategy_name,
            underlying: sig.underlying,
            expiration: sig.expiration,
            legs: sig.legs,
            expected_credit: sig.expected_credit,
          }),
        });

        const execJson = await execRes.json();
        if (execJson?.success) {
          decision = 'OPEN';
          reason = 'manual_run_opened';
          // trade_group_id is created server-side when logging; may not be returned here
        } else {
          decision = 'FAIL';
          reason = execJson?.error || 'manual_run_failed';
        }
      }

      // 4) Persist a minimal evaluation record so the UI has an audit trail
      const emptyInputs: EvaluationInputs = {
        market: {
          now_et: options?.overrideTimeET || new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' }),
          underlying_price: 0,
        },
        account: {
          open_positions_count: 0,
          max_positions: stratRow.max_positions ?? 0,
        },
      };

      const saved = await this.saveEvaluation({
        strategyId,
        underlying: stratRow.underlying,
        eventType: decision === 'OPEN' ? 'entry_submitted' : 'evaluation',
        decision,
        reason,
        configJson: stratRow,
        inputsJson: emptyInputs,
        gatesJson: [],
        proposedOrderJson: signals[0]
          ? {
              legs: (signals[0].legs || []).map((l: any) => ({
                role: 'custom',
                option_symbol: l.symbol,
                strike: 0,
                delta: 0,
                side: l.side,
                quantity: l.quantity,
              })),
              estimated_credit: signals[0].expected_credit,
            }
          : null,
        tradeGroupId,
        clientRequestId: null,
      });

      return saved;
    } catch (error) {
      console.error('Error running evaluation:', error);
      return null;
    }
  },

  // Save an evaluation record
  async saveEvaluation(params: {
    strategyId: string;
    underlying: string;
    eventType: EventType;
    decision: Decision;
    reason: string;
    configJson: Record<string, any>;
    inputsJson: EvaluationInputs;
    gatesJson: Gate[];
    proposedOrderJson?: ProposedOrder | null;
    tradeGroupId?: string | null;
    clientRequestId?: string | null;
  }): Promise<StrategyEvaluation | null> {
    // Check for de-duplication on regular evaluations
    const shouldSave = await this.shouldSaveEvaluation(
      params.strategyId,
      params.configJson,
      params.inputsJson,
      params.gatesJson,
      params.eventType
    );

    if (!shouldSave) {
      console.log('Skipping duplicate evaluation for strategy:', params.strategyId);
      return await this.getLatestEvaluation(params.strategyId);
    }

    const payload: Record<string, unknown> = {
      strategy_id: params.strategyId,
      underlying: params.underlying,
      event_type: params.eventType,
      decision: params.decision,
      reason: params.reason,
      config_json: params.configJson,
      inputs_json: params.inputsJson,
      gates_json: params.gatesJson,
      proposed_order_json: params.proposedOrderJson ?? null,
      trade_group_id: params.tradeGroupId ?? null,
      client_request_id: params.clientRequestId ?? null,
    };

    const { data, error } = await supabase
      .from('strategy_evaluations')
      .insert(payload as any)
      .select()
      .single();

    if (error) {
      console.error('Error saving evaluation:', error);
      return null;
    }
    return this.mapToEvaluation(data);
  },

  // Map DB row to typed evaluation
  mapToEvaluation(data: any): StrategyEvaluation {
    return {
      id: data.id,
      strategy_id: data.strategy_id,
      created_at: data.created_at,
      underlying: data.underlying,
      event_type: data.event_type,
      decision: data.decision,
      reason: data.reason,
      config_json: data.config_json || {},
      inputs_json: data.inputs_json || { market: {}, account: {} },
      gates_json: Array.isArray(data.gates_json) ? data.gates_json : [],
      proposed_order_json: data.proposed_order_json,
      trade_group_id: data.trade_group_id,
      client_request_id: data.client_request_id,
    };
  },
};
