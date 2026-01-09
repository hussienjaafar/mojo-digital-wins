// Onboarding Wizard Types

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked';

export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

export interface OnboardingState {
  id: string;
  organization_id: string;
  current_step: WizardStep;
  completed_steps: WizardStep[];
  step_data: Record<string, unknown>;
  status: OnboardingStatus;
  blocking_reason: string | null;
  created_by: string | null;
  last_updated_by: string | null;
  created_at: string;
  last_updated_at: string;
}

export interface OnboardingSummary {
  organization_id: string;
  organization_name: string;
  slug: string;
  is_active: boolean;
  org_created_at: string;
  current_step: number;
  completed_steps: WizardStep[];
  onboarding_status: OnboardingStatus;
  blocking_reason: string | null;
  onboarding_updated_at: string | null;
  user_count: number;
  integration_count: number;
  has_profile: boolean;
}

export interface WizardStepConfig {
  step: WizardStep;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

// Step 1: Create Organization
export interface CreateOrgData {
  name: string;
  slug: string;
  primary_contact_email: string;
  logo_url: string;
  website_url: string;
}

// Step 2: Organization Profile
export interface OrgProfileData {
  mission_statement: string;
  focus_areas: string[];
  policy_domains: string[];
  geo_focus: 'federal' | 'state' | 'local' | 'multi';
  target_states: string[];
  sentiment_sensitivity: 'low' | 'medium' | 'high';
  risk_tolerance: 'low' | 'medium' | 'high';
}

// Step 3: Users
export interface UserInvite {
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'viewer';
}

// Step 4: Integrations
export interface IntegrationConfig {
  platform: 'meta' | 'switchboard' | 'actblue';
  is_enabled: boolean;
  is_tested: boolean;
  last_test_status: 'success' | 'error' | null;
}

// Step 5: Watchlists
export interface WatchlistEntity {
  name: string;
  entity_type: 'politician' | 'organization' | 'topic' | 'keyword';
  is_ai_suggested: boolean;
}

export interface AlertThresholds {
  breaking_news: boolean;
  sentiment_shift: boolean;
  mention_spike: boolean;
  threshold_value: number;
}

// Step 6: Activation
export interface ActivationStatus {
  pipelines_enabled: boolean;
  first_sync_completed: boolean;
  health_check_passed: boolean;
}
