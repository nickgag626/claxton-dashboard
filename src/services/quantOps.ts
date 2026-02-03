import { API_BASE } from './apiBase';

export type OrderIntent = {
  id: string;
  broker: string;
  strategy_id?: string | null;
  trade_group_id?: string | null;
  idempotency_key?: string | null;
  engine_sha?: string | null;
  config_hash?: string | null;
  created_at?: string | null;
  request_json?: any;
  config_json?: any;
};

export type BrokerOrder = {
  id: string;
  intent_id: string;
  broker: string;
  broker_order_id: string;
  state: string;
  submitted_at_utc?: string | null;
  ack_at_utc?: string | null;
  last_seen_at_utc?: string | null;
  created_at?: string | null;
  raw?: any;
};

export type FillEvent = {
  id?: string;
  trade_group_id?: string | null;
  broker?: string | null;
  order_id?: string | null;
  symbol?: string | null;
  underlying?: string | null;
  side?: string | null;
  event_type?: string | null;
  filled_qty?: number | string | null;
  fill_price?: number | string | null;
  fill_time?: string | null;
  created_at?: string | null;
  raw?: any;
};

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: 'no-store' });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    const msg = json?.error || `Request failed: ${res.status}`;
    throw new Error(msg);
  }
  return json.data as T;
}

export const quantOps = {
  orderIntents: (opts?: { broker?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.broker) params.set('broker', opts.broker);
    if (opts?.limit) params.set('limit', String(opts.limit));
    return apiGet<{ order_intents: OrderIntent[] }>(`/api/ops/order-intents?${params.toString()}`);
  },

  brokerOrders: (opts?: { broker?: string; state?: string; intent_id?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.broker) params.set('broker', opts.broker);
    if (opts?.state) params.set('state', opts.state);
    if (opts?.intent_id) params.set('intent_id', opts.intent_id);
    if (opts?.limit) params.set('limit', String(opts.limit));
    return apiGet<{ broker_orders: BrokerOrder[] }>(`/api/ops/broker-orders?${params.toString()}`);
  },

  fills: (trade_group_id: string, opts?: { limit?: number }) => {
    const params = new URLSearchParams();
    params.set('trade_group_id', trade_group_id);
    if (opts?.limit) params.set('limit', String(opts.limit));
    return apiGet<{ fill_events: FillEvent[] }>(`/api/ops/fills?${params.toString()}`);
  },
};
