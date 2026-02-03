import { API_BASE } from '@/services/apiBase';

export interface EnvironmentInfo {
  environment: string; // 'paper' | 'live' | 'dev'
  primary_broker: string;
  shadow_mode: boolean;
  streaming_enabled: boolean;
  mcp_enabled: boolean;
  bot_enabled: boolean;
}

export interface SecretStatus {
  name: string;
  configured: boolean;
  last_rotated?: string;
}

export interface SystemInfo {
  engine_sha?: string;
  config_hash?: string;
  uptime?: string;
  python_version?: string;
  hostname?: string;
  monitor_mode?: string;
  entry_interval?: number;
  exit_interval?: number;
}

export const adminService = {
  async getEnvironment(): Promise<EnvironmentInfo> {
    const res = await fetch(`${API_BASE}/api/bot/status`);
    const data = await res.json();
    return {
      environment: data.primary_broker === 'paper' ? 'paper' : (data.monitor_mode === 'polling' ? 'paper' : 'live'),
      primary_broker: data.primary_broker || 'tradier',
      shadow_mode: data.shadow_mode || false,
      streaming_enabled: data.monitor_mode === 'streaming',
      mcp_enabled: data.mcp_enabled || false,
      bot_enabled: data.enabled || false,
    };
  },
  async getSecretsStatus(): Promise<SecretStatus[]> {
    const res = await fetch(`${API_BASE}/api/config/current`);
    const data = await res.json();
    const secrets = data.data?.secrets_status || [];
    return secrets;
  },
  async getSystemInfo(): Promise<SystemInfo> {
    const res = await fetch(`${API_BASE}/api/config/current`);
    const data = await res.json();
    return {
      engine_sha: data.data?.engine_sha,
      config_hash: data.data?.config_hash,
      uptime: data.data?.uptime,
      python_version: data.data?.python_version,
      hostname: data.data?.hostname,
      monitor_mode: data.data?.monitor_mode,
      entry_interval: data.data?.entry_interval,
      exit_interval: data.data?.exit_interval,
    };
  },
  async stopBot(): Promise<void> {
    await fetch(`${API_BASE}/api/bot/toggle`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: false }) });
  },
  async toggleKillSwitch(active: boolean): Promise<void> {
    await fetch(`${API_BASE}/api/risk/kill-switch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active }) });
  }
};
