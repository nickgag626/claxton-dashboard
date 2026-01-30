/**
 * IV Surface Service (Phase 8 — Advanced Strategy Intelligence)
 *
 * Types and API functions for IV surface analysis and smart DTE.
 */

import { API_BASE } from './apiBase';

// === Types ===

export interface TermStructurePoint {
  expiration: string;
  atm_iv: number;
  dte: number;
}

export interface SkewByExpiration {
  expiration: string;
  dte: number;
  put_iv_25d: number | null;
  call_iv_25d: number | null;
  skew: number | null;
}

export interface IVSurfaceAnalysis {
  atm_iv: number;
  skew_25d: number;
  skew_ratio_25d: number;
  term_structure: TermStructurePoint[];
  term_structure_slope: number;
  smile_width: number;
  richest_expiration: string;
  recommendation: string;
  skew_by_expiration: SkewByExpiration[];
}

export interface IVSurfaceResponse {
  symbol: string;
  spot: number;
  points_count: number;
  analysis: IVSurfaceAnalysis | null;
  message?: string;
}

export interface SmartDTEResponse {
  symbol: string;
  recommended_min_dte: number;
  recommended_max_dte: number;
  original_min_dte: number;
  original_max_dte: number;
  reasons: string[];
  vix: number | null;
  earnings_dates: string[];
}

// === API Functions ===

export async function getIVSurface(symbol: string): Promise<IVSurfaceResponse> {
  const res = await fetch(`${API_BASE}/api/iv-surface/${encodeURIComponent(symbol)}`);
  if (!res.ok) {
    throw new Error(`IV Surface request failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'IV Surface request failed');
  }
  return json.data as IVSurfaceResponse;
}

export async function getSmartDTE(
  symbol: string,
  minDte: number = 30,
  maxDte: number = 60,
): Promise<SmartDTEResponse> {
  const params = new URLSearchParams({
    min_dte: String(minDte),
    max_dte: String(maxDte),
  });
  const res = await fetch(
    `${API_BASE}/api/smart-dte/${encodeURIComponent(symbol)}?${params}`,
  );
  if (!res.ok) {
    throw new Error(`Smart DTE request failed: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (!json.success) {
    throw new Error(json.error || 'Smart DTE request failed');
  }
  return json.data as SmartDTEResponse;
}
