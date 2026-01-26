// Enhanced User Management Types

export interface EnhancedUser {
  id: string;
  full_name: string;
  email: string | null;
  organization_id: string;
  organization_name: string;
  role: string;
  status: string;
  mfa_enabled: boolean;
  created_at: string;
  last_login_at: string | null;
  latest_session: SessionInfo | null;
  active_sessions_30d: number;
  failed_logins_24h: number;
  is_locked: boolean;
}

export interface SessionInfo {
  session_id: string;
  last_active_at: string;
  device_info: DeviceInfo;
  ip_address: string | null;
  city: string | null;
  country: string | null;
  is_current: boolean;
}

export interface DeviceInfo {
  browser?: string;
  os?: string;
  device_type?: string;
  [key: string]: unknown;
}

export interface DetailedSession {
  session_id: string;
  started_at: string;
  last_active_at: string;
  expires_at: string;
  ended_at: string | null;
  is_valid: boolean;
  is_current: boolean;
  device_info: DeviceInfo;
  ip_address: string | null;
  user_agent: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_name: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface LoginAttempt {
  attempt_id: string;
  email: string;
  attempted_at: string;
  success: boolean;
  failure_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  city: string | null;
  country: string | null;
}

export interface ActivityLog {
  activity_id: string;
  action_type: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  city: string | null;
  country: string | null;
  count: number;
  last_seen: string;
  is_anomaly?: boolean;
}

export type UserDetailTab = 'overview' | 'sessions' | 'logins' | 'activity' | 'location';
