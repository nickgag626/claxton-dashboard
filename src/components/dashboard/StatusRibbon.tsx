'use client';

import { motion } from 'framer-motion';
import { StatusBadge } from './StatusBadge';
import type { MarketState } from '@/types/trading';

interface StreamingStatus {
  mode: 'polling' | 'streaming';
  connected: boolean;
  avgLatencyMs: number;
  quotesReceived: number;
  exitsTriggered: number;
}

interface DbRealtimeStatus {
  connected: boolean;
  lastEventAt: Date | null;
}

interface StatusRibbonProps {
  isApiConnected: boolean;
  isQuotesLive: boolean;
  isBotRunning: boolean;
  killSwitchActive: boolean;
  marketState: MarketState;
  positionCount: number;
  nearestDte: number | null;
  lastUpdate: Date | null;
  lastCheckExitsTime?: Date | null;
  streamingStatus?: StreamingStatus;
  dbRealtimeStatus?: DbRealtimeStatus;
}

export const StatusRibbon = ({
  isApiConnected,
  isQuotesLive,
  isBotRunning,
  killSwitchActive,
  marketState,
  positionCount,
  nearestDte,
  lastUpdate,
  lastCheckExitsTime,
  streamingStatus,
  dbRealtimeStatus,
}: StatusRibbonProps) => {
  // Calculate exit monitor status
  const getExitStatus = (): { variant: 'green' | 'amber' | 'red' | 'gray'; text: string } => {
    // Streaming mode
    if (streamingStatus?.mode === 'streaming') {
      if (streamingStatus.connected) {
        const latency = streamingStatus.avgLatencyMs;
        if (latency > 0 && latency < 500) {
          return { variant: 'green', text: `EXITS:${Math.round(latency)}ms` };
        } else if (latency >= 500) {
          return { variant: 'amber', text: `EXITS:${Math.round(latency)}ms` };
        }
        return { variant: 'green', text: 'EXITS:STREAM' };
      } else {
        return { variant: 'amber', text: 'EXITS:DISC' };
      }
    }
    
    // Polling mode fallback
    if (!lastCheckExitsTime) {
      return { variant: 'gray', text: 'EXITS:--' };
    }
    const ageMs = Date.now() - lastCheckExitsTime.getTime();
    const ageSec = Math.floor(ageMs / 1000);

    if (ageSec < 45) {
      return { variant: 'green', text: `EXITS:${ageSec}s` };
    } else if (ageSec < 90) {
      return { variant: 'amber', text: `EXITS:${ageSec}s` };
    } else {
      return { variant: 'red', text: `EXITS:${ageSec}s` };
    }
  };

  const exitStatus = getExitStatus();

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card/80 backdrop-blur-sm border border-border rounded-md px-4 py-2 flex flex-wrap items-center gap-2"
    >
      <StatusBadge variant={isApiConnected ? 'green' : 'red'}>
        API:{isApiConnected ? 'CONNECTED' : 'DISCONNECTED'}
      </StatusBadge>
      
      <StatusBadge variant={isQuotesLive ? 'green' : 'amber'}>
        QUOTES:{isQuotesLive ? 'LIVE' : 'DELAYED'}
      </StatusBadge>
      
      <StatusBadge variant={isBotRunning ? 'green' : 'gray'}>
        BOT:{isBotRunning ? 'RUNNING' : 'STOPPED'}
      </StatusBadge>

      <StatusBadge variant={exitStatus.variant}>
        {exitStatus.text}
      </StatusBadge>

      <StatusBadge variant={killSwitchActive ? 'red' : 'gray'}>
        KILL:{killSwitchActive ? 'ACTIVE' : 'OFF'}
      </StatusBadge>

      {/* Supabase realtime (DB-driven) status */}
      <StatusBadge
        variant={
          dbRealtimeStatus
            ? (dbRealtimeStatus.connected ? 'green' : 'amber')
            : 'gray'
        }
      >
        DB:{(() => {
          if (!dbRealtimeStatus) return '--';
          if (!dbRealtimeStatus.connected) return 'DISC';
          if (!dbRealtimeStatus.lastEventAt) return 'LIVE';
          const ageSec = Math.floor((Date.now() - dbRealtimeStatus.lastEventAt.getTime()) / 1000);
          return ageSec < 60 ? `LIVE+${ageSec}s` : 'LIVE';
        })()}
      </StatusBadge>
      
      <StatusBadge variant="blue">
        TICK:{lastUpdate ? lastUpdate.toLocaleTimeString('en-US', { hour12: false }) : '--:--:--'}
      </StatusBadge>
      
      <StatusBadge variant="amber">
        ENV:PAPER
      </StatusBadge>
      
      <StatusBadge variant="blue">
        POS:{positionCount}
      </StatusBadge>
      
      <StatusBadge variant={nearestDte !== null ? 'amber' : 'gray'}>
        DTE:{nearestDte !== null ? nearestDte : '--'}
      </StatusBadge>
      
      <StatusBadge variant={marketState === 'open' ? 'green' : marketState === 'closed' ? 'red' : 'amber'}>
        MKT:{marketState.toUpperCase()}
      </StatusBadge>
    </motion.div>
  );
};
