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
export type OrganizationType = 
  | 'campaign_federal'      // US Congress, Senate, President
  | 'campaign_state'        // Governor, State Legislature
  | 'campaign_local'        // Mayor, City Council, County Commissioner, School Board
  | 'c3_national'           // National 501(c)(3)
  | 'c3_state'              // State-level 501(c)(3)
  | 'c3_local'              // Local 501(c)(3)
  | 'c4_national'           // National 501(c)(4)
  | 'c4_state'              // State-level 501(c)(4)
  | 'c4_local'              // Local 501(c)(4)
  | 'pac_federal'           // Federal PAC
  | 'pac_state'             // State PAC
  | 'international'         // International NGO/Organization
  | 'other';

export type GeoLevel = 
  | 'national'              // Entire US
  | 'multi_state'           // Multiple states
  | 'state'                 // Single state
  | 'congressional_district' // US House district
  | 'county'                // County level
  | 'city'                  // City/Municipal
  | 'international';        // Outside US

export interface GeoLocation {
  type: GeoLevel;
  value: string;           // e.g., "CA", "San Francisco, CA", "CA-12"
  label: string;           // Display name
}

export interface OrgProfileData {
  mission_statement: string;
  focus_areas: string[];
  policy_domains: string[];
  organization_type: OrganizationType;
  geo_level: GeoLevel;
  geo_locations: GeoLocation[];
  // Legacy fields for backwards compatibility
  geo_focus?: 'federal' | 'state' | 'local' | 'multi';
  target_states?: string[];
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
