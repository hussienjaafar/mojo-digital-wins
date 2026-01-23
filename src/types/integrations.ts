// Shared types for integration management

export type IntegrationPlatform = 'meta_ads' | 'switchboard' | 'actblue' | 'google_ads';

export type IntegrationHealthStatus = 
  | 'healthy' 
  | 'needs_attention' 
  | 'no_setup' 
  | 'all_disabled' 
  | 'untested';

export type SyncStatus = 'success' | 'error' | 'failed' | 'pending' | null;

export interface IntegrationDetail {
  id: string;
  platform: IntegrationPlatform;
  is_active: boolean;
  last_sync_at: string | null;
  last_sync_status: SyncStatus;
  last_sync_error: string | null;
  sync_error_count: number | null;
  last_tested_at: string | null;
  last_test_status: string | null;
  created_at: string | null;
}

export interface WebhookStats {
  org_id: string;
  total_events: number;
  failures: number;
  last_error: string | null;
  last_failure_at: string | null;
  failure_rate: number;
}

export interface DataFreshness {
  org_id: string;
  last_transaction_at: string | null;
  days_stale: number | null;
  transaction_count_7d: number;
}

export interface IntegrationDiagnostics {
  webhookStats?: WebhookStats;
  dataFreshness?: DataFreshness;
}

export interface IntegrationSummary {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  org_is_active: boolean;
  integrations: IntegrationDetail[];
  total_count: number;
  healthy_count: number;
  error_count: number;
  disabled_count: number;
  untested_count: number;
  health_status: IntegrationHealthStatus;
  // Diagnostic data
  diagnostics?: IntegrationDiagnostics;
}

export interface IntegrationStatusCounts {
  needsAttention: number;
  healthy: number;
  noSetup: number;
  untested: number;
}

export const PLATFORM_DISPLAY_NAMES: Record<IntegrationPlatform, string> = {
  meta_ads: 'Meta Ads',
  switchboard: 'Switchboard',
  actblue: 'ActBlue',
  google_ads: 'Google Ads',
};

export const PLATFORM_ICONS: Record<IntegrationPlatform, string> = {
  meta_ads: '📘',
  switchboard: '🔀',
  actblue: '💙',
  google_ads: '🔍',
};

// ActBlue credential sections
export type ActBlueCredentialSection = 'csv' | 'webhook';

export interface ActBlueCSVCredentials {
  entity_id?: string;
  username?: string;
  password?: string;
}

export interface ActBlueWebhookCredentials {
  webhook_username?: string;
  webhook_password?: string;
  webhook_secret?: string;
}

export interface ActBlueCredentials extends ActBlueCSVCredentials, ActBlueWebhookCredentials {}
