// ============================================================================
// Mock Data Fixtures for Query Hook Tests
// ============================================================================

export const TEST_ORG_ID = 'test-org-123';
export const TEST_START_DATE = '2024-01-01';
export const TEST_END_DATE = '2024-01-31';

// ============================================================================
// Client Alerts Fixtures
// ============================================================================

export const mockClientAlerts = [
  {
    id: 'alert-1',
    organization_id: TEST_ORG_ID,
    alert_type: 'anomaly',
    severity: 'high',
    title: 'Donation spike detected',
    message: 'Donations increased by 150% compared to last week',
    is_read: false,
    is_dismissed: false,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
    metadata: { metric: 'donations', change_percent: 150 },
  },
  {
    id: 'alert-2',
    organization_id: TEST_ORG_ID,
    alert_type: 'threshold',
    severity: 'critical',
    title: 'Meta ROAS below target',
    message: 'ROAS dropped to 1.2x, below 2x target',
    is_read: false,
    is_dismissed: false,
    created_at: '2024-01-14T09:00:00Z',
    updated_at: '2024-01-14T09:00:00Z',
    metadata: { metric: 'roas', current: 1.2, target: 2.0 },
  },
  {
    id: 'alert-3',
    organization_id: TEST_ORG_ID,
    alert_type: 'insight',
    severity: 'medium',
    title: 'SMS campaign outperforming',
    message: 'SMS campaign "GOTV" has 3x higher CTR than average',
    is_read: true,
    is_dismissed: false,
    created_at: '2024-01-13T08:00:00Z',
    updated_at: '2024-01-13T12:00:00Z',
    metadata: { campaign: 'GOTV', ctr: 4.5 },
  },
];

// ============================================================================
// Suggested Actions Fixtures
// ============================================================================

export const mockSuggestedActions = [
  {
    id: 'action-1',
    organization_id: TEST_ORG_ID,
    action_type: 'budget_optimization',
    title: 'Increase Meta budget for top campaign',
    description: 'Campaign "Fall Fundraiser" has 3.5x ROAS. Consider increasing budget by 20%.',
    urgency: 8,
    relevance_score: 0.92,
    status: 'pending',
    created_at: '2024-01-15T06:00:00Z',
    expires_at: '2024-01-22T06:00:00Z',
    metadata: { campaign_id: 'meta-123', current_budget: 500, suggested_increase: 100 },
  },
  {
    id: 'action-2',
    organization_id: TEST_ORG_ID,
    action_type: 'audience_expansion',
    title: 'Expand lookalike audience',
    description: 'Your best donors share demographics with untargeted segments.',
    urgency: 6,
    relevance_score: 0.85,
    status: 'pending',
    created_at: '2024-01-14T06:00:00Z',
    expires_at: '2024-01-21T06:00:00Z',
    metadata: { audience_size_potential: 50000 },
  },
  {
    id: 'action-3',
    organization_id: TEST_ORG_ID,
    action_type: 'content_refresh',
    title: 'Update creative assets',
    description: 'Ad creative has been running for 30 days. Performance typically declines after this period.',
    urgency: 5,
    relevance_score: 0.78,
    status: 'used',
    used_at: '2024-01-10T14:00:00Z',
    created_at: '2024-01-08T06:00:00Z',
    expires_at: '2024-01-15T06:00:00Z',
    metadata: { creative_age_days: 30 },
  },
];

// ============================================================================
// Opportunities Fixtures
// ============================================================================

export const mockOpportunities = [
  {
    id: 'opp-1',
    organization_id: TEST_ORG_ID,
    opportunity_type: 'donor_reactivation',
    title: 'Reactivate lapsed major donors',
    description: '15 major donors (>$500) have not donated in 90+ days',
    score: 85,
    potential_value: 12500,
    status: 'active',
    created_at: '2024-01-15T00:00:00Z',
    updated_at: '2024-01-15T00:00:00Z',
    metadata: { donor_count: 15, avg_previous_donation: 833 },
  },
  {
    id: 'opp-2',
    organization_id: TEST_ORG_ID,
    opportunity_type: 'recurring_upgrade',
    title: 'Upgrade one-time donors to recurring',
    description: '45 donors gave 3+ times but are not recurring',
    score: 78,
    potential_value: 8100,
    status: 'active',
    created_at: '2024-01-14T00:00:00Z',
    updated_at: '2024-01-14T00:00:00Z',
    metadata: { donor_count: 45, avg_donation: 15, monthly_potential: 675 },
  },
  {
    id: 'opp-3',
    organization_id: TEST_ORG_ID,
    opportunity_type: 'channel_optimization',
    title: 'Shift budget from underperforming channel',
    description: 'Email has 0.5x ROI vs SMS at 4.2x ROI',
    score: 72,
    potential_value: 3500,
    status: 'completed',
    completed_at: '2024-01-10T00:00:00Z',
    created_at: '2024-01-05T00:00:00Z',
    updated_at: '2024-01-10T00:00:00Z',
    metadata: { from_channel: 'email', to_channel: 'sms' },
  },
];

// ============================================================================
// Watchlist Fixtures
// ============================================================================

export const mockWatchlistEntities = [
  {
    id: 'watch-1',
    organization_id: TEST_ORG_ID,
    entity_type: 'politician',
    entity_name: 'Jane Senator',
    entity_id: 'pol-123',
    threshold: 0.7,
    sentiment_alerts_enabled: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    metadata: { party: 'D', state: 'CA' },
  },
  {
    id: 'watch-2',
    organization_id: TEST_ORG_ID,
    entity_type: 'topic',
    entity_name: 'Climate Policy',
    entity_id: 'topic-456',
    threshold: 0.6,
    sentiment_alerts_enabled: true,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    metadata: { category: 'environment' },
  },
  {
    id: 'watch-3',
    organization_id: TEST_ORG_ID,
    entity_type: 'competitor',
    entity_name: 'Opposing PAC',
    entity_id: 'comp-789',
    threshold: 0.8,
    sentiment_alerts_enabled: false,
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
    metadata: { focus: 'opposition research' },
  },
];

// ============================================================================
// Donor Journey Fixtures
// ============================================================================

export const mockDonorSegments = [
  {
    donor_tier: 'whale',
    donor_frequency_segment: 'recurring',
    total_donated: 25000,
    donation_count: 12,
    days_since_donation: 5,
    monetary_score: 5,
    frequency_score: 5,
    recency_score: 5,
  },
  {
    donor_tier: 'dolphin',
    donor_frequency_segment: 'occasional',
    total_donated: 1500,
    donation_count: 4,
    days_since_donation: 30,
    monetary_score: 3,
    frequency_score: 3,
    recency_score: 4,
  },
  {
    donor_tier: 'fish',
    donor_frequency_segment: 'one-time',
    total_donated: 50,
    donation_count: 1,
    days_since_donation: 60,
    monetary_score: 1,
    frequency_score: 1,
    recency_score: 2,
  },
];

export const mockAttributionTouchpoints = [
  {
    id: 'tp-1',
    touchpoint_type: 'email_click',
    occurred_at: '2024-01-10T10:00:00Z',
    donor_email: 'donor1@example.com',
    utm_source: 'email',
    utm_medium: 'newsletter',
    utm_campaign: 'jan_appeal',
    metadata: {},
  },
  {
    id: 'tp-2',
    touchpoint_type: 'ad_click',
    occurred_at: '2024-01-12T14:00:00Z',
    donor_email: 'donor1@example.com',
    utm_source: 'facebook',
    utm_medium: 'cpc',
    utm_campaign: 'fall_fundraiser',
    metadata: {},
  },
];

export const mockLtvPredictions = [
  {
    donor_key: 'donor-1',
    predicted_ltv_90: 150,
    predicted_ltv_180: 300,
    churn_risk: 0.15,
  },
  {
    donor_key: 'donor-2',
    predicted_ltv_90: 75,
    predicted_ltv_180: 120,
    churn_risk: 0.45,
  },
];

// ============================================================================
// Channel Summaries Fixtures
// ============================================================================

export const mockMetaAdMetrics = [
  {
    id: 'meta-m-1',
    organization_id: TEST_ORG_ID,
    date: '2024-01-15',
    spend: 500,
    conversions: 10,
    conversion_value: 1500,
  },
  {
    id: 'meta-m-2',
    organization_id: TEST_ORG_ID,
    date: '2024-01-16',
    spend: 600,
    conversions: 12,
    conversion_value: 1800,
  },
];

export const mockSmsCampaigns = [
  {
    id: 'sms-c-1',
    organization_id: TEST_ORG_ID,
    send_date: '2024-01-15T10:00:00Z',
    messages_sent: 1000,
    amount_raised: 2000,
    cost: 100,
    status: 'completed',
  },
  {
    id: 'sms-c-2',
    organization_id: TEST_ORG_ID,
    send_date: '2024-01-17T10:00:00Z',
    messages_sent: 1500,
    amount_raised: 3500,
    cost: 150,
    status: 'completed',
  },
];

export const mockDonationTransactions = [
  {
    id: 'txn-1',
    organization_id: TEST_ORG_ID,
    amount: 50,
    net_amount: 47.5,
    donor_email: 'donor1@example.com',
    donor_id_hash: 'hash-1',
    transaction_date: '2024-01-15T10:00:00Z',
    transaction_type: 'donation',
  },
  {
    id: 'txn-2',
    organization_id: TEST_ORG_ID,
    amount: 100,
    net_amount: 95,
    donor_email: 'donor2@example.com',
    donor_id_hash: 'hash-2',
    transaction_date: '2024-01-16T11:00:00Z',
    transaction_type: 'donation',
  },
  {
    id: 'txn-3',
    organization_id: TEST_ORG_ID,
    amount: -25,
    net_amount: -25,
    donor_email: 'donor1@example.com',
    donor_id_hash: 'hash-1',
    transaction_date: '2024-01-17T09:00:00Z',
    transaction_type: 'refund',
  },
];

// ============================================================================
// Component Test Fixtures - Cards
// ============================================================================

/** Mock data for AlertCard component tests */
export const mockAlertCardData = {
  id: 'alert-card-1',
  organization_id: TEST_ORG_ID,
  alert_type: 'velocity_spike' as const,
  severity: 'high' as const,
  entity_name: 'Climate Action Bill',
  entity_type: 'topic',
  current_mentions: 1250,
  velocity: 45.2,
  suggested_action: 'Consider issuing a public statement to capitalize on trending interest.',
  actionable_score: 85,
  is_read: false,
  is_dismissed: false,
  is_actionable: true,
  sample_sources: [],
  triggered_at: '2024-01-15T10:00:00Z',
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
};

/** Mock data for ActionCard component tests */
export const mockActionCardData = {
  id: 'action-card-1',
  organization_id: TEST_ORG_ID,
  action_type: 'sms' as const,
  topic: 'GOTV Reminder for Early Voting',
  sms_copy: 'Early voting starts tomorrow! Make your voice heard - find your polling location at vote.org',
  character_count: 98,
  urgency_score: 75,
  topic_relevance_score: 88,
  estimated_impact: 'High',
  value_proposition: 'Timely reminder expected to boost turnout by 15%',
  status: 'pending' as const,
  alert_id: 'alert-1',
  target_audience: 'likely voters',
  historical_context: null,
  is_used: false,
  is_dismissed: false,
  used_at: null,
  alert: {
    entity_name: 'Early Voting',
    actionable_score: 92,
  },
  created_at: '2024-01-15T08:00:00Z',
  updated_at: '2024-01-15T08:00:00Z',
};

/** Mock data for OpportunityCard component tests */
export const mockOpportunityCardData = {
  id: 'opp-card-1',
  organization_id: TEST_ORG_ID,
  opportunity_type: 'trending' as const,
  entity_name: 'Infrastructure Bill Vote',
  entity_type: 'legislation',
  opportunity_score: 85,
  status: 'pending' as const,
  velocity: 32.5,
  current_mentions: 890,
  estimated_value: 15000,
  similar_past_events: 3,
  historical_success_rate: 72,
  is_active: true,
  detected_at: '2024-01-15T06:00:00Z',
  created_at: '2024-01-15T06:00:00Z',
  updated_at: '2024-01-15T06:00:00Z',
};

/** Mock data for WatchlistEntityCard component tests */
export const mockWatchlistEntityCardData = {
  id: 'watch-card-1',
  organization_id: TEST_ORG_ID,
  entity_type: 'person' as const,
  entity_name: 'Senator Jane Doe',
  aliases: ['Jane Doe', 'Sen. Doe', 'J. Doe'],
  alert_threshold: 70,
  sentiment_alerts_enabled: true,
  relevance_score: 85,
  is_active: true,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-15T00:00:00Z',
};

/** Mock data for DonorSegmentCard component tests */
export const mockDonorSegmentCardData = {
  id: 'segment-1',
  name: 'Major Donors',
  description: 'High-value recurring donors with strong engagement',
  tier: 'whale' as const,
  count: 145,
  totalValue: 425000,
  avgDonation: 2931,
  retentionRate: 92,
  trend: 8.5,
  health: 'healthy' as const,
};

/** Mock sparkline data for HeroKpiCard tests */
export const mockSparklineData = [
  { date: 'Jan 1', value: 1200 },
  { date: 'Jan 8', value: 1450 },
  { date: 'Jan 15', value: 1380 },
  { date: 'Jan 22', value: 1650 },
  { date: 'Jan 29', value: 1820 },
];
