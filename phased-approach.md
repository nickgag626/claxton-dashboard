# Claxton Options Trading Bot — Comprehensive Production Roadmap

> **Document Version:** 2.0  
> **Author:** Engineering (auto-generated from codebase audit)  
> **Date:** 2026-02-01  
> **Repos:**  
> - Python Engine: `claxton-quant-python` (FastAPI on EC2)  
> - Dashboard: `claxton-dashboard` (Next.js on Vercel)  
> **Broker:** Tradier (current); multi-broker planned  
> **Database:** Supabase (PostgreSQL)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current System Audit (Phases 1–4 Delivered)](#2-current-system-audit)
3. [Architecture Overview](#3-architecture-overview)
4. [Phase 5 — Hardening & Observability](#4-phase-5--hardening--observability)
5. [Phase 6 — Backtesting Engine](#5-phase-6--backtesting-engine)
6. [Phase 7 — Portfolio Risk Management (Greeks Aggregation & VAR)](#6-phase-7--portfolio-risk-management)
7. [Phase 8 — Advanced Strategy Intelligence](#7-phase-8--advanced-strategy-intelligence)
8. [Phase 9 — Multi-Broker Migration (MANDATORY)](#8-phase-9--multi-broker-migration)
9. [Phase 10 — Paper Trading & Shadow Mode](#9-phase-10--paper-trading--shadow-mode)
10. [Phase 11 — Performance Analytics & Reporting](#10-phase-11--performance-analytics--reporting)
11. [Risk Register](#11-risk-register)
12. [Dependency Graph & Critical Path](#12-dependency-graph--critical-path)
13. [First 2-Week Sprint Plan](#13-first-2-week-sprint-plan)
14. [Appendices](#14-appendices)

---

## 1. Executive Summary

Claxton is a fully automated options trading system that evaluates, enters, monitors, and exits multi-leg options strategies (iron condors, credit spreads, butterflies, iron flies, and wheel/CSP/CC) via the Tradier broker API. The system has been built in four phases and is currently trading live.

### What Exists (Phases 1–4 Complete)

| Phase | Subsystem | Key Files | Status |
|-------|-----------|-----------|--------|
| 1 | 9-stage deterministic pipeline (A–I) | `services/pipeline.py`, `services/liquidity_gate.py` | ✅ Live |
| 1 | Liquidity gate (5-factor) | `services/liquidity_gate.py` | ✅ Live |
| 1 | IVR regime gate | `services/ivr_calculator.py` | ✅ Live |
| 1 | DST-safe market hours | `services/pipeline.py:stage_h_execution()` | ✅ Live |
| 2 | EV_net scoring | `services/strategy_engine.py:_phase2_probability_and_ev_net()` | ✅ Live |
| 2 | POP/POT probability estimation | `services/probability.py` | ✅ Live |
| 2 | Credit-after-slippage model | `services/strategy_engine.py:_credit_after_slippage()` | ✅ Live |
| 2 | Friction model | `services/friction.py` | ✅ Live |
| 3 | RegimeService (EMA20, SMA50, ADX, VRP) | `services/regime.py` | ✅ Live |
| 3 | Trend classification & directional blocks | `services/regime.py:evaluate()` | ✅ Live |
| 3 | Per-strategy regime thresholds | `models/trading.py:Strategy` | ✅ Live |
| 4 | Wheel strategy (CSP→CC dual mode) | `strategies/wheel.py` | ✅ Live |
| 4 | Corporate actions guard | `services/corporate_actions.py`, `services/pipeline.py:stage_g_corporate_guard()` | ✅ Live |
| 4 | Dashboard integration | `claxton-dashboard/src/` | ✅ Live |

### What's Missing or Incomplete

| Area | Gap | Risk Level |
|------|-----|------------|
| Backtesting | No historical simulation engine | 🔴 HIGH — no way to validate strategy changes pre-deployment |
| Greeks aggregation / VAR | `RiskManager` exists but only gates new trades; no real-time portfolio P&L | 🔴 HIGH — blind to portfolio-level tail risk |
| Multi-broker | Hardcoded to Tradier; no abstraction layer | 🟡 MEDIUM — single point of failure, limited margin |
| Order reconciliation | `OrderReconciler` exists but `tick()` only called manually | 🟡 MEDIUM — stale trades can accumulate |
| Alerting | No Slack/Discord/email/SMS alerting on kill switch, partial fills, or PnL thresholds | 🟡 MEDIUM |
| Paper trading / shadow mode | No way to simulate trades without real money | 🟡 MEDIUM |
| Test coverage | Tests exist for pipeline, liquidity, IVR, regime, wheel, but no integration tests with mocked broker | 🟡 MEDIUM |
| Database migrations | SQL scripts exist but no formal migration runner | 🟢 LOW |
| CI/CD | No automated test pipeline on push | 🟡 MEDIUM |
| Logging rotation | `storage/audit_trail.jsonl` grows unbounded | 🟢 LOW |

---

## 2. Current System Audit

### 2.1 Python Engine File Map

```
claxton-quant-python/
├── api/
│   ├── __init__.py
│   ├── index.py                    # Vercel entry (unused on EC2)
│   └── main.py                     # FastAPI app (3299 lines) — all REST endpoints
├── models/
│   ├── __init__.py
│   └── trading.py                  # Core data models (Strategy, Position, TradeSignal, etc.)
├── services/
│   ├── __init__.py
│   ├── _execution_partial.py       # Emergency partial fill handler
│   ├── audit_logger.py             # Append-only JSONL audit trail
│   ├── calendar.py                 # Macro calendar stub generator
│   ├── config.py                   # Deterministic config service with test overrides
│   ├── corporate_actions.py        # Earnings/dividend data access
│   ├── db_backup.py                # Database backup utilities
│   ├── execution.py                # Walking limit order algorithm
│   ├── friction.py                 # Commission + slippage model
│   ├── iv_tracker.py               # VIX history recorder
│   ├── ivr_calculator.py           # IV Rank computation + regime gate
│   ├── liquidity_gate.py           # 5-factor liquidity gate
│   ├── logger.py                   # Structured logging
│   ├── market_data.py              # VIX term structure (deterministic)
│   ├── market_data_iv.py           # IV percentile from VIX
│   ├── mcp_intelligence.py         # MCP (optional AI intelligence layer)
│   ├── monitor.py                  # Legacy monitor (superseded by streaming)
│   ├── order_reconciler.py         # Broker-truth reconciliation
│   ├── panic.py                    # Nuclear flatten (aggressive limit orders)
│   ├── pipeline.py                 # 9-stage deterministic evaluation pipeline
│   ├── position_adapter.py         # Position data adapter
│   ├── probability.py              # Lognormal POP/POT/expected move
│   ├── regime.py                   # Phase 3 RegimeService (EMA/SMA/ADX/RSI/MACD/VRP)
│   ├── risk_manager.py             # Portfolio Greeks aggregation + caps
│   ├── strategy_engine.py          # Core entry scanning + exit evaluation (2083 lines)
│   ├── streaming_monitor.py        # WebSocket streaming exit monitor
│   ├── supabase_client.py          # Supabase REST client
│   └── tradier_api.py              # Tradier broker API client
├── strategies/
│   ├── base.py                     # Strategy base class (empty)
│   └── wheel.py                    # Wheel strategy (CSP/CC dual mode)
├── scripts/
│   ├── chaos_simulator.py          # Chaos/fault injection testing
│   ├── cleanup_bad_trades.py       # Data cleanup
│   ├── cleanup_stale_data.py       # Stale data removal
│   ├── fetch_market_events.py      # Macro event fetcher
│   ├── push_macro_windows.py       # Push macro calendar to engine
│   ├── restore_from_vault.py       # Recovery utility
│   └── seed_iv_history.py          # IV history cold-start seeder
├── storage/
│   ├── audit_trail.jsonl           # Append-only audit log
│   ├── iv_history/                 # Per-symbol IV JSON files
│   ├── iv_history_manifest.json    # Seed metadata
│   ├── macro_calendar.json         # Macro event calendar
│   └── vix_history.json            # Daily VIX recordings
└── tests/
    ├── conftest.py                 # Pytest fixtures
    ├── test_api_visibility.py      # API endpoint tests
    ├── test_ivr_calculator.py      # IVR tests
    ├── test_liquidity_gate.py      # Liquidity gate tests
    ├── test_pipeline.py            # Pipeline stage tests (comprehensive)
    ├── test_probability_engine.py  # Probability math tests
    ├── test_regime_logic.py        # Regime service tests
    ├── test_risk_engine.py         # Risk manager tests
    └── test_wheel_strategy.py      # Wheel strategy tests
```

### 2.2 Dashboard File Map

```
claxton-dashboard/src/
├── app/
│   ├── globals.css
│   ├── layout.tsx
│   ├── page.tsx                    # Main dashboard page
│   └── favicon.ico
├── components/dashboard/
│   ├── ActivityLog.tsx             # Real-time activity feed
│   ├── ControlsPanel.tsx           # Bot enable/disable, kill switch
│   ├── DataLagWarning.tsx          # Stale data indicator
│   ├── DecisionTraceLink.tsx       # Links to evaluation audit trail
│   ├── GreeksChart.tsx             # Greeks visualization
│   ├── Header.tsx                  # App header
│   ├── KPIStrip.tsx                # Key performance indicators
│   ├── MCPPanel.tsx                # MCP intelligence panel
│   ├── OptionsChain.tsx            # Live options chain viewer
│   ├── PnLChart.tsx                # P&L charting
│   ├── PositionsPanel.tsx          # Open positions display
│   ├── RecoveryPanel.tsx           # Recovery/cleanup tools
│   ├── StatusBadge.tsx             # Status indicators
│   ├── StatusRibbon.tsx            # System status ribbon
│   ├── StrategiesPanel.tsx         # Strategy configuration
│   ├── StrategyBuilder.tsx         # Visual strategy builder
│   ├── StrategyEvaluationPanel.tsx # Evaluation audit trail viewer
│   └── TradeJournal.tsx            # Trade history journal
├── services/
│   ├── apiBase.ts                  # API base URL config
│   ├── evaluationService.ts        # Evaluation CRUD (Supabase)
│   ├── settingsService.ts          # Global settings
│   ├── strategyEngine.ts           # Engine API client
│   ├── tradeJournal.ts             # Trade journal data
│   ├── tradierApi.ts               # Direct Tradier API (for UI)
│   └── tradierReconcile.ts         # Reconciliation helpers
├── types/
│   ├── evaluation.ts               # Evaluation/audit types
│   └── trading.ts                  # Core trading types
├── hooks/
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   └── useTradingData.ts           # Main data hook
├── integrations/supabase/
│   ├── client.ts                   # Supabase client init
│   └── types.ts                    # Generated DB types
└── lib/
    ├── closeInstruction.ts         # Close order instruction builder
    ├── legSideInference.ts         # Leg side inference logic
    ├── strategyLegs.ts             # Strategy leg helpers
    └── utils.ts                    # Utility functions
```

### 2.3 Supabase Schema (5 Tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `strategies` | Strategy configuration | `id`, `name`, `type`, `underlying`, `enabled`, `entry_conditions` (JSON), `exit_conditions` (JSON), `max_positions`, `position_size` |
| `trades` | Trade log (one row per leg) | `id`, `symbol`, `underlying`, `strategy_name`, `strategy_type`, `trade_group_id`, `open_order_id`, `close_order_id`, `entry_price`, `entry_credit`, `entry_credit_dollars`, `exit_debit`, `exit_debit_dollars`, `pnl`, `pnl_status`, `needs_reconcile`, `close_status` |
| `position_group_map` | Open position tracking | `id`, `trade_group_id`, `open_order_id`, `symbol`, `underlying`, `expiration`, `strategy_name`, `strategy_type`, `leg_qty`, `leg_side`, `entry_credit` |
| `strategy_evaluations` | Audit trail | `id`, `strategy_id`, `event_type`, `decision`, `reason`, `config_json`, `inputs_json`, `gates_json`, `proposed_order_json`, `trade_group_id` |
| `settings` | Global settings | `id`, `max_bid_ask_spread_percent`, `max_positions`, `max_daily_loss`, `zero_dte_close_buffer_minutes`, `fill_price_buffer_percent`, `max_condors_per_expiry` |
| `options_cache` | Options chain cache | `id`, `underlying`, `expiration`, `cache_type`, `data` (JSON), `expires_at` |

### 2.4 Environment Variables (Python Engine)

| Variable | Purpose |
|----------|---------|
| `TRADIER_API_TOKEN` | Broker API authentication |
| `TRADIER_ACCOUNT_ID` | Broker account identifier |
| `TRADIER_BASE_URL` | Broker endpoint (sandbox vs live) |
| `SUPABASE_URL` | Database endpoint |
| `SUPABASE_SERVICE_KEY` | Database authentication |
| `USE_MCP_INTELLIGENCE` | Enable/disable MCP AI layer |
| `USE_STREAMING` | WebSocket vs polling mode |
| `LIVE_TRADING` | Safety gate: sandbox vs production |
| `DISALLOW_MARKET_ORDERS` | Hard block on market orders |
| `TASKS_TOKEN` | Cron task authentication |
| `PORTFOLIO_MAX_ABS_DELTA_SHARES` | Risk cap |
| `PORTFOLIO_MAX_ABS_VEGA` | Risk cap |
| `PORTFOLIO_MAX_ABS_GAMMA` | Risk cap |

### 2.5 The 9-Stage Pipeline (Detailed)

The pipeline in `services/pipeline.py` runs stages A through H sequentially. Stage I (management/exits) is handled at runtime by the exit monitor.

```
┌─────────────────────────────────────────────────┐
│ Stage A: Universe & Data Availability            │
│   - Spot price > 0                               │
│   - Option expirations available                  │
│   File: pipeline.py:stage_a_universe()           │
├─────────────────────────────────────────────────┤
│ Stage B: Calendar/Event Gate                     │
│   - Not in macro event window (CPI, FOMC, etc.) │
│   File: pipeline.py:stage_b_calendar()           │
├─────────────────────────────────────────────────┤
│ Stage C: Liquidity Gate (5-factor)               │
│   - Bid/ask spread < threshold per leg           │
│   - Option volume >= minimum per leg             │
│   - Open interest >= minimum per leg             │
│   - Underlying volume >= % of average            │
│   - Quote age < max staleness                    │
│   File: liquidity_gate.py:run_full_liquidity_gate()│
├─────────────────────────────────────────────────┤
│ Stage D: Strategy Eligibility                    │
│   - min_dte <= DTE <= max_dte                    │
│   File: pipeline.py:stage_d_eligibility()        │
├─────────────────────────────────────────────────┤
│ Stage E: Regime Gate                             │
│   E1: VIX term structure (contango required)     │
│   E2: Trend + VRP (RegimeService)               │
│     - Negative VRP blocks credit selling         │
│     - Directional conflicts block spreads        │
│     - ADX > threshold blocks iron condors        │
│   E3: IVR regime (optional)                      │
│   File: pipeline.py:stage_e_regime_*()           │
│         regime.py:RegimeService.evaluate()       │
├─────────────────────────────────────────────────┤
│ Stage F: Structure Selection                     │
│   - Option chain has sufficient strikes          │
│   File: pipeline.py:stage_f_structure()          │
├─────────────────────────────────────────────────┤
│ Stage G: Corporate Guard + EV/Risk               │
│   G1: Earnings within window → BLOCK             │
│   G2: Ex-dividend near CC → BLOCK                │
│   G3: EV_net > 0 (POP-weighted)                 │
│   File: pipeline.py:stage_g_corporate_guard()    │
│         pipeline.py:stage_g_ev_risk()            │
├─────────────────────────────────────────────────┤
│ Stage H: Execution Constraints                   │
│   - Within market hours (DST-safe via zoneinfo)  │
│   - Not within last 30 minutes of close          │
│   File: pipeline.py:stage_h_execution()          │
├─────────────────────────────────────────────────┤
│ Stage I: Management & Exits (runtime)            │
│   - Profit target (%, $, trailing)               │
│   - Stop loss (%, $)                             │
│   - Time stop (DTE or clock time)                │
│   - VIX spike emergency exit                     │
│   - Persistence filter (N consecutive scans)     │
│   - Grace period (min holding time)              │
│   - Suspect mark guard (mid-price jump filter)   │
│   File: api/main.py:_run_exit_check()            │
│         streaming_monitor.py                     │
└─────────────────────────────────────────────────┘
```

### 2.6 Execution Flow

```
Entry Path:
  _run_entry_scan() [api/main.py]
    → _entries_allowed() [kill switch, macro calendar, bot toggle]
    → engine.scan_for_entries() [strategy_engine.py]
      → _within_entry_window() [DST-safe ET check]
      → get_regime_context() [VIX term structure + macro windows]
      → _select_{strategy_type}_by_ev() [structure selection]
        → _liquidity_gate() [5-factor check]
        → _credit_after_slippage() [slippage model]
        → _phase2_probability_and_ev_net() [POP/POT/EV_net]
        → _estimate_gamma_loss_1pct_usd() [convexity cap]
      → _passes_strategy_factory_filters() [IVR, MA, min premium]
      → _apply_sizing() [fixed or risk-based]
    → RiskManager.gate_new_trade() [portfolio Greeks cap]
    → engine.build_execution_plan() [walking limit parameters]
    → place_multileg_walking_limit() [execution.py]
      → tradier.place_multileg_order() [broker call]
      → Poll/cancel/walk cycle
    → supabase.log_trade_entry() [persist to DB]
    → OrderReconciler.reconcile_entry() [verify fill]

Exit Path:
  _run_exit_check() [api/main.py] or StreamingExitMonitor
    → Fetch positions from position_group_map
    → Get broker positions + quotes
    → Calculate group P&L (mark-based)
    → Apply exit guards:
      - Grace period (MIN_HOLDING_SECONDS)
      - Suspect mark guard (SUSPECT_MARK_JUMP_FRACTION)
      - Persistence filter (STOP_PERSISTENCE_SCANS)
    → tradier.precheck_close() [safety pre-check]
    → tradier.place_combo_close_order() [limit close]
    → VIX spike emergency escalation (limit → market fallback)
    → Update trades table (close_status=submitted)
    → OrderReconciler.reconcile_close() [verify close fill, compute P&L]
```

---

## 3. Architecture Overview

### 3.1 System Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                        EC2 Instance                          │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              FastAPI Application (main.py)           │    │
│  │                                                       │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │    │
│  │  │ Entry    │  │ Exit     │  │ Kill Switch /    │  │    │
│  │  │ Scanner  │  │ Monitor  │  │ Panic Flatten    │  │    │
│  │  └─────┬────┘  └────┬─────┘  └────────┬─────────┘  │    │
│  │        │             │                  │             │    │
│  │  ┌─────▼─────────────▼──────────────────▼─────────┐  │    │
│  │  │            Strategy Engine                      │  │    │
│  │  │  ┌──────────┐ ┌───────┐ ┌────────┐ ┌───────┐ │  │    │
│  │  │  │ Pipeline │ │Regime │ │Liquidity│ │  EV   │ │  │    │
│  │  │  │ (A→H)   │ │Service│ │  Gate   │ │Scoring│ │  │    │
│  │  │  └──────────┘ └───────┘ └────────┘ └───────┘ │  │    │
│  │  │  ┌──────────┐ ┌───────┐ ┌────────┐ ┌───────┐ │  │    │
│  │  │  │Probability│ │  IVR  │ │Corporate│ │ Risk  │ │  │    │
│  │  │  │  Engine  │ │ Calc  │ │ Actions │ │Manager│ │  │    │
│  │  │  └──────────┘ └───────┘ └────────┘ └───────┘ │  │    │
│  │  └────────────────────┬───────────────────────────┘  │    │
│  │                       │                               │    │
│  │  ┌────────────────────▼───────────────────────────┐  │    │
│  │  │           Execution Layer                       │  │    │
│  │  │  ┌──────────────┐  ┌────────────────────────┐ │  │    │
│  │  │  │Walking Limit │  │Order Reconciler        │ │  │    │
│  │  │  │  Algorithm   │  │(broker-truth sync)     │ │  │    │
│  │  │  └──────┬───────┘  └────────────┬───────────┘ │  │    │
│  │  └─────────┼───────────────────────┼──────────────┘  │    │
│  └────────────┼───────────────────────┼──────────────────┘    │
│               │                       │                        │
│  ┌────────────▼───────────────────────▼──────────────────┐    │
│  │               Tradier API Client                       │    │
│  │  (tradier_api.py — market orders blocked by default)   │    │
│  └────────────────────────┬──────────────────────────────┘    │
└───────────────────────────┼──────────────────────────────────┘
                            │
            ┌───────────────▼───────────────┐
            │        Tradier Broker         │
            │  (sandbox or live endpoint)    │
            └───────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                      Supabase (PostgreSQL)                     │
│  Tables: strategies, trades, position_group_map,              │
│          strategy_evaluations, settings, options_cache         │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│                   Vercel (Dashboard)                           │
│  Next.js app → REST calls to EC2 API + direct Supabase reads  │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 Data Flow

1. **Strategies** are configured in Supabase via the Dashboard UI
2. **Entry scanner** (60s interval) loads enabled strategies, runs pipeline gates
3. **Regime context** checked via VIX/VIX3M quotes (deterministic) + RegimeService (EMA/SMA/ADX/VRP)
4. **Structure selection** picks strikes by delta targeting from Tradier option chains
5. **EV scoring** computes POP/POT via lognormal model, EV_net must be positive
6. **Execution** uses walking limit algorithm (start at mid, walk toward worst acceptable)
7. **Exit monitor** (streaming WebSocket or 60s polling) tracks mark prices and applies profit/stop/time rules
8. **Reconciler** syncs DB with broker fill truth (entry fills, close fills, P&L computation)

---

## 4. Phase 5 — Hardening & Observability

**Goal:** Make the system production-hardened before adding new features. Every dollar-impacting bug is a priority.

### 5.1 Automated Reconciliation Loop

**Current State:** `OrderReconciler.tick()` exists in `services/order_reconciler.py` but is only called manually via API endpoint.

**Problem:** If the entry scanner opens a position and the reconciler isn't called, `trades` rows remain with `entry_price=0` and `needs_reconcile=True` indefinitely. Close fills may also sit in `close_status=submitted` forever.

**Task 5.1.1: Periodic Reconciliation Background Task**

```python
# File: api/main.py (add to background monitor loop)
# Location: After _run_exit_check() in the main monitor loop

RECONCILER_INTERVAL_SECONDS = 120  # Every 2 minutes

async def _run_reconciliation_tick():
    """Periodic reconciliation of pending orders."""
    if not tradier or not supabase:
        return
    from services.order_reconciler import OrderReconciler
    reconciler = OrderReconciler(tradier, supabase)
    result = await reconciler.tick()
    if result.get('results'):
        for r in result['results']:
            if r.get('error'):
                log.error('reconciler_tick_error', extra=r)
```

**Acceptance Criteria:**
- [ ] `reconciler.tick()` runs every 120 seconds during market hours
- [ ] Pending entry orders with `entry_price=0` are reconciled within 5 minutes
- [ ] Pending close orders with `close_status=submitted` are reconciled within 5 minutes
- [ ] P&L is computed from actual fill prices (not mark-based estimates)
- [ ] `position_group_map` entries are deleted only after broker confirms close fill

**Test Plan:**
```python
# tests/test_reconciler_integration.py
async def test_reconciler_fills_entry_price():
    """Mock tradier.get_order() returning filled status with avg_fill_price.
    Assert reconciler patches trades with correct entry_price."""

async def test_reconciler_computes_pnl_on_close():
    """Mock close order as filled. Assert primary leg gets P&L,
    non-primary legs get pnl=0, and pnl_formula is correct."""

async def test_reconciler_handles_rejected_entry():
    """Mock entry order as rejected. Assert trades are marked with
    ENTRY_REJECTED notes and position_group_map is deleted."""
```

**Rollback:** Remove the background task call. Reconciler remains available via manual API endpoint.

---

### 5.2 Alerting System

**Current State:** No alerting. Kill switch trips, partial fills, and daily P&L thresholds are logged but not pushed anywhere.

**Task 5.2.1: Alert Service Interface**

```python
# File: services/alerts.py (NEW)

from __future__ import annotations
from typing import Optional, Dict, Any
from enum import Enum

class AlertSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"

class AlertChannel(str, Enum):
    TELEGRAM = "telegram"
    DISCORD = "discord"
    EMAIL = "email"

async def send_alert(
    severity: AlertSeverity,
    title: str,
    message: str,
    *,
    channel: AlertChannel = AlertChannel.TELEGRAM,
    details: Optional[Dict[str, Any]] = None,
    trade_group_id: Optional[str] = None,
) -> bool:
    """Send alert to configured channel."""
    # Implementation: HTTP webhook (Telegram Bot API, Discord webhook, or email)
    ...
```

**Task 5.2.2: Alert Triggers**

| Trigger | Severity | Location | Current Code |
|---------|----------|----------|--------------|
| Kill switch tripped | CRITICAL | `api/main.py:_maybe_trip_kill_switch()` | `audit_event('kill_switch_tripped', ...)` |
| Panic flatten executed | CRITICAL | `services/panic.py:panic_flatten_all()` | `audit_event('panic_flatten_all_start', ...)` |
| VIX spike emergency exit | CRITICAL | `api/main.py:_run_exit_check()` (vix_spike path) | `audit_event('emergency_vix_spike_exit', ...)` |
| Partial fill not resolved | CRITICAL | `services/execution.py` | `audit_event('partial_fill_not_resolved', ...)` |
| Position mismatch | CRITICAL | `tradier_api.py:precheck_close()` | Raises RuntimeError |
| Daily loss threshold | WARNING | Not implemented | — |
| Trade opened | INFO | `api/main.py:_run_entry_scan()` | Print statement |
| Trade closed | INFO | `api/main.py:_run_exit_check()` | Print statement |

**Acceptance Criteria:**
- [ ] Kill switch, panic flatten, and VIX spike alerts are sent within 5 seconds
- [ ] Alert includes trade_group_id, strategy name, and P&L if applicable
- [ ] Alert system failure does not block trading operations (fire-and-forget)
- [ ] Daily P&L summary sent at market close (4:15 PM ET)

**Deliverables:**
- `services/alerts.py` — Alert service with Telegram webhook
- Modify `api/main.py` — Add alert calls at each trigger point
- Config: `ALERT_TELEGRAM_BOT_TOKEN`, `ALERT_TELEGRAM_CHAT_ID` env vars

---

### 5.3 Structured Logging & Log Rotation

**Current State:** `services/logger.py` provides structured logging. `audit_trail.jsonl` grows unbounded.

**Task 5.3.1: Log Rotation**

```python
# File: services/audit_logger.py (modify)
# Add rotation: when file exceeds 50MB, rotate to audit_trail.{date}.jsonl.gz

import gzip
from pathlib import Path

MAX_AUDIT_FILE_SIZE_MB = 50

def _rotate_if_needed():
    if AUDIT_PATH.exists() and AUDIT_PATH.stat().st_size > MAX_AUDIT_FILE_SIZE_MB * 1024 * 1024:
        ts = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
        archive = AUDIT_PATH.parent / f"audit_trail.{ts}.jsonl.gz"
        with open(AUDIT_PATH, 'rb') as f_in:
            with gzip.open(archive, 'wb') as f_out:
                f_out.writelines(f_in)
        AUDIT_PATH.write_text('')
```

**Task 5.3.2: Structured Log Fields**

Add correlation IDs to all log messages:
- `trade_group_id` — links all events for a single trade lifecycle
- `scan_id` — links all events within a single entry scan
- `session_id` — links all events within a single process lifecycle

---

### 5.4 CI/CD Pipeline

**Task 5.4.1: GitHub Actions Workflow**

```yaml
# File: .github/workflows/test.yml (NEW)
name: Test Suite
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt
      - run: pip install pytest pytest-asyncio
      - run: python -m pytest tests/ -v --tb=short
```

**Acceptance Criteria:**
- [ ] All existing tests pass in CI
- [ ] PR merges blocked if tests fail
- [ ] Test run completes in < 60 seconds

---

### 5.5 Health Check & Liveness Probe

**Current State:** No health check endpoint beyond `/api/status`.

**Task 5.5.1: Comprehensive Health Endpoint**

```python
# File: api/main.py (add endpoint)

@app.get("/api/health")
async def health_check():
    """Deep health check for monitoring."""
    checks = {}
    
    # Tradier connectivity
    try:
        q = await tradier.get_quote("SPY")
        checks["tradier"] = {"ok": bool(q.get("last")), "last": q.get("last")}
    except Exception as e:
        checks["tradier"] = {"ok": False, "error": str(e)}
    
    # Supabase connectivity
    try:
        strats = await supabase.get_strategies(enabled_only=False)
        checks["supabase"] = {"ok": True, "strategies": len(strats)}
    except Exception as e:
        checks["supabase"] = {"ok": False, "error": str(e)}
    
    # Monitor status
    checks["monitor"] = {
        "running": _monitor_running,
        "streaming": streaming_monitor.is_connected if streaming_monitor else False,
    }
    
    # Kill switch
    checks["kill_switch"] = {
        "active": _kill_switch_active,
        "mode": _kill_switch_mode,
    }
    
    all_ok = all(c.get("ok", True) for c in checks.values() if isinstance(c, dict) and "ok" in c)
    return {"healthy": all_ok, "checks": checks}
```

---

### 5.6 Graceful Shutdown

**Current State:** No graceful shutdown handling. Background tasks may be interrupted mid-execution.

**Task 5.6.1: SIGTERM Handler**

```python
# File: api/main.py (add to startup)
import signal

@app.on_event("shutdown")
async def shutdown_event():
    """Graceful shutdown: stop monitor, cancel pending scans."""
    global _monitor_running
    _monitor_running = False
    if streaming_monitor:
        await streaming_monitor.stop()
    log.info("graceful_shutdown_complete")
```

---

### Phase 5 Gate Criteria

| Gate | Criteria | Verification |
|------|----------|--------------|
| G5.1 | Reconciler runs automatically every 2 minutes | Check audit_trail.jsonl for reconciler_tick events |
| G5.2 | Alerts sent on kill switch trip | Trigger kill switch in sandbox, verify Telegram message |
| G5.3 | Audit log rotates at 50MB | Generate 51MB of audit events, verify rotation |
| G5.4 | All tests pass in CI | GitHub Actions green on main branch |
| G5.5 | Health endpoint returns all checks | `curl /api/health` returns tradier/supabase/monitor status |

---

## 5. Phase 6 — Backtesting Engine

**Goal:** Enable historical validation of strategy parameters before live deployment.

### 6.1 Architecture

```
┌──────────────────────────────────────────────────┐
│              Backtesting Engine                    │
│                                                    │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────┐ │
│  │ Data Loader │→│ Event Engine  │→│ Report  │ │
│  │ (historical)│  │ (sim broker) │  │Generator│ │
│  └─────────────┘  └──────────────┘  └─────────┘ │
│                                                    │
│  Data Sources:                                     │
│  - CBOE DataShop (options historical)              │
│  - yfinance (underlying prices)                    │
│  - Tradier historical (if available)               │
│                                                    │
│  Reuses:                                           │
│  - pipeline.py gates (A–H)                         │
│  - regime.py indicators                            │
│  - probability.py math                             │
│  - friction.py cost model                          │
└──────────────────────────────────────────────────┘
```

### 6.2 Implementation

**Task 6.2.1: Historical Data Loader**

```python
# File: backtesting/data_loader.py (NEW)

from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional
import json

@dataclass
class HistoricalBar:
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: int

@dataclass
class HistoricalOptionSnapshot:
    """Options chain snapshot at a point in time."""
    date: date
    underlying: str
    spot: float
    vix: float
    vix3m: float
    options: List[Dict]  # Same format as Tradier option chain
    
class DataLoader:
    def __init__(self, data_dir: str = "backtesting/data"):
        self.data_dir = data_dir
    
    async def load_underlying_bars(
        self, symbol: str, start: date, end: date
    ) -> List[HistoricalBar]:
        """Load OHLCV bars from local cache or yfinance."""
        ...
    
    async def load_option_snapshots(
        self, symbol: str, start: date, end: date
    ) -> List[HistoricalOptionSnapshot]:
        """Load historical option chain snapshots."""
        ...
    
    async def load_vix_history(
        self, start: date, end: date
    ) -> Dict[date, float]:
        """Load VIX daily values."""
        ...
```

**Task 6.2.2: Simulated Broker**

```python
# File: backtesting/sim_broker.py (NEW)

from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import date

@dataclass
class SimOrder:
    id: str
    underlying: str
    legs: List[Dict]
    order_type: str
    price: float
    status: str = "pending"
    fill_price: Optional[float] = None

@dataclass 
class SimBrokerState:
    cash: float = 100_000.0
    positions: Dict[str, int] = field(default_factory=dict)
    orders: List[SimOrder] = field(default_factory=list)
    fills: List[Dict] = field(default_factory=list)

class SimBroker:
    """Simulated broker for backtesting.
    
    Implements the same interface as TradierAPI for interchangeability.
    Fill model: midpoint with configurable slippage.
    """
    
    def __init__(
        self,
        initial_cash: float = 100_000.0,
        slippage_pct: float = 0.5,
        commission_per_contract: float = 0.65,
    ):
        self.state = SimBrokerState(cash=initial_cash)
        self.slippage_pct = slippage_pct
        self.commission = commission_per_contract
        self._current_snapshot = None
    
    def set_market_snapshot(self, snapshot):
        """Set current market state for fill simulation."""
        self._current_snapshot = snapshot
    
    async def get_quote(self, symbol: str) -> Dict:
        """Return simulated quote from current snapshot."""
        ...
    
    async def get_option_chain(self, symbol: str, expiration: str, greeks: bool = True) -> List[Dict]:
        """Return simulated option chain from current snapshot."""
        ...
    
    async def place_multileg_order(self, underlying: str, legs: List[Dict], **kwargs) -> Dict:
        """Simulate order fill using midpoint + slippage."""
        ...
    
    async def get_positions(self) -> List[Dict]:
        """Return current simulated positions."""
        ...
```

**Task 6.2.3: Backtest Runner**

```python
# File: backtesting/runner.py (NEW)

from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Dict, Optional

@dataclass
class BacktestConfig:
    strategy_config: Dict          # Same format as Supabase strategy row
    start_date: date
    end_date: date
    initial_capital: float = 100_000.0
    slippage_pct: float = 0.5
    commission_per_contract: float = 0.65

@dataclass
class BacktestResult:
    total_trades: int
    winning_trades: int
    losing_trades: int
    total_pnl: float
    max_drawdown: float
    max_drawdown_pct: float
    sharpe_ratio: float
    sortino_ratio: float
    win_rate: float
    avg_winner: float
    avg_loser: float
    profit_factor: float
    avg_days_in_trade: float
    equity_curve: List[float]
    trade_log: List[Dict]
    daily_pnl: Dict[str, float]

class BacktestRunner:
    """Run a strategy backtest over historical data.
    
    Reuses the existing pipeline gates and strategy engine logic
    with a simulated broker and historical data.
    """
    
    async def run(self, config: BacktestConfig) -> BacktestResult:
        """Execute backtest."""
        data_loader = DataLoader()
        sim_broker = SimBroker(
            initial_cash=config.initial_capital,
            slippage_pct=config.slippage_pct,
            commission_per_contract=config.commission_per_contract,
        )
        
        # Create engine with sim broker
        engine = StrategyEngine(tradier=sim_broker)
        
        # Iterate over trading days
        bars = await data_loader.load_underlying_bars(
            config.strategy_config['underlying'],
            config.start_date,
            config.end_date,
        )
        
        for bar in bars:
            # Set market state
            snapshot = await data_loader.load_option_snapshots(...)
            sim_broker.set_market_snapshot(snapshot)
            
            # Run entry scan (reuses pipeline)
            strategy = build_strategy_from_config(config.strategy_config)
            signals = await engine.scan_for_entries(strategy, existing_positions)
            
            # Process fills
            # Check exits
            ...
        
        return self._compile_results(sim_broker)
```

**Task 6.2.4: API Endpoints**

```python
# File: api/main.py (add endpoints)

@app.post("/api/backtest/run")
async def run_backtest(config: BacktestConfigModel) -> ApiResponse:
    """Run a backtest with given strategy config."""
    ...

@app.get("/api/backtest/results/{backtest_id}")
async def get_backtest_results(backtest_id: str) -> ApiResponse:
    """Get backtest results."""
    ...
```

### 6.3 Data Sourcing

| Source | Data Type | Cost | Granularity | Notes |
|--------|-----------|------|-------------|-------|
| yfinance | Underlying OHLCV | Free | Daily | Reliable for SPY, QQQ, etc. |
| CBOE DataShop | Historical options | Paid ($) | End-of-day | Gold standard for options data |
| Tradier Historical | Options chains | Free (with account) | End-of-day | Limited history depth |
| `storage/iv_history/` | IV snapshots | Already collected | Daily | Use for IVR backtesting |
| `storage/vix_history.json` | VIX daily | Already collected | Daily | Use for regime backtesting |

### Phase 6 Gate Criteria

| Gate | Criteria | Verification |
|------|----------|--------------|
| G6.1 | Backtest runs end-to-end for SPY iron condor over 1 year | `pytest tests/test_backtest_integration.py` |
| G6.2 | Results match expected metrics (win rate, PnL within 10% of manual calc) | Manual spot-check of 10 trades |
| G6.3 | Pipeline gates fire identically in backtest vs live | Compare gate reasons for same market snapshot |
| G6.4 | API endpoint returns results within 60 seconds for 1-year test | Load test |

---

## 6. Phase 7 — Portfolio Risk Management

**Goal:** Real-time portfolio-level risk monitoring with Greeks aggregation, Value-at-Risk (VAR), and automatic hedging triggers.

### 7.1 Current State

The `RiskManager` in `services/risk_manager.py` provides:
- `snapshot()` — Aggregate net delta, gamma, vega across positions
- `would_breach()` — Check against delta/gamma/vega caps
- `gate_new_trade()` — Block new trades that would breach caps

**Gap:** The risk manager only runs at entry time. There is no continuous monitoring, no VAR computation, no correlation-adjusted risk, and no beta-weighted delta normalization.

### 7.2 Enhanced Risk Book

**Task 7.2.1: Real-Time Risk Monitor**

```python
# File: services/risk_book.py (NEW)

from dataclasses import dataclass
from typing import Dict, List, Optional
import math

@dataclass
class PortfolioRiskSnapshot:
    """Point-in-time portfolio risk assessment."""
    timestamp: str
    
    # Greeks (share-equivalent)
    net_delta_shares: float
    net_gamma_shares_per_dollar: float
    net_vega_usd_per_1vol: float
    net_theta_usd_per_day: float
    
    # Beta-weighted (SPY-normalized)
    beta_weighted_delta: float
    
    # Scenario analysis
    pnl_1pct_up: float      # Portfolio P&L if underlying moves +1%
    pnl_1pct_down: float     # Portfolio P&L if underlying moves -1%
    pnl_2pct_up: float       # +2%
    pnl_2pct_down: float     # -2%
    pnl_5pct_down: float     # -5% (crash scenario)
    
    # VaR (1-day, 95% confidence)
    var_95_1d: float
    var_99_1d: float
    
    # Concentration
    max_single_position_pct: float
    max_single_underlying_pct: float
    
    # Caps status
    delta_utilization_pct: float
    gamma_utilization_pct: float
    vega_utilization_pct: float
    
    breaches: List[str]

class PortfolioRiskBook:
    """Continuous portfolio risk monitoring.
    
    Computes Greeks, VAR, and scenario P&L from live positions.
    """
    
    def __init__(self, caps: 'RiskCaps'):
        self.caps = caps
        self._history: List[PortfolioRiskSnapshot] = []
    
    def compute_snapshot(
        self, positions: List['Position'], spot_prices: Dict[str, float]
    ) -> PortfolioRiskSnapshot:
        """Compute current portfolio risk snapshot."""
        ...
    
    def compute_var_parametric(
        self, net_delta: float, net_gamma: float, net_vega: float,
        underlying_vol: float, vix_vol: float,
        confidence: float = 0.95, horizon_days: int = 1,
    ) -> float:
        """Parametric VAR using delta-gamma approximation.
        
        VAR ≈ |delta * σ_underlying * z_α| + 0.5 * |gamma * (σ_underlying * z_α)²|
        """
        z = {0.95: 1.645, 0.99: 2.326}.get(confidence, 1.645)
        sigma_move = underlying_vol * math.sqrt(horizon_days / 252.0)
        
        delta_var = abs(net_delta * sigma_move * z)
        gamma_var = 0.5 * abs(net_gamma * (sigma_move * z) ** 2)
        
        return delta_var + gamma_var
    
    def compute_beta_weighted_delta(
        self, positions: List['Position'], spot_prices: Dict[str, float],
        betas: Dict[str, float],
    ) -> float:
        """Beta-weighted delta normalized to SPY equivalent shares."""
        ...
    
    def scenario_pnl(
        self, positions: List['Position'], pct_move: float,
        spot_prices: Dict[str, float],
    ) -> float:
        """Estimate portfolio P&L for a given % move in underlying.
        
        Uses delta-gamma approximation:
        ΔP ≈ delta * ΔS + 0.5 * gamma * ΔS²
        """
        ...
```

**Task 7.2.2: Risk Dashboard Widget**

```typescript
// File: src/components/dashboard/RiskBook.tsx (NEW)

interface RiskBookProps {
  snapshot: PortfolioRiskSnapshot;
}

export function RiskBook({ snapshot }: RiskBookProps) {
  return (
    <Card>
      <CardHeader>Portfolio Risk</CardHeader>
      <CardContent>
        {/* Greeks gauges */}
        {/* VAR display */}
        {/* Scenario P&L table */}
        {/* Utilization bars */}
      </CardContent>
    </Card>
  );
}
```

**Task 7.2.3: Automatic Risk Reduction Triggers**

```python
# File: services/risk_book.py (add to PortfolioRiskBook)

async def check_risk_triggers(
    self, snapshot: PortfolioRiskSnapshot
) -> List[Dict]:
    """Check for automatic risk reduction triggers.
    
    Triggers:
    1. Delta > 80% of cap → alert (WARNING)
    2. Delta > 100% of cap → block new entries (kill switch)
    3. VAR_99 > max_daily_loss → block new entries
    4. Single position > 30% of portfolio → alert
    """
    ...
```

### Phase 7 Gate Criteria

| Gate | Criteria |
|------|----------|
| G7.1 | Greeks aggregation matches manual calculation for 3 test portfolios |
| G7.2 | VAR computation within 10% of Monte Carlo simulation benchmark |
| G7.3 | Risk dashboard updates every 60 seconds |
| G7.4 | Auto-block triggers when delta > cap |

---

## 7. Phase 8 — Advanced Strategy Intelligence

**Goal:** Improve trade selection quality with advanced analysis.

### 8.1 Implied Volatility Surface Analysis

**Current State:** IV is estimated from ATM options average (`ivr_calculator.py:fetch_and_store_iv_from_tradier()`). No IV surface, no skew analysis.

**Task 8.1.1: IV Surface Builder**

```python
# File: services/iv_surface.py (NEW)

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
from datetime import date

@dataclass
class IVPoint:
    strike: float
    expiration: date
    iv: float
    delta: float
    option_type: str  # "call" or "put"

@dataclass
class IVSurface:
    underlying: str
    spot: float
    timestamp: str
    points: List[IVPoint]
    
    def skew_25delta(self, expiration: date) -> Optional[float]:
        """25-delta skew = IV(25d put) - IV(25d call)."""
        ...
    
    def term_structure(self) -> Dict[date, float]:
        """ATM IV by expiration."""
        ...
    
    def smile_width(self, expiration: date) -> Optional[float]:
        """Width of smile: IV(10d) - IV(ATM)."""
        ...

async def build_iv_surface(tradier, symbol: str) -> IVSurface:
    """Build IV surface from all available expirations."""
    ...
```

### 8.2 Smart Strike Selection

**Current State:** Strike selection uses simple delta targeting (`strategy_engine.py:_find_strike_by_delta()`).

**Task 8.2.1: Skew-Aware Strike Selection**

```python
# File: services/strategy_engine.py (modify _select_iron_condor_by_ev)

# Add to strike selection logic:
# 1. If put skew is elevated (>2 vol pts above call skew), widen put wing
# 2. If term structure is inverted at target expiration, prefer shorter DTE
# 3. Use volume-weighted strikes (avoid strikes with zero OI)
```

### 8.3 Dynamic DTE Selection

**Current State:** Fixed min_dte/max_dte from strategy config.

**Task 8.3.1: Regime-Aware DTE**

```python
# Strategy-level config additions:
# - In high-VIX environments (VIX > 25): prefer shorter DTE (more theta decay)
# - In low-VIX environments (VIX < 15): prefer longer DTE (more premium)
# - Near earnings: skip to post-earnings expiration

def optimal_dte(strategy: Strategy, vix: float, earnings_date: Optional[date]) -> Tuple[int, int]:
    """Return adjusted (min_dte, max_dte) based on market conditions."""
    base_min, base_max = strategy.min_dte, strategy.max_dte
    
    if vix > 25:
        return (max(14, base_min - 10), max(30, base_max - 15))
    elif vix < 15:
        return (base_min, min(90, base_max + 15))
    
    return (base_min, base_max)
```

### Phase 8 Gate Criteria

| Gate | Criteria |
|------|----------|
| G8.1 | IV surface correctly identifies put skew for SPY |
| G8.2 | Skew-adjusted strikes produce better EV in backtest |
| G8.3 | Dynamic DTE shows improved Sharpe ratio in backtest |

---

## 8. Phase 9 — Multi-Broker Migration (MANDATORY)

> ⚠️ **This is a MANDATORY first-class section, not an appendix.**  
> Broker diversification is critical for operational resilience, margin optimization, and feature access.

### 9.1 Motivation

| Factor | Tradier | Interactive Brokers | Schwab/TDA | Tastytrade |
|--------|---------|---------------------|------------|------------|
| **API Quality** | Good REST, basic streaming | TWS API (Java/Python), robust | REST (migrated from TDA) | REST API (open) |
| **Commissions** | $0.35/contract (with plan) | $0.65/contract | $0.65/contract | $0.00 for opening |
| **Margin** | Reg-T | Portfolio margin available | Reg-T | Reg-T + reduced margin |
| **Greeks Data** | Yes (greeks endpoint) | Comprehensive | Yes | Yes |
| **Multi-leg Orders** | Yes (multileg class) | Yes (combo orders) | Yes | Yes |
| **Paper Trading** | Sandbox endpoint | TWS Paper account | No | No |
| **Streaming** | WebSocket (basic) | Full market data streaming | Limited | WebSocket |
| **Historical Data** | Limited | Extensive | Good | Limited |
| **Status** | ✅ Implemented | 🔴 Not started | 🔴 Not started | 🔴 Not started |

### 9.2 Broker Abstraction Layer

**Task 9.2.1: Broker Interface**

```python
# File: brokers/base.py (NEW)

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Optional, Any

@dataclass
class BrokerConfig:
    name: str
    api_key: str
    account_id: str
    base_url: str
    live_trading: bool = False
    paper_trading: bool = True

class BrokerInterface(ABC):
    """Abstract broker interface.
    
    All broker implementations must provide these methods.
    The existing TradierAPI already conforms to most of this interface.
    """
    
    @abstractmethod
    async def get_quote(self, symbol: str) -> Dict:
        """Get quote for underlying symbol."""
        ...
    
    @abstractmethod
    async def get_quotes(self, symbols: List[str]) -> List[Dict]:
        """Get quotes for multiple symbols."""
        ...
    
    @abstractmethod
    async def get_option_chain(
        self, symbol: str, expiration: str, greeks: bool = True
    ) -> List[Dict]:
        """Get option chain with optional greeks."""
        ...
    
    @abstractmethod
    async def get_option_expirations(self, symbol: str) -> List[str]:
        """Get available option expirations (YYYY-MM-DD strings)."""
        ...
    
    @abstractmethod
    async def get_account_balance(self) -> Dict:
        """Get account balance/buying power."""
        ...
    
    @abstractmethod
    async def get_positions(self) -> List[Dict]:
        """Get all open positions."""
        ...
    
    @abstractmethod
    async def get_orders(self, include_tags: bool = True) -> List[Dict]:
        """Get all orders."""
        ...
    
    @abstractmethod
    async def get_order(self, order_id: str) -> Dict:
        """Get specific order by ID."""
        ...
    
    @abstractmethod
    async def place_multileg_order(
        self, underlying: str, legs: List[Dict],
        order_type: str = "credit", price: Optional[float] = None,
        duration: str = "day", tag: Optional[str] = None,
    ) -> Dict:
        """Place multi-leg option order."""
        ...
    
    @abstractmethod
    async def place_combo_close_order(
        self, underlying: str, legs: List[Dict],
        order_type: str = "credit", price: Optional[float] = None,
        duration: str = "day",
        allow_market_override: bool = False,
    ) -> Dict:
        """Close multi-leg position."""
        ...
    
    @abstractmethod
    async def cancel_order(self, order_id: str) -> bool:
        """Cancel an order."""
        ...
    
    @abstractmethod
    async def place_option_order(
        self, option_symbol: str, side: str, quantity: int = 1,
        order_type: str = "limit", price: Optional[float] = None,
        duration: str = "day", tag: Optional[str] = None,
        allow_market_override: bool = False,
    ) -> Dict:
        """Place single-leg option order."""
        ...
    
    @abstractmethod
    async def precheck_close(
        self, *, legs: List[Dict], trade_group_id: str
    ) -> None:
        """Safety pre-check before close order."""
        ...
    
    @abstractmethod
    def parse_option_symbol(self, symbol: str) -> Dict:
        """Parse OCC option symbol."""
        ...
    
    @abstractmethod
    def build_option_symbol(
        self, underlying: str, expiration: date,
        option_type: str, strike: float,
    ) -> str:
        """Build OCC option symbol."""
        ...
    
    # Optional streaming interface
    async def create_streaming_session(self) -> str:
        raise NotImplementedError("Streaming not supported by this broker")
```

**Task 9.2.2: Tradier Adapter**

```python
# File: brokers/tradier.py (NEW — wraps existing tradier_api.py)

from brokers.base import BrokerInterface, BrokerConfig
from services.tradier_api import TradierAPI, TradierConfig

class TradierBroker(BrokerInterface):
    """Tradier broker adapter.
    
    Wraps existing TradierAPI to conform to BrokerInterface.
    This is the reference implementation.
    """
    
    def __init__(self, config: BrokerConfig):
        tradier_config = TradierConfig(
            api_token=config.api_key,
            account_id=config.account_id,
            base_url=config.base_url,
            live_trading=config.live_trading,
        )
        self._api = TradierAPI(tradier_config)
    
    async def get_quote(self, symbol: str) -> Dict:
        return await self._api.get_quote(symbol)
    
    # ... delegate all methods to self._api
```

**Task 9.2.3: Interactive Brokers Adapter**

```python
# File: brokers/ibkr.py (NEW)

from brokers.base import BrokerInterface, BrokerConfig
from ib_insync import IB, Stock, Option, MarketOrder, LimitOrder, ComboLeg

class IBKRBroker(BrokerInterface):
    """Interactive Brokers adapter using ib_insync.
    
    Key differences from Tradier:
    1. Uses TWS/Gateway connection (not REST)
    2. Option symbols use IB's contract format (not OCC)
    3. Requires local TWS/Gateway running
    4. Supports portfolio margin
    5. Has native combo orders
    
    Symbol mapping:
    - IB uses: Symbol, Exchange, Currency, LastTradeDateOrContractMonth, Strike, Right
    - OCC format: SPY260115C00580000
    - Must convert between formats
    """
    
    def __init__(self, config: BrokerConfig):
        self.ib = IB()
        self.config = config
    
    async def connect(self):
        """Connect to TWS/Gateway."""
        await self.ib.connectAsync(
            host=self.config.base_url or '127.0.0.1',
            port=7497 if self.config.paper_trading else 7496,
            clientId=1,
        )
    
    async def get_quote(self, symbol: str) -> Dict:
        """Get quote using IB market data."""
        contract = Stock(symbol, 'SMART', 'USD')
        self.ib.qualifyContracts(contract)
        ticker = self.ib.reqMktData(contract)
        await asyncio.sleep(2)  # Wait for data
        return {
            'symbol': symbol,
            'last': ticker.last,
            'bid': ticker.bid,
            'ask': ticker.ask,
            'volume': ticker.volume,
        }
    
    async def get_option_chain(self, symbol: str, expiration: str, greeks: bool = True) -> List[Dict]:
        """Get option chain from IB.
        
        IB provides greeks natively via reqMktData with genericTickList='106'.
        """
        ...
    
    def _occ_to_ib_contract(self, occ_symbol: str) -> Option:
        """Convert OCC symbol to IB Option contract.
        
        OCC: SPY260115C00580000
        IB:  Option('SPY', '20260115', 580.0, 'C', 'SMART')
        """
        parsed = self.parse_option_symbol(occ_symbol)
        return Option(
            parsed['underlying'],
            parsed['expiration'].strftime('%Y%m%d'),
            parsed['strike'],
            'C' if parsed['option_type'] == 'call' else 'P',
            'SMART',
        )
    
    def parse_option_symbol(self, symbol: str) -> Dict:
        """Parse OCC option symbol (same logic as Tradier)."""
        import re
        match = re.match(r'^([A-Z]+)(\d{6})([CP])(\d{8})$', symbol)
        if not match:
            return {}
        underlying, date_str, opt_type, strike_str = match.groups()
        year = int("20" + date_str[:2])
        month = int(date_str[2:4])
        day = int(date_str[4:6])
        from datetime import date as date_cls
        return {
            "underlying": underlying,
            "expiration": date_cls(year, month, day),
            "option_type": "call" if opt_type == "C" else "put",
            "strike": int(strike_str) / 1000,
        }
    
    def build_option_symbol(self, underlying: str, expiration, option_type: str, strike: float) -> str:
        """Build OCC option symbol."""
        exp_str = expiration.strftime("%y%m%d")
        opt_char = "C" if option_type.lower() == "call" else "P"
        strike_str = f"{int(strike * 1000):08d}"
        return f"{underlying}{exp_str}{opt_char}{strike_str}"
```

**Task 9.2.4: Schwab/TDA Adapter**

```python
# File: brokers/schwab.py (NEW)

class SchwabBroker(BrokerInterface):
    """Charles Schwab broker adapter (post-TDA migration).
    
    Key differences:
    1. OAuth2 authentication (not simple API key)
    2. REST API at api.schwabapi.com
    3. Option symbols use OCC format (compatible!)
    4. Rate limits: 120 requests/minute
    5. No native streaming for options (polling required)
    """
    
    def __init__(self, config: BrokerConfig):
        self.config = config
        self._access_token = None
        self._token_expiry = None
    
    async def _ensure_auth(self):
        """Refresh OAuth2 token if expired."""
        ...
```

**Task 9.2.5: Tastytrade Adapter**

```python
# File: brokers/tastytrade.py (NEW)

class TastytradeBroker(BrokerInterface):
    """Tastytrade broker adapter.
    
    Key differences:
    1. REST API at api.tastyworks.com
    2. Session-based auth (POST /sessions)
    3. Uses their own symbol format (must convert)
    4. Opening trades are commission-free
    5. Supports reduced margin on defined-risk trades
    """
    ...
```

### 9.3 Option Symbol Format Normalization

**Critical Issue:** Different brokers use different option symbol formats.

| Broker | Format | Example (SPY 580 Call, Jan 15 2026) |
|--------|--------|--------------------------------------|
| OCC Standard | `{ROOT}{YYMMDD}{C/P}{strike*1000, 8-digit}` | `SPY260115C00580000` |
| Tradier | OCC format | `SPY260115C00580000` |
| IBKR | Contract object | `Option('SPY', '20260115', 580, 'C', 'SMART')` |
| Schwab | OCC format | `SPY260115C00580000` |
| Tastytrade | Proprietary | `SPY   260115C00580000` (padded) |

**Task 9.3.1: Symbol Normalizer**

```python
# File: brokers/symbols.py (NEW)

def occ_to_components(occ: str) -> Dict:
    """Parse OCC symbol to components."""
    ...

def components_to_occ(underlying: str, expiration: date, opt_type: str, strike: float) -> str:
    """Build OCC symbol from components."""
    ...

def normalize_to_occ(symbol: str, broker: str) -> str:
    """Normalize any broker's symbol format to OCC standard."""
    ...

def occ_to_broker(occ: str, broker: str) -> str:
    """Convert OCC symbol to broker-specific format."""
    ...
```

### 9.4 Migration Plan

| Step | Action | Risk | Rollback |
|------|--------|------|----------|
| 1 | Implement `BrokerInterface` | None | N/A (additive) |
| 2 | Wrap existing `TradierAPI` in `TradierBroker` | LOW | Revert to direct usage |
| 3 | Update `StrategyEngine.__init__` to accept `BrokerInterface` | LOW | Type annotation change only |
| 4 | Implement IBKR adapter (paper mode) | LOW | Not used in production |
| 5 | Run shadow mode (IBKR paper mirrors Tradier live) | LOW | Disable shadow mode |
| 6 | Implement Schwab adapter (paper mode) | LOW | Not used in production |
| 7 | Add broker selection per strategy in dashboard | MEDIUM | Default to Tradier |
| 8 | Gradually migrate strategies to preferred broker | HIGH | Kill switch + revert strategy config |

### 9.5 Multi-Broker Position Tracking

```sql
-- File: scripts/migration_add_broker_to_tables.sql (NEW)

ALTER TABLE position_group_map ADD COLUMN broker TEXT DEFAULT 'tradier';
ALTER TABLE trades ADD COLUMN broker TEXT DEFAULT 'tradier';
ALTER TABLE strategies ADD COLUMN preferred_broker TEXT DEFAULT 'tradier';
```

### Phase 9 Gate Criteria

| Gate | Criteria |
|------|----------|
| G9.1 | BrokerInterface defined with all required methods |
| G9.2 | TradierBroker passes all existing tests |
| G9.3 | IBKRBroker places a paper trade end-to-end |
| G9.4 | Symbol normalization round-trips for all 4 brokers |
| G9.5 | Strategy engine works identically with Tradier adapter vs direct TradierAPI |

---

## 9. Phase 10 — Paper Trading & Shadow Mode

**Goal:** Allow strategies to be tested with simulated fills before committing real capital.

### 10.1 Architecture

```
┌─────────────────────────────────────────────────┐
│                 Strategy Engine                   │
│                                                   │
│  ┌────────────┐    ┌────────────┐                │
│  │ Live Mode  │    │Paper Mode  │                │
│  │(real fills)│    │(sim fills) │                │
│  └─────┬──────┘    └─────┬──────┘                │
│        │                  │                       │
│  ┌─────▼──────┐    ┌─────▼──────┐                │
│  │TradierAPI  │    │PaperBroker │                │
│  │(live/sand) │    │(in-memory) │                │
│  └────────────┘    └────────────┘                │
│                                                   │
│  Shadow Mode: Both run simultaneously.            │
│  Paper orders logged to `paper_trades` table.     │
│  Compare paper vs live fills for model validation.│
└─────────────────────────────────────────────────┘
```

### 10.2 Implementation

**Task 10.2.1: Paper Broker**

```python
# File: brokers/paper.py (NEW)

class PaperBroker(BrokerInterface):
    """In-memory paper trading broker.
    
    Uses real market data (quotes/chains) from a backing broker,
    but simulates order fills in memory.
    
    Fill model: midpoint + configurable slippage.
    """
    
    def __init__(self, backing_broker: BrokerInterface, slippage_ticks: int = 2):
        self._backing = backing_broker
        self._slippage_ticks = slippage_ticks
        self._positions: Dict[str, int] = {}
        self._orders: List[Dict] = []
        self._order_counter = 0
    
    # Market data: delegate to backing broker
    async def get_quote(self, symbol: str) -> Dict:
        return await self._backing.get_quote(symbol)
    
    # Order execution: simulate fills
    async def place_multileg_order(self, underlying, legs, **kwargs) -> Dict:
        """Simulate fill at midpoint + slippage."""
        self._order_counter += 1
        order_id = f"PAPER-{self._order_counter}"
        
        # Calculate fill price from current quotes
        total_credit = 0
        for leg in legs:
            quote = await self.get_quote(leg['symbol'])
            mid = (quote.get('bid', 0) + quote.get('ask', 0)) / 2
            if 'sell' in leg.get('side', '').lower():
                fill = mid - self._slippage_ticks * 0.01
                total_credit += fill
            else:
                fill = mid + self._slippage_ticks * 0.01
                total_credit -= fill
        
        return {
            'id': order_id,
            'status': 'filled',
            'avg_fill_price': abs(total_credit),
        }
```

**Task 10.2.2: Shadow Mode Controller**

```python
# File: services/shadow_mode.py (NEW)

class ShadowModeController:
    """Run paper trades alongside live trades for comparison."""
    
    async def shadow_entry(self, signal: TradeSignal):
        """Execute signal on paper broker, log to paper_trades table."""
        ...
    
    async def shadow_exit(self, trade_group_id: str, exit_signal):
        """Exit paper position, compute paper P&L."""
        ...
    
    async def compare_performance(self, days: int = 30) -> Dict:
        """Compare paper vs live trade performance."""
        ...
```

---

## 10. Phase 11 — Performance Analytics & Reporting

**Goal:** Comprehensive performance tracking and visualization.

### 11.1 Analytics Engine

**Task 11.1.1: Performance Calculator**

```python
# File: services/analytics.py (NEW)

from dataclasses import dataclass
from typing import Dict, List

@dataclass
class PerformanceReport:
    # Overall metrics
    total_pnl: float
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    avg_winner: float
    avg_loser: float
    profit_factor: float
    
    # Risk-adjusted
    sharpe_ratio: float
    sortino_ratio: float
    calmar_ratio: float
    max_drawdown: float
    max_drawdown_duration_days: int
    
    # By strategy
    by_strategy: Dict[str, Dict]
    
    # By underlying
    by_underlying: Dict[str, Dict]
    
    # Time-based
    daily_pnl: Dict[str, float]
    weekly_pnl: Dict[str, float]
    monthly_pnl: Dict[str, float]
    
    # Trade quality
    avg_hold_duration_hours: float
    avg_credit_captured_pct: float
    avg_slippage_vs_mid_pct: float

class PerformanceAnalyzer:
    """Compute performance metrics from trade history."""
    
    async def generate_report(
        self, start_date: str, end_date: str,
        strategy_filter: str = None,
    ) -> PerformanceReport:
        """Generate comprehensive performance report."""
        ...
    
    def compute_sharpe(self, daily_returns: List[float], risk_free_rate: float = 0.05) -> float:
        """Annualized Sharpe ratio."""
        import math
        if not daily_returns:
            return 0.0
        mean = sum(daily_returns) / len(daily_returns)
        var = sum((r - mean) ** 2 for r in daily_returns) / max(1, len(daily_returns) - 1)
        std = math.sqrt(var)
        if std == 0:
            return 0.0
        daily_rf = risk_free_rate / 252
        return (mean - daily_rf) / std * math.sqrt(252)
    
    def compute_max_drawdown(self, equity_curve: List[float]) -> float:
        """Maximum drawdown from peak."""
        if not equity_curve:
            return 0.0
        peak = equity_curve[0]
        max_dd = 0.0
        for value in equity_curve:
            peak = max(peak, value)
            dd = (peak - value) / peak if peak > 0 else 0.0
            max_dd = max(max_dd, dd)
        return max_dd
```

**Task 11.1.2: Daily Report Endpoint**

```python
@app.get("/api/analytics/daily-report")
async def daily_report(date: str = None) -> ApiResponse:
    """Generate daily performance report."""
    ...

@app.get("/api/analytics/strategy-report/{strategy_id}")
async def strategy_report(strategy_id: str, days: int = 30) -> ApiResponse:
    """Generate per-strategy performance report."""
    ...
```

---

## 11. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner |
|----|------|-----------|--------|------------|-------|
| R1 | **Partial fill leaves unhedged leg** | MEDIUM | 🔴 CRITICAL | `_execution_partial.py` emergency flatten + `precheck_close()` guard + `partial_fill_not_resolved` audit alert | Engine |
| R2 | **Market order accidentally executed** | LOW | 🔴 CRITICAL | `DISALLOW_MARKET_ORDERS=true` global flag + `_assert_no_market()` in TradierAPI + only VIX spike path has `allow_market_override` | TradierAPI |
| R3 | **Kill switch fails to trip** | LOW | 🔴 CRITICAL | Regime evaluation failure → fail closed (SAFE_MODE) | StrategyEngine |
| R4 | **Exit monitor misses exit signal** | MEDIUM | 🟡 HIGH | Persistence filter (3 consecutive scans), streaming + polling fallback | ExitMonitor |
| R5 | **Stale quotes cause bad fills** | MEDIUM | 🟡 HIGH | Liquidity gate quote staleness check (300s max), suspect mark guard (50% jump filter) | Pipeline |
| R6 | **Broker API outage** | LOW | 🟡 HIGH | Health check detects failure, kill switch trips on data unavailability | Engine |
| R7 | **Supabase outage** | LOW | 🟡 HIGH | Position data cached in memory; fail closed on DB write failure | Monitor |
| R8 | **VIX data stale/missing** | MEDIUM | 🟡 HIGH | `_fallback_vix_from_history()` in `market_data.py`, fail closed if no data | MarketData |
| R9 | **Earnings date data missing** | MEDIUM | 🟡 MEDIUM | Corporate guard passes when no data (fail open for missing data) — **should be fail closed** | Pipeline |
| R10 | **Position group map diverges from broker** | MEDIUM | 🟡 MEDIUM | `precheck_close()` verifies broker positions before close, reconciler syncs state | Reconciler |
| R11 | **Walking limit doesn't fill** | HIGH | 🟢 LOW | Returns timeout_unknown; entry not logged; no capital at risk | Execution |
| R12 | **Regime over-filters (too many safe_modes)** | MEDIUM | 🟢 LOW | Missing trades, not losses; review regime_transitions.log | Regime |
| R13 | **Single broker dependency** | HIGH | 🟡 MEDIUM | Phase 9 multi-broker migration | Broker |
| R14 | **No backtesting validation** | HIGH | 🟡 HIGH | Phase 6 backtesting engine | Testing |
| R15 | **Unbounded audit log** | LOW | 🟢 LOW | Phase 5 log rotation | Ops |

### Risk Mitigations Already Implemented

1. **No market orders** — Global flag in TradierAPI, only emergency VIX path can override
2. **Walking limit execution** — Never pays more than worst_price_per_share
3. **Kill switch (3 modes)** — Safe mode (block entries), hard stop (flatten all)
4. **Grace period** — No exits for first 15 minutes after entry
5. **Suspect mark guard** — Defers exit decisions if mid-price jumps >50%
6. **Stop persistence** — Requires 3 consecutive exit confirmations before triggering
7. **Precheck close** — Verifies broker positions match before attempting close
8. **Emergency flatten** — Partial fills immediately flattened via aggressive limits
9. **Regime fail-closed** — Missing VIX data → SAFE_MODE (no entries)
10. **Macro calendar** — Event windows (CPI, FOMC) block entries

### Risk Item R9: Corporate Guard Fail-Open (ACTION REQUIRED)

**Current code in `services/pipeline.py:stage_g_corporate_guard()`:**
```python
if not corporate_actions:
    return GateResult(
        stage=PipelineStage.G_CORPORATE,
        passed=True,  # ⚠️ FAIL OPEN — should this be fail closed?
        reason="No corporate actions data (not blocking)",
        ...
    )
```

**Recommendation:** For credit-selling strategies, earnings data should be required. If `corporate_actions` is None AND `corporate_actions.py:get_corporate_actions()` returns None because `tradier.get_corporate_actions()` doesn't exist, the guard silently passes. This means **earnings risk is currently unguarded when the data source is unavailable**.

**Fix:**
```python
if not corporate_actions:
    # If the data source is truly unavailable (not just "no upcoming events"),
    # fail closed for credit strategies to avoid earnings traps.
    if strategy_type in CREDIT_STRATEGY_TYPES:
        return GateResult(
            stage=PipelineStage.G_CORPORATE,
            passed=False,
            reason="Corporate actions data unavailable (fail closed for credit strategies)",
            ...
        )
```

---

## 12. Dependency Graph & Critical Path

### 12.1 Phase Dependencies

```
Phase 5 (Hardening)
  ├── 5.1 Reconciler loop ──────────────────────────── [no deps]
  ├── 5.2 Alerting ──────────────────────────────────── [no deps]
  ├── 5.3 Log rotation ─────────────────────────────── [no deps]
  ├── 5.4 CI/CD ─────────────────────────────────────── [no deps]
  ├── 5.5 Health check ──────────────────────────────── [no deps]
  └── 5.6 Graceful shutdown ─────────────────────────── [no deps]

Phase 6 (Backtesting)
  ├── 6.2.1 Data loader ─────────────────────────────── [no deps]
  ├── 6.2.2 Sim broker ──────────────── depends on → Phase 9.2.1 (BrokerInterface)
  ├── 6.2.3 Backtest runner ──────────── depends on → 6.2.1, 6.2.2
  └── 6.2.4 API endpoints ───────────── depends on → 6.2.3

Phase 7 (Risk Management)
  ├── 7.2.1 Risk monitor ────────────────────────────── [no deps]
  ├── 7.2.2 Risk dashboard ──────────── depends on → 7.2.1
  └── 7.2.3 Auto risk triggers ──────── depends on → 7.2.1

Phase 8 (Strategy Intelligence)
  ├── 8.1 IV surface ────────────────────────────────── [no deps]
  ├── 8.2 Smart strikes ─────────────── depends on → 8.1
  └── 8.3 Dynamic DTE ──────────────── depends on → 8.1

Phase 9 (Multi-Broker)
  ├── 9.2.1 BrokerInterface ─────────────────────────── [no deps]
  ├── 9.2.2 Tradier adapter ─────────── depends on → 9.2.1
  ├── 9.2.3 IBKR adapter ───────────── depends on → 9.2.1
  ├── 9.2.4 Schwab adapter ─────────── depends on → 9.2.1
  ├── 9.2.5 Tastytrade adapter ──────── depends on → 9.2.1
  ├── 9.3.1 Symbol normalizer ──────── depends on → 9.2.1
  └── 9.5 DB migration ────────────── depends on → 9.2.2

Phase 10 (Paper Trading)
  ├── 10.2.1 Paper broker ──────────── depends on → 9.2.1
  └── 10.2.2 Shadow mode ──────────── depends on → 10.2.1

Phase 11 (Analytics)
  └── 11.1 Analytics engine ─────────────────────────── [no deps]
```

### 12.2 Critical Path

```
BrokerInterface (9.2.1) → Tradier Adapter (9.2.2) → Sim Broker (6.2.2) → Backtest Runner (6.2.3)
                        → IBKR Adapter (9.2.3) → Paper Broker (10.2.1) → Shadow Mode (10.2.2)
```

The **critical path** is:
1. **Phase 5** (immediate — hardening, no deps)
2. **Phase 9.2.1** (BrokerInterface — unblocks everything)
3. **Phase 9.2.2** (Tradier adapter — validates interface)
4. **Phase 6** (Backtesting — depends on broker abstraction)
5. **Phase 7** (Risk management — independent, can parallel with 6)
6. **Phase 9.2.3+** (Additional brokers — depends on 9.2.1)
7. **Phase 10** (Paper trading — depends on broker abstraction)
8. **Phase 11** (Analytics — independent)

### 12.3 Parallelization Opportunities

| Track A (Hardening) | Track B (Architecture) | Track C (Intelligence) |
|---------------------|------------------------|------------------------|
| 5.1 Reconciler loop | 9.2.1 BrokerInterface | 8.1 IV surface |
| 5.2 Alerting | 9.2.2 Tradier adapter | 8.2 Smart strikes |
| 5.3 Log rotation | 9.2.3 IBKR adapter | 7.2.1 Risk monitor |
| 5.4 CI/CD | 6.2.1 Data loader | 11.1 Analytics engine |
| 5.5 Health check | 6.2.2 Sim broker | |
| 5.6 Graceful shutdown | 6.2.3 Backtest runner | |

---

## 13. First 2-Week Sprint Plan

### Sprint Goal
Complete Phase 5 (Hardening) and begin Phase 9 (Broker Abstraction).

### Week 1 (Days 1–5)

| Day | Task | Acceptance | Est. Hours |
|-----|------|------------|------------|
| 1 | **5.1** Automated reconciler loop: Add `_run_reconciliation_tick()` to background monitor in `api/main.py`, call every 120s | Reconciler runs; audit trail shows `reconciler_tick` events | 4h |
| 1 | **5.4** CI/CD: Create `.github/workflows/test.yml` for pytest on push | Tests run and pass on GitHub Actions | 2h |
| 2 | **5.2** Alerting: Create `services/alerts.py` with Telegram webhook support | Alerts fire on kill switch trip in sandbox | 4h |
| 2 | **5.2** Wire alerts into kill switch, panic flatten, VIX spike, partial fill paths | All 4 critical alert triggers verified | 3h |
| 3 | **5.5** Health check endpoint (`/api/health`) with Tradier/Supabase/monitor checks | `curl /api/health` returns structured JSON with all checks | 2h |
| 3 | **5.3** Log rotation for `audit_trail.jsonl` at 50MB | Rotation triggers on oversized file | 2h |
| 3 | **5.6** Graceful shutdown handler (SIGTERM) | Process stops cleanly; monitor disconnects | 1h |
| 4 | **R9 Fix**: Corporate guard fail-closed for credit strategies when data unavailable | Test: `stage_g_corporate_guard(corporate_actions=None)` fails for iron condor | 2h |
| 4 | **Test improvements**: Add integration test stubs for reconciler, alerting | 3 new test files with mocked dependencies | 3h |
| 5 | **Review & deploy**: Merge all Phase 5 changes, run full test suite, deploy to EC2 | All tests pass; production running with reconciler + alerts | 4h |

### Week 2 (Days 6–10)

| Day | Task | Acceptance | Est. Hours |
|-----|------|------------|------------|
| 6 | **9.2.1** Define `BrokerInterface` ABC in `brokers/base.py` | Interface defines all 15+ abstract methods | 4h |
| 6 | **9.3.1** Symbol normalizer in `brokers/symbols.py` | OCC parse/build round-trips; OCC→IB contract conversion works | 3h |
| 7 | **9.2.2** Tradier adapter in `brokers/tradier.py` wrapping existing `TradierAPI` | All existing tests pass with `TradierBroker` substituted | 4h |
| 7 | Update `StrategyEngine.__init__` to accept `BrokerInterface` instead of `TradierAPI` | Engine works with both old and new interface | 2h |
| 8 | **9.2.3** Begin IBKR adapter: install `ib_insync`, implement quote/chain/positions | `IBKRBroker.get_quote("SPY")` returns data from IB paper account | 6h |
| 9 | **9.2.3** Continue IBKR: implement order placement + close | Paper trade placed via `IBKRBroker.place_multileg_order()` | 6h |
| 10 | **Integration testing**: Run entry scan → fill verification with Tradier adapter; verify IBKR paper connection | End-to-end entry with new broker abstraction; IBKR paper quote confirmed | 4h |
| 10 | **Documentation**: Update README, commit phased-approach.md updates | Docs current | 2h |

### Sprint Deliverables

1. ✅ Automated reconciliation (every 2 minutes during market hours)
2. ✅ Telegram alerting on critical events (kill switch, panic, VIX spike, partial fill)
3. ✅ Health check endpoint
4. ✅ Audit log rotation
5. ✅ Graceful shutdown
6. ✅ CI/CD pipeline (GitHub Actions)
7. ✅ Corporate guard fix (R9)
8. ✅ `BrokerInterface` ABC
9. ✅ `TradierBroker` adapter
10. ✅ `IBKRBroker` adapter (paper mode, basic functionality)
11. ✅ Symbol normalizer

---

## 14. Appendices

### A. OCC Option Symbol Format

```
Format: {ROOT}{YYMMDD}{C|P}{STRIKE*1000, 8-digit zero-padded}

Examples:
  SPY260115C00580000  = SPY Call, Jan 15 2026, Strike $580.00
  TSLA260220P00200000 = TSLA Put, Feb 20 2026, Strike $200.00
  QQQ260320C00500500  = QQQ Call, Mar 20 2026, Strike $500.50
```

**Implementation:** `tradier_api.py:parse_option_symbol()` and `build_option_symbol()`.

### B. Walking Limit Order Algorithm

```
Input: start_price, worst_price, step_size, step_interval, max_seconds

1. price = start_price
2. WHILE (elapsed < max_seconds) AND (price >= worst_price for credits):
   a. Place limit order at price
   b. Poll for step_interval seconds
   c. IF filled → return success
   d. IF partially filled → emergency flatten, return failure
   e. IF rejected/expired → return failure
   f. Cancel order
   g. price -= step (for credits) or price += step (for debits)
3. Return timeout
```

**Implementation:** `services/execution.py:place_multileg_walking_limit()`.

### C. EV_net Computation

```
EV_net = POP * max_profit_usd - (1 - POP) * max_loss_usd - friction_usd

Where:
  POP = P(all short legs expire OTM) via lognormal model
  max_profit_usd = credit_after_slippage * quantity * multiplier
  max_loss_usd = (wing_width - credit_per_share) * quantity * multiplier
  friction_usd = FrictionCalculator.total_friction_usd(legs)
```

**Implementation:** `services/strategy_engine.py:_phase2_probability_and_ev_net()`, `services/probability.py`, `services/friction.py`.

### D. RegimeService Indicators

| Indicator | Period | Implementation | Purpose |
|-----------|--------|----------------|---------|
| EMA | 20 | `regime.py:ema()` | Short-term trend |
| SMA | 50 | `regime.py:sma()` | Medium-term trend |
| RSI | 14 | `regime.py:rsi()` | Momentum |
| MACD | 12/26/9 | `regime.py:macd()` | Trend momentum |
| ADX | 14 | `regime.py:adx()` | Trend strength |
| Realized Vol | 20 | `regime.py:realized_vol()` | VRP computation |

### E. Supabase Table Relationships

```
strategies (1) ──── (N) strategy_evaluations
                        via strategy_evaluations.strategy_id → strategies.id

trades ──── grouped by trade_group_id ──── position_group_map
            (one row per leg)                (one row per leg)
            linked via trade_group_id        linked via trade_group_id
```

### F. Kill Switch Modes

| Mode | Effect | Trigger |
|------|--------|---------|
| `safe_mode` | Block new entries; cancel working orders | VIX backwardation, macro event window, regime failure |
| `hard_stop` | Block entries + panic flatten all positions | Manual operator action via `/api/kill-switch/hard-stop` |
| Reset | Clear kill switch; resume normal operation | Manual operator action via `/api/kill-switch/reset` |

### G. Exit Monitor Guardrails

| Guardrail | Value | File | Purpose |
|-----------|-------|------|---------|
| `STOP_PERSISTENCE_SCANS` | 3 | `api/main.py` | Require 3 consecutive exit confirmations |
| `EXIT_EVAL_INTERVAL_SECONDS` | 60 | `api/main.py` | One "scan" per minute |
| `MIN_HOLDING_SECONDS` | 900 (15 min) | `api/main.py` | Post-entry grace period |
| `SUSPECT_MARK_JUMP_FRACTION` | 0.50 | `api/main.py` | Reject if mark jumps >50% vs prior scan |
| `VIX_SPIKE_PCT_1M` | 10.0% | `api/main.py` | Emergency fast-path exit threshold |
| `VIX_EMERGENCY_TIMEOUT_SECONDS` | 30 | `api/main.py` | Time to wait for limit fill before market escalation |

### H. Strategy Types Supported

| Type | Enum Value | Legs | Implementation |
|------|------------|------|----------------|
| Iron Condor | `iron_condor` | 4 | `strategy_engine.py:_select_iron_condor_by_ev()` |
| Credit Put Spread | `credit_put_spread` | 2 | `strategy_engine.py:_select_credit_put_spread_by_ev()` |
| Credit Call Spread | `credit_call_spread` | 2 | `strategy_engine.py:_select_credit_call_spread_by_ev()` |
| Iron Fly | `iron_fly` | 4 | `strategy_engine.py:_select_iron_fly_by_ev()` |
| Iron Butterfly | `iron_butterfly` | 4 | `strategy_engine.py:_select_iron_butterfly_by_ev()` |
| Butterfly (debit) | `butterfly` | 3 | `strategy_engine.py:_select_butterfly_by_ev()` |
| Wheel | `wheel` | 1 | `strategies/wheel.py:WheelStrategy.scan()` |
| Cash-Secured Put | `cash_secured_put` | 1 | `strategies/wheel.py` (via wheel controller) |
| Covered Call | `covered_call` | 1 | `strategies/wheel.py` (via wheel controller) |

### I. Dashboard Components Map

| Component | Purpose | Data Source |
|-----------|---------|-------------|
| `KPIStrip` | Daily P&L, win rate, position count | Supabase `trades` + Tradier positions |
| `PositionsPanel` | Open positions with live P&L | Supabase `position_group_map` + Tradier quotes |
| `StrategiesPanel` | Strategy config CRUD | Supabase `strategies` |
| `StrategyEvaluationPanel` | Pipeline evaluation audit trail | Supabase `strategy_evaluations` |
| `ControlsPanel` | Bot enable/disable, kill switch | EC2 API `/api/bot/*`, `/api/kill-switch/*` |
| `PnLChart` | P&L over time | Supabase `trades` |
| `GreeksChart` | Portfolio Greeks visualization | Tradier option chains + greeks |
| `TradeJournal` | Historical trade log | Supabase `trades` |
| `ActivityLog` | Real-time activity feed | EC2 API polling |
| `RecoveryPanel` | Cleanup stale data, reconcile | EC2 API + Supabase |
| `OptionsChain` | Live options chain viewer | Tradier API |
| `StrategyBuilder` | Visual strategy configuration | Local state → Supabase `strategies` |
| `StatusRibbon` | System status indicators | EC2 API `/api/status` |
| `DataLagWarning` | Stale data alert | Tradier quote timestamps |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-15 | Initial phased approach (Phases 1–4) |
| 2.0 | 2026-02-01 | Complete rewrite: codebase audit, Phases 5–11, risk register, critical path, sprint plan, broker migration as first-class section |
