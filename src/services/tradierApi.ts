// Tradier API service - uses Python backend at Vercel
import type { Quote, Position, Greeks, MarketState } from '@/types/trading';

const API_BASE = 'https://claxton-quant-python.vercel.app';

interface TradierQuote {
  symbol: string;
  last: number;
  change: number;
  change_percentage: number;
  bid: number;
  ask: number;
  volume: number;
}

interface TradierPosition {
  id: number;
  symbol: string;
  quantity: number;
  cost_basis: number;
  date_acquired: string;
}

interface TradierBalance {
  total_equity: number;
  total_cash: number;
  market_value: number;
  open_pl: number;
  close_pl: number;
  pending_cash: number;
  uncleard_funds: number;
  margin_buying_power?: number;
  cash?: number;
}

async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`API error: ${res.status} - ${errorText}`);
  }
  
  const data = await res.json();
  if (!data.success) {
    throw new Error(data.error || 'API request failed');
  }
  
  return data.data;
}

export const tradierApi = {
  async ping(): Promise<{ ok: boolean; timestamp?: string; error?: string; details?: any }> {
    try {
      const res = await fetch(`${API_BASE}/health`);
      const data = await res.json();
      return { ok: data.status === 'healthy', timestamp: new Date().toISOString() };
    } catch (err) {
      return {
        ok: false,
        error: String(err),
        details: { raw: String(err) },
      };
    }
  },

  async getQuotes(symbols: string[]): Promise<Record<string, Quote>> {
    const quotes: Record<string, Quote> = {};
    
    // Fetch quotes for each symbol
    await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const data = await apiCall<TradierQuote>(`/api/quote/${symbol}`);
          quotes[symbol] = {
            symbol: data.symbol,
            last: data.last || 0,
            change: data.change || 0,
            changePercent: data.change_percentage || 0,
            bid: data.bid || 0,
            ask: data.ask || 0,
            volume: data.volume || 0,
          };
        } catch (e) {
          console.error(`Failed to fetch quote for ${symbol}:`, e);
        }
      })
    );
    
    return quotes;
  },

  async getPositions(): Promise<Position[]> {
    try {
      const data = await apiCall<TradierPosition[]>('/api/account/positions');
      
      if (!data || data.length === 0) return [];
      
      // Get live quotes for all position symbols to calculate current value
      const symbols = data.map(p => p.symbol);
      let liveQuotes: Record<string, { last: number; bid: number; ask: number }> = {};
      
      if (symbols.length > 0) {
        liveQuotes = await this.getQuotes(symbols) as any;
      }
      
      return data.map((p) => {
        const quote = liveQuotes[p.symbol];
        // markPrice is PER-CONTRACT (mid of bid/ask or last) - never multiplied
        const markPrice = quote ? ((quote as any).bid + (quote as any).ask) / 2 || (quote as any).last : 0;
        
        // currentValue is TOTAL DOLLARS: markPrice × |qty| × 100, with sign matching position
        const marketValueAbs = markPrice * Math.abs(p.quantity) * 100;
        const signedMarketValue = p.quantity < 0 ? -marketValueAbs : marketValueAbs;
        
        // Parse option symbol to extract expiration date
        const parsed = parseOptionSymbol(p.symbol);
        
        return {
          id: String(p.id),
          symbol: p.symbol,
          quantity: p.quantity,
          costBasis: p.cost_basis,
          currentValue: markPrice > 0 ? signedMarketValue : p.cost_basis,
          markPrice: markPrice > 0 ? markPrice : undefined,
          status: 'open' as const,
          entryTime: new Date(p.date_acquired),
          expirationDate: parsed?.expiration,
          underlying: parsed?.underlying,
          _rawTradier: {
            cost_basis: p.cost_basis,
            market_value: markPrice > 0 ? signedMarketValue : undefined,
            quantity: p.quantity,
          },
        };
      });
    } catch (error) {
      console.error('Failed to fetch positions:', error);
      throw error;
    }
  },

  async getBalances(): Promise<TradierBalance | null> {
    try {
      const data = await apiCall<TradierBalance>('/api/account/balance');
      return data;
    } catch (error) {
      console.error('Failed to fetch balances:', error);
      throw error;
    }
  },

  async getMarketClock(): Promise<{ state: MarketState; timestamp: string }> {
    try {
      // Determine market state based on current time (simplified)
      const now = new Date();
      const nyTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const hours = nyTime.getHours();
      const minutes = nyTime.getMinutes();
      const day = nyTime.getDay();
      
      let state: MarketState = 'closed';
      
      // Skip weekends
      if (day > 0 && day < 6) {
        const timeNum = hours * 100 + minutes;
        if (timeNum >= 930 && timeNum < 1600) {
          state = 'open';
        } else if (timeNum >= 400 && timeNum < 930) {
          state = 'premarket';
        } else if (timeNum >= 1600 && timeNum < 2000) {
          state = 'postmarket';
        }
      }
      
      return {
        state,
        timestamp: now.toISOString(),
      };
    } catch (error) {
      console.error('Failed to fetch market clock:', error);
      return { state: 'unknown', timestamp: new Date().toISOString() };
    }
  },

  async getOptionExpirations(symbol: string): Promise<string[]> {
    try {
      const data = await apiCall<string[]>(`/api/expirations/${symbol}`);
      return data || [];
    } catch (error) {
      console.error('Failed to fetch expirations:', error);
      throw error;
    }
  },

  async closePosition(
    symbol: string,
    quantity: number,
    opts?: {
      dryRun?: boolean;
      debug?: boolean;
      clientRequestId?: string;
      trade_group_id?: string;
      source?: 'manual_ui' | 'bot_engine' | string;
      forceClose?: boolean;
    }
  ): Promise<{
    success: boolean;
    dryRun?: boolean;
    skipped?: boolean;
    notFound?: boolean;
    orderId?: string;
    error?: string;
    debug?: any;
    clientRequestId?: string;
    closeSide?: string;
    closeQty?: number;
    positionDetails?: {
      symbol: string;
      quantity: number;
      costBasis: number;
      side?: string;
    };
    blocked?: boolean;
    blockReason?: string;
    spreadIssues?: Array<{ symbol: string; bid: number; ask: number; spreadPercent: number }>;
  }> {
    const clientRequestId = opts?.clientRequestId || crypto.randomUUID();
    
    console.log('[tradierApi.closePosition] Request', { symbol, quantity, opts, clientRequestId });
    
    try {
      const res = await fetch(`${API_BASE}/api/engine/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close_position',
          symbol,
          quantity,
          ...opts,
          clientRequestId,
        }),
      });
      
      const data = await res.json();
      
      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Close position failed',
          clientRequestId,
        };
      }
      
      return {
        success: true,
        orderId: data.orderId,
        clientRequestId,
      };
    } catch (err) {
      return {
        success: false,
        error: String(err),
        clientRequestId,
      };
    }
  },

  async closeGroup(
    symbols: string[],
    opts?: {
      dryRun?: boolean;
      debug?: boolean;
      clientRequestId?: string;
      trade_group_id?: string;
      source?: 'manual_ui_group' | 'bot_engine_group' | 'emergency_close' | string;
      forceClose?: boolean;
    }
  ): Promise<{
    success: boolean;
    dryRun?: boolean;
    skipped?: boolean;
    notFound?: boolean;
    orderId?: string;
    error?: string;
    debug?: any;
    clientRequestId?: string;
    legs?: Array<{ symbol: string; closeSide: string; closeQty: number; positionSide?: string }>;
    blocked?: boolean;
    blockReason?: string;
    spreadIssues?: Array<{ symbol: string; bid: number; ask: number; spreadPercent: number }>;
  }> {
    const clientRequestId = opts?.clientRequestId || crypto.randomUUID();
    
    console.log('[tradierApi.closeGroup] Request', { symbols, opts, clientRequestId });
    
    try {
      const res = await fetch(`${API_BASE}/api/engine/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close_group',
          symbols,
          ...opts,
          clientRequestId,
        }),
      });
      
      const data = await res.json();
      
      if (!data.success) {
        return {
          success: false,
          error: data.error || 'Close group failed',
          clientRequestId,
        };
      }
      
      return {
        success: true,
        orderId: data.orderId,
        legs: data.legs,
        clientRequestId,
      };
    } catch (err) {
      return {
        success: false,
        error: String(err),
        clientRequestId,
      };
    }
  },

  async getOptionChain(symbol: string, expiration: string): Promise<any[]> {
    try {
      const data = await apiCall<any[]>(`/api/chain/${symbol}/${expiration}`);
      return data || [];
    } catch (error) {
      console.error('Failed to fetch option chain:', error);
      throw error;
    }
  },

  async getOrderStatus(orderId: string): Promise<{
    success: boolean;
    orderId: string;
    closeStatus: 'submitted' | 'filled' | 'rejected' | 'canceled' | 'expired';
    rejectReason?: string;
    avgFillPrice?: number;
    filledQty?: number;
    closeSide?: string;
    tradierStatus?: string;
    legFills?: Record<string, { avgFillPrice: number; filledQty: number; side: string }>;
    error?: string;
  }> {
    try {
      const res = await fetch(`${API_BASE}/api/account/orders`);
      const allOrders = await res.json();
      
      if (!allOrders.success) {
        return { success: false, orderId, closeStatus: 'submitted', error: allOrders.error };
      }
      
      const order = allOrders.data?.find((o: any) => o.id === orderId);
      
      if (!order) {
        return { success: false, orderId, closeStatus: 'submitted', error: 'Order not found' };
      }
      
      const statusMap: Record<string, 'submitted' | 'filled' | 'rejected' | 'canceled' | 'expired'> = {
        'pending': 'submitted',
        'open': 'submitted',
        'filled': 'filled',
        'rejected': 'rejected',
        'canceled': 'canceled',
        'expired': 'expired',
      };
      
      return {
        success: true,
        orderId,
        closeStatus: statusMap[order.status] || 'submitted',
        avgFillPrice: order.avg_fill_price,
        filledQty: order.exec_quantity,
        tradierStatus: order.status,
      };
    } catch (error) {
      console.error('Failed to fetch order status:', error);
      return { 
        success: false, 
        orderId, 
        closeStatus: 'submitted', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },
};

// Parse OCC option symbol (e.g., SPY260112C00700000)
export const parseOptionSymbol = (symbol: string): { underlying: string; expiration: string; type: 'call' | 'put'; strike: number } | null => {
  // OCC format: SYMBOL + YYMMDD + C/P + 8-digit strike (multiplied by 1000)
  const match = symbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);
  if (!match) return null;
  
  const [, underlying, dateStr, typeChar, strikeStr] = match;
  const year = 2000 + parseInt(dateStr.slice(0, 2));
  const month = parseInt(dateStr.slice(2, 4)) - 1;
  const day = parseInt(dateStr.slice(4, 6));
  const expiration = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const strike = parseInt(strikeStr) / 1000;
  
  return {
    underlying,
    expiration,
    type: typeChar === 'C' ? 'call' : 'put',
    strike,
  };
};

// Helper to calculate portfolio Greeks from positions
export const calculatePortfolioGreeks = (positions: Position[], optionData: any[]): Greeks => {
  let delta = 0;
  let gamma = 0;
  let theta = 0;
  let vega = 0;

  positions.forEach(pos => {
    let optionInfo = optionData.find(o => o.symbol === pos.symbol);
    
    if (!optionInfo) {
      const parsed = parseOptionSymbol(pos.symbol);
      if (parsed) {
        optionInfo = optionData.find(o => 
          o.strike === parsed.strike && 
          o.option_type === parsed.type
        );
      }
    }
    
    if (optionInfo?.greeks) {
      const multiplier = pos.quantity;
      delta += (optionInfo.greeks.delta || 0) * multiplier;
      gamma += (optionInfo.greeks.gamma || 0) * multiplier;
      theta += (optionInfo.greeks.theta || 0) * multiplier;
      vega += (optionInfo.greeks.vega || 0) * multiplier;
    }
  });

  return { delta, gamma, theta, vega };
};
