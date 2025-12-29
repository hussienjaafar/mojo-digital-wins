import { http, HttpResponse } from 'msw';
import {
  mockClientAlerts,
  mockSuggestedActions,
  mockOpportunities,
  mockWatchlistEntities,
  mockDonorSegments,
  mockAttributionTouchpoints,
  mockLtvPredictions,
  mockMetaAdMetrics,
  mockSmsCampaigns,
  mockDonationTransactions,
  mockDonationAttributions,
  mockSmsEvents,
  TEST_ORG_ID,
} from './fixtures';

const SUPABASE_URL = 'https://nuclmzoasgydubdshtab.supabase.co';

// ============================================================================
// Legacy Mock Data (kept for backwards compatibility)
// ============================================================================

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
];

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
];

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
];

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
];

export const mockROIAnalytics = [
  {
    id: 'roi-1',
    organization_id: 'org-1',
    campaign_id: 'multi-touch-journey',
    platform: 'combined',
    date: '2024-01-17',
    first_touch_attribution: 250,
    last_touch_attribution: 250,
    linear_attribution: 125,
    position_based_attribution: 175,
    time_decay_attribution: 100,
    created_at: '2024-01-17T23:00:00Z',
  },
];

// ============================================================================
// Handlers
// ============================================================================

export const handlers = [
  // -------------------------------------------------------------------------
  // Client Alerts (actual table: client_entity_alerts)
  // -------------------------------------------------------------------------
  http.get(`${SUPABASE_URL}/rest/v1/client_entity_alerts`, ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization_id');

    if (orgId === `eq.${TEST_ORG_ID}`) {
      return HttpResponse.json(mockClientAlerts);
    }
    return HttpResponse.json([]);
  }),

  http.patch(`${SUPABASE_URL}/rest/v1/client_entity_alerts`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...mockClientAlerts[0], ...body });
  }),

  // -------------------------------------------------------------------------
  // Suggested Actions
  // -------------------------------------------------------------------------
  http.get(`${SUPABASE_URL}/rest/v1/suggested_actions`, ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization_id');

    if (orgId === `eq.${TEST_ORG_ID}`) {
      return HttpResponse.json(mockSuggestedActions);
    }
    return HttpResponse.json([]);
  }),

  http.patch(`${SUPABASE_URL}/rest/v1/suggested_actions`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...mockSuggestedActions[0], ...body });
  }),

  // -------------------------------------------------------------------------
  // Opportunities (actual table: fundraising_opportunities)
  // -------------------------------------------------------------------------
  http.get(`${SUPABASE_URL}/rest/v1/fundraising_opportunities`, ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization_id');

    if (orgId === `eq.${TEST_ORG_ID}`) {
      return HttpResponse.json(mockOpportunities);
    }
    return HttpResponse.json([]);
  }),

  http.patch(`${SUPABASE_URL}/rest/v1/fundraising_opportunities`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...mockOpportunities[0], ...body });
  }),

  // -------------------------------------------------------------------------
  // Watchlist Entities (actual table: entity_watchlist)
  // -------------------------------------------------------------------------
  http.get(`${SUPABASE_URL}/rest/v1/entity_watchlist`, ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization_id');

    if (orgId === `eq.${TEST_ORG_ID}`) {
      return HttpResponse.json(mockWatchlistEntities);
    }
    return HttpResponse.json([]);
  }),

  http.post(`${SUPABASE_URL}/rest/v1/entity_watchlist`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newEntity = {
      id: `watch-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...body,
    };
    return HttpResponse.json(newEntity, { status: 201 });
  }),

  http.delete(`${SUPABASE_URL}/rest/v1/entity_watchlist`, () => {
    return HttpResponse.json({}, { status: 204 });
  }),

  // -------------------------------------------------------------------------
  // Donor Journey / Segments
  // -------------------------------------------------------------------------
  http.get(`${SUPABASE_URL}/rest/v1/donor_segments`, ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization_id');

    if (orgId === `eq.${TEST_ORG_ID}`) {
      return HttpResponse.json(mockDonorSegments);
    }
    return HttpResponse.json([]);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/attribution_touchpoints`, ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization_id');

    if (orgId === `eq.${TEST_ORG_ID}`) {
      return HttpResponse.json(mockAttributionTouchpoints);
    }
    return HttpResponse.json([]);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/donor_ltv_predictions`, ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization_id');

    if (orgId === `eq.${TEST_ORG_ID}`) {
      return HttpResponse.json(mockLtvPredictions);
    }
    return HttpResponse.json([]);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/donor_journeys`, () => {
    return HttpResponse.json([]);
  }),

  // -------------------------------------------------------------------------
  // Channel Summaries
  // -------------------------------------------------------------------------
  http.get(`${SUPABASE_URL}/rest/v1/meta_ad_metrics`, ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization_id');
    const campaignFilter = url.searchParams.get('campaign_id');
    const creativeFilter = url.searchParams.get('ad_creative_id');

    if (orgId === `eq.${TEST_ORG_ID}`) {
      let results = [...mockMetaAdMetrics];

      // Apply campaign filter
      if (campaignFilter) {
        const campaignId = campaignFilter.replace('eq.', '');
        results = results.filter(m => m.campaign_id === campaignId);
      }

      // Apply creative filter
      if (creativeFilter) {
        const creativeId = creativeFilter.replace('eq.', '');
        results = results.filter(m => m.ad_creative_id === creativeId);
      }

      return HttpResponse.json(results);
    }
    // Legacy support
    return HttpResponse.json(mockMetaMetrics);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/sms_campaigns`, ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization_id');

    if (orgId === `eq.${TEST_ORG_ID}`) {
      return HttpResponse.json(mockSmsCampaigns);
    }
    return HttpResponse.json([]);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/actblue_transactions_secure`, ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization_id');

    if (orgId === `eq.${TEST_ORG_ID}`) {
      return HttpResponse.json(mockDonationTransactions);
    }
    return HttpResponse.json([]);
  }),

  // -------------------------------------------------------------------------
  // Donation Attribution (view) - supports campaign/creative filtering
  // -------------------------------------------------------------------------
  http.get(`${SUPABASE_URL}/rest/v1/donation_attribution`, ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization_id');
    const campaignFilter = url.searchParams.get('attributed_campaign_id');
    const creativeFilter = url.searchParams.get('attributed_creative_id');

    if (orgId === `eq.${TEST_ORG_ID}`) {
      let results = [...mockDonationAttributions];

      // Apply campaign filter
      if (campaignFilter) {
        const campaignId = campaignFilter.replace('eq.', '');
        results = results.filter(d => d.attributed_campaign_id === campaignId);
      }

      // Apply creative filter
      if (creativeFilter) {
        const creativeId = creativeFilter.replace('eq.', '');
        results = results.filter(d => d.attributed_creative_id === creativeId);
      }

      return HttpResponse.json(results);
    }
    return HttpResponse.json([]);
  }),

  // -------------------------------------------------------------------------
  // SMS Events (with phone_hash)
  // -------------------------------------------------------------------------
  http.get(`${SUPABASE_URL}/rest/v1/sms_events`, ({ request }) => {
    const url = new URL(request.url);
    const orgId = url.searchParams.get('organization_id');

    if (orgId === `eq.${TEST_ORG_ID}`) {
      return HttpResponse.json(mockSmsEvents);
    }
    return HttpResponse.json([]);
  }),

  // -------------------------------------------------------------------------
  // Legacy Endpoints
  // -------------------------------------------------------------------------
  http.get(`${SUPABASE_URL}/rest/v1/campaign_attribution`, () => {
    return HttpResponse.json(mockAttributionMappings);
  }),

  http.post(`${SUPABASE_URL}/rest/v1/campaign_attribution`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    const newMapping = {
      id: `attr-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...body,
    };
    return HttpResponse.json(newMapping, { status: 201 });
  }),

  http.patch(`${SUPABASE_URL}/rest/v1/campaign_attribution`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...mockAttributionMappings[0], ...body });
  }),

  http.delete(`${SUPABASE_URL}/rest/v1/campaign_attribution`, () => {
    return HttpResponse.json({}, { status: 204 });
  }),

  http.get(`${SUPABASE_URL}/rest/v1/actblue_transactions`, () => {
    return HttpResponse.json(mockTransactions);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/sms_campaign_metrics`, () => {
    return HttpResponse.json(mockSMSMetrics);
  }),

  http.get(`${SUPABASE_URL}/rest/v1/roi_analytics`, () => {
    return HttpResponse.json(mockROIAnalytics);
  }),

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
    ]);
  }),

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------
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
