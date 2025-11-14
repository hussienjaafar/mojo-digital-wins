import { http, HttpResponse } from 'msw';

const SUPABASE_URL = 'https://nuclmzoasgydubdshtab.supabase.co';

// Mock attribution data
export const mockAttributionMappings = [
  {
    id: 'attr-1',
    organization_id: 'org-1',
    meta_campaign_id: 'meta-123',
    switchboard_campaign_id: null,
    refcode: 'META_FALL_2024',
    utm_source: 'facebook',
    utm_medium: 'cpc',
    utm_campaign: 'fall_fundraiser',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'attr-2',
    organization_id: 'org-1',
    meta_campaign_id: null,
    switchboard_campaign_id: 'sms-456',
    refcode: 'SMS_GOTV_2024',
    utm_source: 'switchboard',
    utm_medium: 'sms',
    utm_campaign: 'gotv_campaign',
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'attr-3',
    organization_id: 'org-1',
    meta_campaign_id: 'meta-789',
    switchboard_campaign_id: 'sms-789',
    refcode: 'MULTI_TOUCH',
    utm_source: 'facebook',
    utm_medium: 'cpc',
    utm_campaign: 'multi_touch',
    created_at: '2024-01-01T00:00:00Z',
  },
];

// Mock donations/transactions
export const mockTransactions = [
  {
    id: 'txn-1',
    transaction_id: 'AB-12345',
    organization_id: 'org-1',
    amount: 50,
    refcode: 'META_FALL_2024',
    donor_email: 'donor1@example.com',
    donor_name: 'John Doe',
    transaction_date: '2024-01-15T10:00:00Z',
    source_campaign: 'fall_fundraiser',
    is_recurring: false,
    created_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'txn-2',
    transaction_id: 'AB-12346',
    organization_id: 'org-1',
    amount: 100,
    refcode: 'SMS_GOTV_2024',
    donor_email: 'donor2@example.com',
    donor_name: 'Jane Smith',
    transaction_date: '2024-01-16T11:00:00Z',
    source_campaign: 'gotv_campaign',
    is_recurring: false,
    created_at: '2024-01-16T11:00:00Z',
  },
  {
    id: 'txn-3',
    transaction_id: 'AB-12347',
    organization_id: 'org-1',
    amount: 250,
    refcode: 'MULTI_TOUCH',
    donor_email: 'donor3@example.com',
    donor_name: 'Bob Johnson',
    transaction_date: '2024-01-17T12:00:00Z',
    source_campaign: 'multi_touch',
    is_recurring: false,
    created_at: '2024-01-17T12:00:00Z',
  },
];

// Mock Meta Ad metrics
export const mockMetaMetrics = [
  {
    id: 'meta-1',
    organization_id: 'org-1',
    campaign_id: 'meta-123',
    date: '2024-01-15',
    spend: 500,
    impressions: 10000,
    clicks: 250,
    conversions: 10,
    conversion_value: 500,
    synced_at: '2024-01-15T23:00:00Z',
  },
  {
    id: 'meta-2',
    organization_id: 'org-1',
    campaign_id: 'meta-789',
    date: '2024-01-17',
    spend: 800,
    impressions: 15000,
    clicks: 400,
    conversions: 15,
    conversion_value: 1250,
    synced_at: '2024-01-17T23:00:00Z',
  },
];

// Mock SMS metrics
export const mockSMSMetrics = [
  {
    id: 'sms-1',
    organization_id: 'org-1',
    campaign_id: 'sms-456',
    date: '2024-01-16',
    messages_sent: 1000,
    messages_delivered: 950,
    clicks: 80,
    conversions: 5,
    cost: 100,
    amount_raised: 500,
    synced_at: '2024-01-16T23:00:00Z',
  },
  {
    id: 'sms-2',
    organization_id: 'org-1',
    campaign_id: 'sms-789',
    date: '2024-01-17',
    messages_sent: 1500,
    messages_delivered: 1450,
    clicks: 120,
    conversions: 8,
    cost: 150,
    amount_raised: 1000,
    synced_at: '2024-01-17T23:00:00Z',
  },
];

// Mock ROI analytics
export const mockROIAnalytics = [
  {
    id: 'roi-1',
    organization_id: 'org-1',
    campaign_id: 'multi-touch-journey',
    platform: 'combined',
    date: '2024-01-17',
    first_touch_attribution: 250, // Full credit to Meta (first touch)
    last_touch_attribution: 250, // Full credit to SMS (last touch)
    linear_attribution: 125, // Split evenly between Meta and SMS
    position_based_attribution: 175, // 40% first, 40% last, 20% middle
    time_decay_attribution: 100, // More credit to recent (SMS)
    created_at: '2024-01-17T23:00:00Z',
  },
];

export const handlers = [
  // Campaign attribution endpoints
  http.get(`${SUPABASE_URL}/rest/v1/campaign_attribution`, () => {
    return HttpResponse.json(mockAttributionMappings);
  }),

  http.post(`${SUPABASE_URL}/rest/v1/campaign_attribution`, async ({ request }) => {
    const body = await request.json() as Record<string, any>;
    const newMapping = {
      id: `attr-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...(body as object),
    };
    return HttpResponse.json(newMapping, { status: 201 });
  }),

  http.patch(`${SUPABASE_URL}/rest/v1/campaign_attribution`, async ({ request }) => {
    const body = await request.json() as Record<string, any>;
    return HttpResponse.json({ ...mockAttributionMappings[0], ...(body as object) });
  }),

  http.delete(`${SUPABASE_URL}/rest/v1/campaign_attribution`, () => {
    return HttpResponse.json({}, { status: 204 });
  }),

  // Transaction endpoints
  http.get(`${SUPABASE_URL}/rest/v1/actblue_transactions`, () => {
    return HttpResponse.json(mockTransactions);
  }),

  // Meta ad metrics endpoints
  http.get(`${SUPABASE_URL}/rest/v1/meta_ad_metrics`, () => {
    return HttpResponse.json(mockMetaMetrics);
  }),

  // SMS metrics endpoints
  http.get(`${SUPABASE_URL}/rest/v1/sms_campaign_metrics`, () => {
    return HttpResponse.json(mockSMSMetrics);
  }),

  // ROI analytics endpoints
  http.get(`${SUPABASE_URL}/rest/v1/roi_analytics`, () => {
    return HttpResponse.json(mockROIAnalytics);
  }),

  // Meta campaigns
  http.get(`${SUPABASE_URL}/rest/v1/meta_campaigns`, () => {
    return HttpResponse.json([
      {
        id: 'meta-camp-1',
        campaign_id: 'meta-123',
        campaign_name: 'Fall Fundraiser 2024',
        organization_id: 'org-1',
        status: 'ACTIVE',
        objective: 'CONVERSIONS',
      },
      {
        id: 'meta-camp-2',
        campaign_id: 'meta-789',
        campaign_name: 'Multi-Touch Campaign',
        organization_id: 'org-1',
        status: 'ACTIVE',
        objective: 'CONVERSIONS',
      },
    ]);
  }),

  // Auth endpoints
  http.post(`${SUPABASE_URL}/auth/v1/token`, () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      user: {
        id: 'user-1',
        email: 'test@example.com',
      },
    });
  }),
];
