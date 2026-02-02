'use client';

import { motion } from "framer-motion";
import { Activity, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export const Header = () => {
  const { user, signOut } = useAuth();

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-between py-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-trading-green to-bloomberg-amber flex items-center justify-center">
          <Activity className="w-5 h-5 text-black" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Claxton Quant Pro Trader v0.69</h1>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            SPX/NDX Options Trading Bot Framework
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Live Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-trading-green/10 border border-trading-green/30 rounded-full animate-pulse-glow">
          <div className="w-2 h-2 rounded-full bg-trading-green shadow-[0_0_8px_hsl(142,71%,45%)]" />
          <span className="text-[10px] font-mono font-semibold text-trading-green uppercase tracking-wider">LIVE</span>
        </div>

        {/* User & Sign Out */}
        {user && (
          <button
            onClick={signOut}
            title={`Sign out ${user.email}`}
            className="flex items-center gap-2 px-3 py-1.5 text-muted-foreground hover:text-foreground border border-border/50 hover:border-border rounded-full transition-colors text-xs"
          >
            <span className="hidden sm:inline font-mono truncate max-w-[140px]">{user.email}</span>
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.header>
  );
};
