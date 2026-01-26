'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Event {
  ticker: string;
  title: string;
  subtitle?: string;
}

interface MarketDetails {
  ticker: string;
  title?: string;
  yesBid?: number;
  yesAsk?: number;
  noBid?: number;
  noAsk?: number;
  volume?: number;
  openInterest?: number;
  status?: string;
}

export default function Dashboard() {
  const [balance, setBalance] = useState<number | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<MarketDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    // Fetch portfolio
    fetch('/api/portfolio')
      .then(res => res.json())
      .then(data => {
        setBalance(data.balance);
      })
      .catch(console.error);

    // Fetch initial markets
    fetch('/api/markets')
      .then(res => res.json())
      .then(data => {
        setEvents(data.events || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const handleSearch = async () => {
    setSearching(true);
    try {
      const res = await fetch(`/api/markets?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
    }
    setSearching(false);
  };

  const loadMarket = async (ticker: string) => {
    try {
      const res = await fetch(`/api/market/${encodeURIComponent(ticker)}`);
      const data = await res.json();
      setSelectedMarket(data);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Claxton Dashboard</h1>
            <p className="text-zinc-400">Kalshi Prediction Markets</p>
          </div>
          <Card className="border-green-500/20 bg-green-500/10">
            <CardContent className="p-4">
              <div className="text-sm text-green-400">Available Balance</div>
              <div className="text-2xl font-bold text-green-500">
                {balance !== null ? `$${balance.toFixed(2)}` : '...'}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Markets List */}
          <Card className="border-zinc-700 bg-zinc-800/50">
            <CardHeader>
              <CardTitle className="text-white">Markets</CardTitle>
              <CardDescription>Click to view details</CardDescription>
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Search markets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 rounded-md border border-zinc-600 bg-zinc-700 px-3 py-2 text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Button onClick={handleSearch} disabled={searching} variant="secondary">
                  {searching ? '...' : 'Search'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="text-center text-zinc-400">Loading markets...</div>
              ) : events.length === 0 ? (
                <div className="text-center text-zinc-400">No markets found</div>
              ) : (
                <div className="space-y-2">
                  {events.map((event) => (
                    <button
                      key={event.ticker}
                      onClick={() => loadMarket(event.ticker)}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        selectedMarket?.ticker === event.ticker
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-zinc-700 bg-zinc-800 hover:border-zinc-600 hover:bg-zinc-700/50'
                      }`}
                    >
                      <div className="text-sm font-medium text-white">{event.title}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs text-zinc-400">
                          {event.ticker}
                        </Badge>
                        {event.subtitle && (
                          <span className="text-xs text-zinc-500">{event.subtitle}</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Market Details */}
          <Card className="border-zinc-700 bg-zinc-800/50">
            <CardHeader>
              <CardTitle className="text-white">Market Details</CardTitle>
              <CardDescription>
                {selectedMarket ? selectedMarket.ticker : 'Select a market'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedMarket ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-medium text-white">
                      {selectedMarket.title || selectedMarket.ticker}
                    </h3>
                    <Badge
                      variant={selectedMarket.status === 'active' ? 'default' : 'secondary'}
                      className="mt-2"
                    >
                      {selectedMarket.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-green-500/10 p-4">
                      <div className="text-sm text-green-400">YES Price</div>
                      <div className="mt-1 text-2xl font-bold text-green-500">
                        {selectedMarket.yesBid}¢ - {selectedMarket.yesAsk}¢
                      </div>
                      <div className="text-xs text-zinc-500">bid / ask</div>
                    </div>
                    <div className="rounded-lg bg-red-500/10 p-4">
                      <div className="text-sm text-red-400">NO Price</div>
                      <div className="mt-1 text-2xl font-bold text-red-500">
                        {selectedMarket.noBid}¢ - {selectedMarket.noAsk}¢
                      </div>
                      <div className="text-xs text-zinc-500">bid / ask</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="rounded-lg bg-zinc-700/50 p-4">
                      <div className="text-xs text-zinc-400">Volume</div>
                      <div className="mt-1 text-xl font-semibold text-white">
                        ${(selectedMarket.volume || 0).toLocaleString()}
                      </div>
                    </div>
                    <div className="rounded-lg bg-zinc-700/50 p-4">
                      <div className="text-xs text-zinc-400">Open Interest</div>
                      <div className="mt-1 text-xl font-semibold text-white">
                        {(selectedMarket.openInterest || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <Button className="w-full" size="lg">
                    Trade on Kalshi →
                  </Button>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center text-zinc-500">
                  Select a market to view details
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
