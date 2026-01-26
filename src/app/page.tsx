'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const API_BASE = 'https://claxton-quant-python.vercel.app';

interface Quote {
  symbol: string;
  last: number;
  change: number;
  change_percentage: number;
  bid: number;
  ask: number;
  volume: number;
  high: number;
  low: number;
}

interface Balance {
  total_equity: number;
  cash: number;
  margin_buying_power: number;
  pending_orders: number;
}

interface Position {
  symbol: string;
  quantity: number;
  cost_basis: number;
  current_value?: number;
}

export default function Dashboard() {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [expirations, setExpirations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setError(null);
      
      // Fetch SPY quote
      const quoteRes = await fetch(`${API_BASE}/api/quote/SPY`);
      const quoteData = await quoteRes.json();
      if (quoteData.success) {
        setQuote(quoteData.data);
      }

      // Fetch account balance
      const balanceRes = await fetch(`${API_BASE}/api/account/balance`);
      const balanceData = await balanceRes.json();
      if (balanceData.success) {
        setBalance(balanceData.data);
      }

      // Fetch positions
      const posRes = await fetch(`${API_BASE}/api/account/positions`);
      const posData = await posRes.json();
      if (posData.success) {
        setPositions(posData.data || []);
      }

      // Fetch expirations
      const expRes = await fetch(`${API_BASE}/api/expirations/SPY`);
      const expData = await expRes.json();
      if (expData.success) {
        setExpirations(expData.data?.slice(0, 8) || []);
      }

      setLoading(false);
    } catch (err) {
      setError('Failed to fetch data from API');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-xl">Loading Claxton...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Claxton-Quant</h1>
            <p className="text-gray-400">Iron Condor Trading Engine</p>
          </div>
          <Badge variant="outline" className="text-green-400 border-green-400">
            {error ? 'Disconnected' : 'Connected'}
          </Badge>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4">
            {error}
          </div>
        )}

        {/* Top Row - Quote & Account */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* SPY Quote */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex justify-between">
                <span>SPY</span>
                {quote && (
                  <span className={quote.change >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {quote.change >= 0 ? '+' : ''}{quote.change_percentage.toFixed(2)}%
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {quote ? (
                <div className="space-y-2">
                  <div className="text-4xl font-bold">${quote.last.toFixed(2)}</div>
                  <div className="grid grid-cols-3 gap-4 text-sm text-gray-400">
                    <div>
                      <div className="text-gray-500">Bid</div>
                      <div>${quote.bid.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Ask</div>
                      <div>${quote.ask.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Volume</div>
                      <div>{(quote.volume / 1000000).toFixed(1)}M</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                    <div>
                      <div className="text-gray-500">Day High</div>
                      <div>${quote.high.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Day Low</div>
                      <div>${quote.low.toFixed(2)}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">No quote data</div>
              )}
            </CardContent>
          </Card>

          {/* Account Balance */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="pb-2">
              <CardTitle>Account</CardTitle>
            </CardHeader>
            <CardContent>
              {balance ? (
                <div className="space-y-2">
                  <div className="text-4xl font-bold text-green-400">
                    ${balance.total_equity?.toLocaleString() || '0'}
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                    <div>
                      <div className="text-gray-500">Cash</div>
                      <div>${balance.cash?.toLocaleString() || '0'}</div>
                    </div>
                    <div>
                      <div className="text-gray-500">Buying Power</div>
                      <div>${balance.margin_buying_power?.toLocaleString() || '0'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">No account data</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Expirations */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle>Available Expirations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {expirations.length > 0 ? (
                expirations.map((exp) => (
                  <Badge key={exp} variant="secondary" className="bg-gray-800 hover:bg-gray-700 cursor-pointer">
                    {exp}
                  </Badge>
                ))
              ) : (
                <span className="text-gray-500">No expirations loaded</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Positions */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle>Open Positions</CardTitle>
          </CardHeader>
          <CardContent>
            {positions.length > 0 ? (
              <div className="space-y-2">
                {positions.map((pos, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-gray-800 rounded">
                    <div>
                      <div className="font-medium">{pos.symbol}</div>
                      <div className="text-sm text-gray-400">Qty: {pos.quantity}</div>
                    </div>
                    <div className="text-right">
                      <div>${pos.cost_basis?.toFixed(2)}</div>
                      <div className="text-sm text-gray-400">Cost Basis</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 text-center py-8">No open positions</div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button 
            onClick={fetchData}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Refresh Data
          </Button>
          <Button 
            variant="outline"
            className="border-gray-700 hover:bg-gray-800"
            onClick={() => window.open(`${API_BASE}/health`, '_blank')}
          >
            API Health
          </Button>
        </div>
      </div>
    </div>
  );
}
