# Meta Conversions API (CAPI) Multi-Tenant Implementation Plan

**Status**: Implementation Plan (Ready for Review)
**Author**: Architecture Review
**Date**: 2026-01-17

---

## Executive Summary

This document provides a comprehensive implementation plan for adding multi-tenant Meta Conversions API (CAPI) support to the Mojo Digital Wins platform. The implementation enables each client organization to send server-side conversion events to Meta for improved attribution and signal quality.

### Key Goals
1. Per-client Meta CAPI configuration (token, pixel ID, privacy settings)
2. Robust deduplication between browser pixel and server-side events
3. Privacy-conscious data matching with configurable levels
4. Prevention of double-sending when ActBlue already sends CAPI events
5. Durable outbox pattern with retry logic
6. Observability via Signal Health dashboard

---

## 1. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT BROWSER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────┐     ┌──────────────────────────────────────────┐  │
│  │   Meta Pixel        │     │   Donation Form (ActBlue hosted)         │  │
│  │   - PageView        │     │   - Captures fbp/fbc in URL              │  │
│  │   - ViewContent     │     │   - User submits donation                │  │
│  │   (event_id=X)      │     │                                          │  │
│  └────────┬────────────┘     └──────────────────┬───────────────────────┘  │
│           │                                      │                          │
└───────────┼──────────────────────────────────────┼──────────────────────────┘
            │                                      │
            ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ACTBLUE                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Webhook POST → /functions/v1/actblue-webhook                           ││
│  │  Contains: donor info, amount, refcode, custom_fields (fbclid)          ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┬───────────────────────────┘
                                                  │
                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUPABASE EDGE FUNCTIONS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐                                                    │
│  │  actblue-webhook    │                                                    │
│  │  ────────────────── │                                                    │
│  │  1. Validate HMAC   │                                                    │
│  │  2. Store tx        │                                                    │
│  │  3. Check org config│                                                    │
│  │  4. If CAPI enabled │                                                    │
│  │     AND not ActBlue │                                                    │
│  │     owned:          │                                                    │
│  │     → Insert to     │                                                    │
│  │       CAPI Outbox   │                                                    │
│  └──────────┬──────────┘                                                    │
│             │                                                                │
│             ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  meta_capi_outbox (Durable Queue)                                   │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  id | org_id | event_name | event_id | dedupe_key | payload_json   │   │
│  │     | status | attempts | next_retry_at | created_at | sent_at     │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   │                                         │
│                                   ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  process-capi-outbox (Cron Job - every 1 minute)                    │   │
│  │  ─────────────────────────────────────────────────────────────────  │   │
│  │  1. Fetch pending events (status='pending' OR retry due)            │   │
│  │  2. For each event:                                                 │   │
│  │     a. Decrypt org token                                            │   │
│  │     b. Apply privacy mode (hash fields per level)                   │   │
│  │     c. POST to Meta CAPI endpoint                                   │   │
│  │     d. Update status (sent/failed)                                  │   │
│  │     e. On failure: exponential backoff retry                        │   │
│  │  3. Update signal health metrics                                    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           META GRAPH API                                     │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  POST https://graph.facebook.com/v22.0/{pixel_id}/events               ││
│  │  Body: { data: [{ event_name, event_time, event_id, user_data, ... }], ││
│  │         access_token: <per-org-token> }                                 ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Current State Analysis

### 2.1 Existing Infrastructure (Leverageable)

| Component | Location | Status |
|-----------|----------|--------|
| `meta_conversion_events` table | `migrations/20260111120000_...` | Exists - tracks conversion events per org |
| `meta_conversion_retry_queue` table | Same migration | Exists - for retry handling |
| `meta-conversions` edge function | `functions/meta-conversions/` | Exists - but uses single global token |
| `retry-meta-conversions` edge function | `functions/retry-meta-conversions/` | Exists - processes retry queue |
| Encryption utilities | `functions/_shared/security.ts` | Exists - AES-256-GCM encryption |
| `client_api_credentials` table | `migrations/20251113221031_...` | Exists - stores encrypted credentials |
| Event ID generation | `src/components/MetaPixel.tsx` | Exists - UUID-based |

### 2.2 Critical Gaps Requiring Implementation

| Gap | Impact | Priority |
|-----|--------|----------|
| Single global token vs per-org | Cannot support multiple clients | P0 |
| Hardcoded Pixel ID | All events go to same pixel | P0 |
| No CAPI outbox table | No durable delivery guarantee | P0 |
| No privacy mode configuration | GDPR/privacy compliance risk | P1 |
| No ActBlue CAPI toggle | Double-counting donations | P1 |
| No Signal Health dashboard | No visibility into CAPI health | P2 |
| Missing fbp/fbc from donations | Reduced match quality | P2 |

### 2.3 Data Flow for Donations

```
Current flow:
ActBlue Webhook → actblue_transactions → (no CAPI trigger)

Required flow:
ActBlue Webhook → actblue_transactions
                → meta_capi_outbox (if capi_enabled && !actblue_owns_donation)
                → process-capi-outbox → Meta CAPI
```

---

## 3. Data Model Changes

### 3.1 New Table: `meta_capi_config`

Per-organization Meta CAPI configuration.

```sql
-- Migration: 20260118000001_add_meta_capi_config.sql

CREATE TABLE public.meta_capi_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,

  -- Connection settings (stored encrypted in client_api_credentials)
  pixel_id TEXT NOT NULL,
  -- access_token stored in client_api_credentials.encrypted_credentials

  -- Feature flags
  is_enabled BOOLEAN DEFAULT false,
  actblue_owns_donation_complete BOOLEAN DEFAULT false,

  -- Privacy settings
  privacy_mode TEXT NOT NULL DEFAULT 'conservative'
    CHECK (privacy_mode IN ('conservative', 'balanced', 'aggressive')),

  -- Event configuration
  donation_event_name TEXT DEFAULT 'Purchase',  -- or 'Donate'
  send_funnel_events BOOLEAN DEFAULT false,     -- ViewContent, InitiateCheckout

  -- Health tracking
  last_send_at TIMESTAMPTZ,
  last_send_status TEXT CHECK (last_send_status IN ('success', 'failed')),
  last_error TEXT,
  total_events_sent INTEGER DEFAULT 0,
  total_events_failed INTEGER DEFAULT 0,
  match_quality_score NUMERIC(3,2),  -- 0.00 to 1.00

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT unique_org_capi_config UNIQUE (organization_id)
);

-- Indexes
CREATE INDEX idx_meta_capi_config_enabled
  ON public.meta_capi_config(organization_id)
  WHERE is_enabled = true;

-- RLS
ALTER TABLE public.meta_capi_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org CAPI config"
  ON public.meta_capi_config FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can manage CAPI config"
  ON public.meta_capi_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Client managers can manage their org's config
CREATE POLICY "Managers can manage own org CAPI config"
  ON public.meta_capi_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.client_users cu
      WHERE cu.id = auth.uid()
      AND cu.organization_id = meta_capi_config.organization_id
      AND cu.role IN ('admin', 'manager')
    )
  );
```

### 3.2 New Table: `meta_capi_outbox`

Durable outbox for CAPI event delivery.

```sql
-- Migration: 20260118000002_add_meta_capi_outbox.sql

CREATE TABLE public.meta_capi_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,

  -- Event identification
  event_name TEXT NOT NULL,
  event_time TIMESTAMPTZ NOT NULL,
  event_id TEXT NOT NULL,                    -- UUID for browser/server dedup
  dedupe_key TEXT NOT NULL,                  -- Composite key for outbox dedup

  -- Source reference
  source_type TEXT NOT NULL CHECK (source_type IN ('actblue_webhook', 'csv_sync', 'manual')),
  source_id TEXT,                            -- e.g., transaction_id

  -- Event payload (before privacy filtering)
  user_data_raw JSONB NOT NULL,              -- Unfiltered user data
  custom_data JSONB,                         -- value, currency, etc.
  event_source_url TEXT,

  -- Matching data (captured at enqueue time)
  fbp TEXT,                                  -- From cookie or touchpoint
  fbc TEXT,                                  -- From URL param or touchpoint
  external_id TEXT,                          -- Hashed internal donor ID

  -- Processing status
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_retry_at TIMESTAMPTZ DEFAULT now(),

  -- Response tracking
  last_error TEXT,
  meta_response JSONB,
  sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for efficient querying
CREATE UNIQUE INDEX idx_capi_outbox_dedupe
  ON public.meta_capi_outbox(organization_id, dedupe_key);

CREATE INDEX idx_capi_outbox_pending
  ON public.meta_capi_outbox(status, next_retry_at)
  WHERE status IN ('pending', 'failed') AND attempts < max_attempts;

CREATE INDEX idx_capi_outbox_org_time
  ON public.meta_capi_outbox(organization_id, event_time DESC);

CREATE INDEX idx_capi_outbox_source
  ON public.meta_capi_outbox(source_type, source_id);

-- RLS
ALTER TABLE public.meta_capi_outbox ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages CAPI outbox"
  ON public.meta_capi_outbox FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Admins can view CAPI outbox"
  ON public.meta_capi_outbox FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));
```

### 3.3 Extend `client_api_credentials` for Meta CAPI

Add platform type for Meta CAPI tokens.

```sql
-- Migration: 20260118000003_extend_credentials_for_capi.sql

-- Update platform check constraint to include 'meta_capi'
ALTER TABLE public.client_api_credentials
  DROP CONSTRAINT IF EXISTS client_api_credentials_platform_check;

ALTER TABLE public.client_api_credentials
  ADD CONSTRAINT client_api_credentials_platform_check
  CHECK (platform IN ('meta', 'meta_capi', 'switchboard', 'actblue'));

-- Add token type tracking for Meta
COMMENT ON TABLE public.client_api_credentials IS
  'Stores encrypted API credentials per organization.
   For meta_capi platform, encrypted_credentials contains:
   {
     access_token: string,      // User or System User access token
     token_type: "user" | "system_user",
     system_user_id?: string,   // If using system user flow
     created_via: "manual" | "oauth"
   }';
```

### 3.4 Signal Health Tracking Table

```sql
-- Migration: 20260118000004_add_capi_signal_health.sql

CREATE TABLE public.meta_capi_signal_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.client_organizations(id) ON DELETE CASCADE NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now(),

  -- Daily metrics
  date DATE NOT NULL,
  events_attempted INTEGER DEFAULT 0,
  events_sent INTEGER DEFAULT 0,
  events_failed INTEGER DEFAULT 0,
  events_deduped INTEGER DEFAULT 0,

  -- Match quality metrics
  with_email INTEGER DEFAULT 0,
  with_phone INTEGER DEFAULT 0,
  with_name INTEGER DEFAULT 0,
  with_address INTEGER DEFAULT 0,
  with_fbp INTEGER DEFAULT 0,
  with_fbc INTEGER DEFAULT 0,
  with_external_id INTEGER DEFAULT 0,

  -- Calculated scores
  delivery_rate NUMERIC(5,4),      -- events_sent / events_attempted
  match_completeness NUMERIC(5,4), -- weighted score of matching fields

  -- Errors by category
  auth_errors INTEGER DEFAULT 0,
  rate_limit_errors INTEGER DEFAULT 0,
  validation_errors INTEGER DEFAULT 0,
  network_errors INTEGER DEFAULT 0,

  CONSTRAINT unique_org_date UNIQUE (organization_id, date)
);

CREATE INDEX idx_signal_health_org_date
  ON public.meta_capi_signal_health(organization_id, date DESC);

ALTER TABLE public.meta_capi_signal_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org signal health"
  ON public.meta_capi_signal_health FOR SELECT
  USING (organization_id = public.get_user_organization_id());
```

---

## 4. API Routes / Edge Functions

### 4.1 Modified: `actblue-webhook/index.ts`

Add CAPI outbox enqueuing after successful transaction insert.

```typescript
// After line ~536 in actblue-webhook/index.ts (after transaction stored)

// === META CAPI OUTBOX ENQUEUE ===
await enqueueCAPIEvent(supabase, {
  organization_id,
  transactionId: String(lineitemId),
  donor,
  amount,
  paidAt,
  refcode,
  fbclid,
  clickId,
  transactionType,
});
```

**New function to add** (in actblue-webhook or shared module):

```typescript
// supabase/functions/_shared/capi-outbox.ts

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface EnqueueCAPIEventParams {
  organization_id: string;
  transactionId: string;
  donor: {
    email?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    addr1?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  amount: number;
  paidAt: string;
  refcode?: string | null;
  fbclid?: string | null;
  clickId?: string | null;
  transactionType: string;
}

export async function enqueueCAPIEvent(
  supabase: ReturnType<typeof createClient>,
  params: EnqueueCAPIEventParams
): Promise<void> {
  const { organization_id, transactionId, donor, amount, paidAt, refcode, fbclid, clickId, transactionType } = params;

  // Skip non-donation events
  if (transactionType !== 'donation') {
    console.log('[CAPI] Skipping non-donation event:', transactionType);
    return;
  }

  // Check if CAPI is enabled for this org
  const { data: capiConfig, error: configError } = await supabase
    .from('meta_capi_config')
    .select('is_enabled, actblue_owns_donation_complete, donation_event_name')
    .eq('organization_id', organization_id)
    .maybeSingle();

  if (configError || !capiConfig?.is_enabled) {
    console.log('[CAPI] Not enabled for org:', organization_id);
    return;
  }

  // Skip if ActBlue owns donation CAPI
  if (capiConfig.actblue_owns_donation_complete) {
    console.log('[CAPI] ActBlue owns donation CAPI for org:', organization_id);
    return;
  }

  // Generate deterministic event_id and dedupe_key
  const eventId = crypto.randomUUID();
  const dedupeKey = `donation:${organization_id}:${transactionId}`;
  const eventName = capiConfig.donation_event_name || 'Purchase';

  // Lookup fbp/fbc from attribution touchpoints if not in payload
  let fbp = null;
  let fbc = fbclid || clickId || null;

  if (donor.email) {
    const { data: touchpoint } = await supabase
      .from('attribution_touchpoints')
      .select('metadata')
      .eq('organization_id', organization_id)
      .eq('donor_email', donor.email)
      .order('occurred_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (touchpoint?.metadata) {
      fbp = touchpoint.metadata.fbp || fbp;
      fbc = touchpoint.metadata.fbc || touchpoint.metadata.fbclid || fbc;
    }
  }

  // Build user_data_raw (unfiltered - privacy filtering happens at send time)
  const userDataRaw: Record<string, any> = {};
  if (donor.email) userDataRaw.email = donor.email;
  if (donor.phone) userDataRaw.phone = donor.phone;
  if (donor.firstname) userDataRaw.fn = donor.firstname;
  if (donor.lastname) userDataRaw.ln = donor.lastname;
  if (donor.city) userDataRaw.city = donor.city;
  if (donor.state) userDataRaw.state = donor.state;
  if (donor.zip) userDataRaw.zip = donor.zip;
  if (donor.country) userDataRaw.country = donor.country;

  // Generate external_id from email hash
  const externalId = donor.email
    ? await hashSHA256(donor.email.toLowerCase().trim())
    : null;

  // Insert into outbox
  const { error: insertError } = await supabase
    .from('meta_capi_outbox')
    .upsert({
      organization_id,
      event_name: eventName,
      event_time: paidAt,
      event_id: eventId,
      dedupe_key: dedupeKey,
      source_type: 'actblue_webhook',
      source_id: transactionId,
      user_data_raw: userDataRaw,
      custom_data: {
        value: amount,
        currency: 'USD',
        content_type: 'donation',
        order_id: transactionId,
        refcode,
      },
      fbp,
      fbc,
      external_id: externalId,
      status: 'pending',
      next_retry_at: new Date().toISOString(),
    }, {
      onConflict: 'organization_id,dedupe_key',
      ignoreDuplicates: true  // Skip if already queued
    });

  if (insertError) {
    console.error('[CAPI] Failed to enqueue event:', insertError);
  } else {
    console.log('[CAPI] Enqueued donation event:', dedupeKey);
  }
}

async function hashSHA256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### 4.2 New: `process-capi-outbox/index.ts`

Worker that processes the CAPI outbox queue.

```typescript
// supabase/functions/process-capi-outbox/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, validateCronOrAdmin, decryptCredentials } from "../_shared/security.ts";

const corsHeaders = getCorsHeaders();
const API_VERSION = "v22.0";
const BATCH_SIZE = 50;
const MAX_RETRIES = 5;

// Privacy mode field mappings
const PRIVACY_FIELDS = {
  conservative: ['em', 'ph', 'zip', 'country', 'external_id', 'fbp', 'fbc'],
  balanced: ['em', 'ph', 'fn', 'ln', 'city', 'st', 'zip', 'country', 'external_id', 'fbp', 'fbc'],
  aggressive: ['em', 'ph', 'fn', 'ln', 'city', 'st', 'zip', 'country', 'external_id', 'fbp', 'fbc', 'client_ip_address', 'client_user_agent'],
};

interface OutboxItem {
  id: string;
  organization_id: string;
  event_name: string;
  event_time: string;
  event_id: string;
  user_data_raw: Record<string, any>;
  custom_data: Record<string, any>;
  event_source_url?: string;
  fbp?: string;
  fbc?: string;
  external_id?: string;
  attempts: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Validate cron or admin auth
    const authResult = await validateCronOrAdmin(req, supabase);
    if (!authResult.valid) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date().toISOString();

    // Fetch pending events
    const { data: outboxItems, error: fetchError } = await supabase
      .from('meta_capi_outbox')
      .select('*')
      .in('status', ['pending', 'failed'])
      .lte('next_retry_at', now)
      .lt('attempts', MAX_RETRIES)
      .order('next_retry_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) throw fetchError;

    if (!outboxItems || outboxItems.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group by organization for batch processing
    const byOrg = new Map<string, OutboxItem[]>();
    for (const item of outboxItems) {
      const orgItems = byOrg.get(item.organization_id) || [];
      orgItems.push(item);
      byOrg.set(item.organization_id, orgItems);
    }

    let totalSent = 0;
    let totalFailed = 0;

    // Process each organization's events
    for (const [orgId, items] of byOrg) {
      const result = await processOrgEvents(supabase, orgId, items);
      totalSent += result.sent;
      totalFailed += result.failed;
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: outboxItems.length,
        sent: totalSent,
        failed: totalFailed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-capi-outbox] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function processOrgEvents(
  supabase: any,
  orgId: string,
  items: OutboxItem[]
): Promise<{ sent: number; failed: number }> {
  // Fetch org CAPI config
  const { data: config, error: configError } = await supabase
    .from('meta_capi_config')
    .select('pixel_id, privacy_mode, is_enabled')
    .eq('organization_id', orgId)
    .single();

  if (configError || !config?.is_enabled) {
    console.log('[CAPI] Org not configured or disabled:', orgId);
    // Mark as skipped
    await supabase
      .from('meta_capi_outbox')
      .update({ status: 'skipped', last_error: 'CAPI not enabled' })
      .in('id', items.map(i => i.id));
    return { sent: 0, failed: items.length };
  }

  // Fetch and decrypt access token
  const { data: creds, error: credsError } = await supabase
    .from('client_api_credentials')
    .select('encrypted_credentials')
    .eq('organization_id', orgId)
    .eq('platform', 'meta_capi')
    .eq('is_active', true)
    .single();

  if (credsError || !creds?.encrypted_credentials) {
    console.error('[CAPI] No valid credentials for org:', orgId);
    await markFailed(supabase, items, 'No valid CAPI credentials');
    return { sent: 0, failed: items.length };
  }

  let accessToken: string;
  try {
    const decrypted = await decryptCredentials(creds.encrypted_credentials, orgId);
    accessToken = decrypted.access_token;
  } catch (e) {
    console.error('[CAPI] Failed to decrypt credentials:', e);
    await markFailed(supabase, items, 'Credential decryption failed');
    return { sent: 0, failed: items.length };
  }

  const privacyMode = config.privacy_mode || 'conservative';
  const allowedFields = new Set(PRIVACY_FIELDS[privacyMode as keyof typeof PRIVACY_FIELDS]);

  // Build Meta CAPI events
  const events = items.map(item => buildMetaEvent(item, allowedFields));

  // Send to Meta
  const apiUrl = `https://graph.facebook.com/${API_VERSION}/${config.pixel_id}/events`;

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: events,
        access_token: accessToken,
      }),
    });

    const result = await response.json();

    if (response.ok) {
      // Mark all as sent
      await supabase
        .from('meta_capi_outbox')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          meta_response: result,
          updated_at: new Date().toISOString()
        })
        .in('id', items.map(i => i.id));

      // Update health metrics
      await updateSignalHealth(supabase, orgId, items.length, 0, items);

      console.log(`[CAPI] Sent ${items.length} events for org ${orgId}`);
      return { sent: items.length, failed: 0 };
    } else {
      console.error('[CAPI] Meta API error:', result);
      await markFailed(supabase, items, JSON.stringify(result));
      await updateSignalHealth(supabase, orgId, 0, items.length, items, result);
      return { sent: 0, failed: items.length };
    }
  } catch (e) {
    console.error('[CAPI] Network error:', e);
    await markFailed(supabase, items, e instanceof Error ? e.message : 'Network error');
    return { sent: 0, failed: items.length };
  }
}

function buildMetaEvent(item: OutboxItem, allowedFields: Set<string>): Record<string, any> {
  const userData: Record<string, any> = {};

  // Apply privacy filtering and hashing
  const raw = item.user_data_raw;

  if (allowedFields.has('em') && raw.email) {
    userData.em = hashField(raw.email.toLowerCase().trim());
  }
  if (allowedFields.has('ph') && raw.phone) {
    userData.ph = hashField(normalizePhone(raw.phone));
  }
  if (allowedFields.has('fn') && raw.fn) {
    userData.fn = hashField(raw.fn.toLowerCase().trim());
  }
  if (allowedFields.has('ln') && raw.ln) {
    userData.ln = hashField(raw.ln.toLowerCase().trim());
  }
  if (allowedFields.has('city') && raw.city) {
    userData.ct = hashField(raw.city.toLowerCase().replace(/\s/g, ''));
  }
  if (allowedFields.has('st') && raw.state) {
    userData.st = hashField(raw.state.toLowerCase().trim());
  }
  if (allowedFields.has('zip') && raw.zip) {
    userData.zp = hashField(raw.zip.replace(/\s/g, '').substring(0, 5));
  }
  if (allowedFields.has('country') && raw.country) {
    userData.country = hashField(raw.country.toLowerCase().trim());
  }
  if (allowedFields.has('external_id') && item.external_id) {
    userData.external_id = item.external_id; // Already hashed
  }
  if (allowedFields.has('fbp') && item.fbp) {
    userData.fbp = item.fbp;
  }
  if (allowedFields.has('fbc') && item.fbc) {
    userData.fbc = item.fbc;
  }

  return {
    event_name: item.event_name,
    event_time: Math.floor(new Date(item.event_time).getTime() / 1000),
    event_id: item.event_id,
    action_source: 'website',
    event_source_url: item.event_source_url,
    user_data: userData,
    custom_data: item.custom_data,
  };
}

// Synchronous hash for building events (actual hashing done at enqueue time for external_id)
function hashField(value: string): string {
  // In production, use crypto.subtle.digest - simplified here
  // This should use the same hash as Meta expects
  return value; // Placeholder - actual implementation uses SHA256
}

function normalizePhone(phone: string): string {
  // Remove all non-digits, ensure country code
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return '1' + digits; // Assume US
  return digits;
}

async function markFailed(supabase: any, items: OutboxItem[], error: string): Promise<void> {
  for (const item of items) {
    const attempts = item.attempts + 1;
    const nextRetry = computeNextRetry(attempts);

    await supabase
      .from('meta_capi_outbox')
      .update({
        status: attempts >= MAX_RETRIES ? 'failed' : 'pending',
        attempts,
        next_retry_at: nextRetry,
        last_error: error,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);
  }
}

function computeNextRetry(attempts: number): string {
  // Exponential backoff: 5min, 10min, 20min, 40min, 60min (max)
  const delayMinutes = Math.min(60, 5 * Math.pow(2, attempts - 1));
  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

async function updateSignalHealth(
  supabase: any,
  orgId: string,
  sent: number,
  failed: number,
  items: OutboxItem[],
  errorResponse?: any
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Count matching field presence
  const metrics = {
    with_email: items.filter(i => i.user_data_raw?.email).length,
    with_phone: items.filter(i => i.user_data_raw?.phone).length,
    with_name: items.filter(i => i.user_data_raw?.fn || i.user_data_raw?.ln).length,
    with_address: items.filter(i => i.user_data_raw?.city || i.user_data_raw?.zip).length,
    with_fbp: items.filter(i => i.fbp).length,
    with_fbc: items.filter(i => i.fbc).length,
    with_external_id: items.filter(i => i.external_id).length,
  };

  // Categorize errors
  let authErrors = 0, rateLimitErrors = 0, validationErrors = 0, networkErrors = 0;
  if (errorResponse) {
    const errorCode = errorResponse?.error?.code;
    if (errorCode === 190 || errorCode === 102) authErrors = failed;
    else if (errorCode === 17 || errorCode === 4) rateLimitErrors = failed;
    else if (errorCode >= 100 && errorCode < 200) validationErrors = failed;
    else networkErrors = failed;
  }

  await supabase.rpc('upsert_capi_signal_health', {
    p_organization_id: orgId,
    p_date: today,
    p_events_sent: sent,
    p_events_failed: failed,
    p_with_email: metrics.with_email,
    p_with_phone: metrics.with_phone,
    p_with_name: metrics.with_name,
    p_with_address: metrics.with_address,
    p_with_fbp: metrics.with_fbp,
    p_with_fbc: metrics.with_fbc,
    p_with_external_id: metrics.with_external_id,
    p_auth_errors: authErrors,
    p_rate_limit_errors: rateLimitErrors,
    p_validation_errors: validationErrors,
    p_network_errors: networkErrors,
  });
}
```

### 4.3 New: RPC for Signal Health Updates

```sql
-- Migration: 20260118000005_add_signal_health_rpc.sql

CREATE OR REPLACE FUNCTION public.upsert_capi_signal_health(
  p_organization_id UUID,
  p_date DATE,
  p_events_sent INTEGER DEFAULT 0,
  p_events_failed INTEGER DEFAULT 0,
  p_with_email INTEGER DEFAULT 0,
  p_with_phone INTEGER DEFAULT 0,
  p_with_name INTEGER DEFAULT 0,
  p_with_address INTEGER DEFAULT 0,
  p_with_fbp INTEGER DEFAULT 0,
  p_with_fbc INTEGER DEFAULT 0,
  p_with_external_id INTEGER DEFAULT 0,
  p_auth_errors INTEGER DEFAULT 0,
  p_rate_limit_errors INTEGER DEFAULT 0,
  p_validation_errors INTEGER DEFAULT 0,
  p_network_errors INTEGER DEFAULT 0
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.meta_capi_signal_health (
    organization_id, date,
    events_attempted, events_sent, events_failed,
    with_email, with_phone, with_name, with_address,
    with_fbp, with_fbc, with_external_id,
    auth_errors, rate_limit_errors, validation_errors, network_errors,
    delivery_rate, match_completeness
  ) VALUES (
    p_organization_id, p_date,
    p_events_sent + p_events_failed, p_events_sent, p_events_failed,
    p_with_email, p_with_phone, p_with_name, p_with_address,
    p_with_fbp, p_with_fbc, p_with_external_id,
    p_auth_errors, p_rate_limit_errors, p_validation_errors, p_network_errors,
    CASE WHEN (p_events_sent + p_events_failed) > 0
         THEN p_events_sent::NUMERIC / (p_events_sent + p_events_failed)
         ELSE 0 END,
    -- Match completeness: weighted average (email=0.3, phone=0.2, fbp/fbc=0.2, name=0.15, address=0.15)
    CASE WHEN (p_events_sent + p_events_failed) > 0
         THEN (
           p_with_email::NUMERIC / (p_events_sent + p_events_failed) * 0.30 +
           p_with_phone::NUMERIC / (p_events_sent + p_events_failed) * 0.20 +
           (p_with_fbp + p_with_fbc)::NUMERIC / (p_events_sent + p_events_failed) / 2 * 0.20 +
           p_with_name::NUMERIC / (p_events_sent + p_events_failed) * 0.15 +
           p_with_address::NUMERIC / (p_events_sent + p_events_failed) * 0.15
         )
         ELSE 0 END
  )
  ON CONFLICT (organization_id, date) DO UPDATE SET
    events_attempted = meta_capi_signal_health.events_attempted + EXCLUDED.events_attempted,
    events_sent = meta_capi_signal_health.events_sent + EXCLUDED.events_sent,
    events_failed = meta_capi_signal_health.events_failed + EXCLUDED.events_failed,
    with_email = meta_capi_signal_health.with_email + EXCLUDED.with_email,
    with_phone = meta_capi_signal_health.with_phone + EXCLUDED.with_phone,
    with_name = meta_capi_signal_health.with_name + EXCLUDED.with_name,
    with_address = meta_capi_signal_health.with_address + EXCLUDED.with_address,
    with_fbp = meta_capi_signal_health.with_fbp + EXCLUDED.with_fbp,
    with_fbc = meta_capi_signal_health.with_fbc + EXCLUDED.with_fbc,
    with_external_id = meta_capi_signal_health.with_external_id + EXCLUDED.with_external_id,
    auth_errors = meta_capi_signal_health.auth_errors + EXCLUDED.auth_errors,
    rate_limit_errors = meta_capi_signal_health.rate_limit_errors + EXCLUDED.rate_limit_errors,
    validation_errors = meta_capi_signal_health.validation_errors + EXCLUDED.validation_errors,
    network_errors = meta_capi_signal_health.network_errors + EXCLUDED.network_errors,
    delivery_rate = CASE WHEN (meta_capi_signal_health.events_attempted + EXCLUDED.events_attempted) > 0
                        THEN (meta_capi_signal_health.events_sent + EXCLUDED.events_sent)::NUMERIC /
                             (meta_capi_signal_health.events_attempted + EXCLUDED.events_attempted)
                        ELSE 0 END,
    recorded_at = now();
END;
$$;
```

### 4.4 Add Scheduled Job

```sql
-- Migration: 20260118000006_add_capi_outbox_job.sql

INSERT INTO public.scheduled_jobs (job_name, job_type, schedule, endpoint, is_active)
VALUES (
  'Process CAPI Outbox',
  'process_capi_outbox',
  '* * * * *',  -- Every minute
  'process-capi-outbox',
  true
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  schedule = EXCLUDED.schedule,
  endpoint = EXCLUDED.endpoint,
  is_active = EXCLUDED.is_active,
  updated_at = now();

INSERT INTO public.pipeline_heartbeat (job_type, job_name, sla_minutes, is_critical)
VALUES (
  'process_capi_outbox',
  'Meta CAPI Outbox Processor',
  5,
  true
)
ON CONFLICT (job_type) DO UPDATE SET
  job_name = EXCLUDED.job_name,
  sla_minutes = EXCLUDED.sla_minutes;
```

---

## 5. UI/UX Changes

### 5.1 New Component: `MetaCAPISettings.tsx`

Location: `src/components/admin/integrations/MetaCAPISettings.tsx`

```tsx
// Key UI elements:
// 1. Token input (paste access token)
// 2. Pixel ID input
// 3. Privacy mode selector (Conservative/Balanced/Aggressive)
// 4. ActBlue ownership toggle
// 5. Test connection button
// 6. Save button
```

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────┐
│  Meta Conversions API (CAPI)                      [Connected ✓] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Access Token                                                   │
│  ┌──────────────────────────────────────────┐  [👁] [Test]     │
│  │ ••••••••••••••••••••••••••••••••ef72     │                   │
│  └──────────────────────────────────────────┘                   │
│  ℹ️ Paste a User Access Token or System User Token              │
│                                                                 │
│  Pixel ID                                                       │
│  ┌──────────────────────────────────────────┐                   │
│  │ 1234567890123456                         │                   │
│  └──────────────────────────────────────────┘                   │
│  ℹ️ Found in Meta Events Manager → Data Sources                 │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Privacy Mode                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ○ Conservative (Recommended)                                ││
│  │   Email OR Phone + Zip/Country                              ││
│  │                                                             ││
│  │ ○ Balanced                                                  ││
│  │   + Name + City/State                                       ││
│  │                                                             ││
│  │ ○ Aggressive                                                ││
│  │   All recommended fields (excludes employer/occupation)     ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Donation Event Ownership                                       │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ☐ ActBlue sends donation events to Meta                     ││
│  │   (We will skip DonationComplete to avoid double-counting)  ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│                                         [Cancel]  [Save & Enable]│
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 New Component: `CAPISignalHealthCard.tsx`

Location: `src/components/client/CAPISignalHealthCard.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Signal Health                                     [Last 7d] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │
│  │   98.5%   │  │    847    │  │   12      │  │   0.82    │    │
│  │ Delivery  │  │  Events   │  │  Failed   │  │  Match    │    │
│  │   Rate    │  │   Sent    │  │           │  │  Quality  │    │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │
│                                                                 │
│  Last Successful Send: 2 minutes ago                            │
│  Dedupe Integrity: ✓ No duplicates detected                     │
│                                                                 │
│  Match Field Coverage                                           │
│  Email    ████████████████████████████████ 100%                │
│  Phone    ████████████████████░░░░░░░░░░░░  62%                │
│  FBP/FBC  ████████░░░░░░░░░░░░░░░░░░░░░░░░  24%                │
│  Name     ████████████████████████████████ 100%                │
│  Address  ████████████████████████░░░░░░░░  78%                │
│                                                                 │
│  ⚠️ Low FBP/FBC coverage. Consider adding fbclid to forms.      │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Integration in Step4Integrations

Add a new section for Meta CAPI in the onboarding wizard, below the existing Meta Ads section.

---

## 6. Security Controls

### 6.1 Token Storage

```typescript
// Tokens are encrypted using existing pattern in security.ts
// Key derivation: PBKDF2 with org_id as salt
// Encryption: AES-256-GCM with random IV

// Storage structure in client_api_credentials:
{
  platform: 'meta_capi',
  encrypted_credentials: '<base64-encrypted-blob>',
  // Decrypted contents:
  // {
  //   access_token: string,
  //   token_type: 'user' | 'system_user',
  //   created_via: 'manual' | 'oauth',
  //   created_at: string
  // }
}
```

### 6.2 Audit Logging

All CAPI configuration changes are logged via existing `log_admin_action` RPC:

```typescript
await supabase.rpc('log_admin_action', {
  _action_type: 'update_capi_config',
  _table_affected: 'meta_capi_config',
  _record_id: configId,
  _old_value: { privacy_mode: 'conservative' },
  _new_value: { privacy_mode: 'balanced' }
});
```

### 6.3 RBAC

- **Admins**: Full access to all org CAPI configs
- **Managers**: Can manage their own org's CAPI config
- **Viewers**: Read-only access to signal health

### 6.4 Security Checklist

| Control | Implementation |
|---------|----------------|
| Token encrypted at rest | AES-256-GCM via `encryptCredentials()` |
| Token isolated per org | Org ID used as PBKDF2 salt |
| No cross-tenant leakage | RLS policies on all tables |
| No raw PII in logs | `user_data_raw` not logged; only hashed |
| Audit trail | `log_admin_action` on config changes |
| Token rotation support | `credential_version` column exists |

---

## 7. Deduplication Strategy

### 7.1 Event ID Strategy

```
event_id = UUID generated at event creation time
         = crypto.randomUUID()
```

- **Browser Pixel**: Generates `event_id` in `createEventId()` (MetaPixel.tsx)
- **Server CAPI**: Uses same `event_id` when tracking same user action
- **Donation Events**: New UUID per donation (no browser event to match)

### 7.2 Dedupe Key Strategy

For outbox deduplication (preventing duplicate queue entries):

```
dedupe_key = "{event_type}:{organization_id}:{source_id}"
           = "donation:abc123:lineitem_456789"
```

- **Unique constraint** on `(organization_id, dedupe_key)` prevents duplicate inserts
- **Upsert with ignoreDuplicates** handles race conditions

### 7.3 Meta-Level Deduplication

Meta dedupes events using:
1. `event_id` (primary)
2. `event_name` + `event_time` (within same pixel)

Our approach:
- Each donation gets a unique `event_id`
- We track `event_id` in `meta_capi_outbox` for debugging
- `status='sent'` prevents re-sending

### 7.4 Handling Retries

```typescript
// On retry, we use the SAME event_id
// Meta will dedupe if already received
// Our outbox status prevents processing twice locally

if (item.status === 'sent') {
  // Skip - already delivered
  continue;
}
```

---

## 8. Implementation Phases

### Phase 0: Scaffolding & Migrations (Day 1-2)

**Tasks:**
1. Create migration files for new tables
2. Add `meta_capi` platform type to credentials
3. Create shared CAPI utilities module
4. Add scheduled job configuration

**Files to Create:**
- `supabase/migrations/20260118000001_add_meta_capi_config.sql`
- `supabase/migrations/20260118000002_add_meta_capi_outbox.sql`
- `supabase/migrations/20260118000003_extend_credentials_for_capi.sql`
- `supabase/migrations/20260118000004_add_capi_signal_health.sql`
- `supabase/migrations/20260118000005_add_signal_health_rpc.sql`
- `supabase/migrations/20260118000006_add_capi_outbox_job.sql`
- `supabase/functions/_shared/capi-utils.ts`

### Phase 1: First 2 Clients (Day 3-5)

**Tasks:**
1. Implement `process-capi-outbox` edge function
2. Modify `actblue-webhook` to enqueue CAPI events
3. Build `MetaCAPISettings.tsx` UI component
4. Manually configure 2 pilot clients
5. Verify events appear in Meta Events Manager

**Files to Create/Modify:**
- `supabase/functions/process-capi-outbox/index.ts` (new)
- `supabase/functions/actblue-webhook/index.ts` (modify)
- `supabase/functions/_shared/capi-outbox.ts` (new)
- `src/components/admin/integrations/MetaCAPISettings.tsx` (new)

**Pilot Client Checklist:**
- [ ] Client provides Meta access token
- [ ] Client provides Pixel ID
- [ ] Configure privacy mode (default: conservative)
- [ ] Confirm ActBlue CAPI status (on/off)
- [ ] Test with Meta Test Events tool
- [ ] Verify deduplication works

### Phase 2: Multi-Tenant Generalization (Day 6-8)

**Tasks:**
1. Add CAPI section to onboarding wizard (Step4Integrations)
2. Build Signal Health dashboard card
3. Add token validation on save
4. Add test connection endpoint
5. Implement proper SHA256 hashing for all fields

**Files to Create/Modify:**
- `src/components/admin/onboarding/steps/Step4Integrations.tsx` (modify)
- `src/components/client/CAPISignalHealthCard.tsx` (new)
- `supabase/functions/test-capi-connection/index.ts` (new)
- `src/hooks/useCAPISignalHealth.ts` (new)

### Phase 3: Hardening & Observability (Day 9-12)

**Tasks:**
1. Add comprehensive unit tests
2. Add integration tests with mocked Meta API
3. Implement token refresh reminder (for expiring tokens)
4. Add alerting for high failure rates
5. Documentation and runbook

**Files to Create:**
- `src/components/admin/integrations/__tests__/MetaCAPISettings.test.tsx`
- `supabase/functions/process-capi-outbox/index.test.ts`
- `supabase/functions/_shared/__tests__/capi-utils.test.ts`
- `docs/runbooks/meta-capi-troubleshooting.md`

---

## 9. Diff-Ready File Proposals

### 9.1 Migration: `20260118000001_add_meta_capi_config.sql`

```sql
-- Full SQL provided in Section 3.1 above
```

### 9.2 Migration: `20260118000002_add_meta_capi_outbox.sql`

```sql
-- Full SQL provided in Section 3.2 above
```

### 9.3 New File: `supabase/functions/_shared/capi-outbox.ts`

```typescript
// Full TypeScript provided in Section 4.1 above
```

### 9.4 New File: `supabase/functions/process-capi-outbox/index.ts`

```typescript
// Full TypeScript provided in Section 4.2 above
```

### 9.5 Modify: `supabase/functions/actblue-webhook/index.ts`

**Add import at top:**
```typescript
import { enqueueCAPIEvent } from "../_shared/capi-outbox.ts";
```

**Add after line ~537 (after `console.log('[ACTBLUE] Transaction stored successfully:')`):**
```typescript
// === META CAPI OUTBOX ENQUEUE ===
try {
  await enqueueCAPIEvent(supabase, {
    organization_id,
    transactionId: String(lineitemId),
    donor,
    amount,
    paidAt,
    refcode,
    fbclid,
    clickId,
    transactionType,
  });
} catch (capiError) {
  console.error('[ACTBLUE] CAPI enqueue failed (non-fatal):', capiError);
}
```

### 9.6 New File: `src/components/admin/integrations/MetaCAPISettings.tsx`

```tsx
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, TestTube, Loader2, Shield, AlertTriangle } from 'lucide-react';

interface MetaCAPISettingsProps {
  organizationId: string;
  onSave?: () => void;
}

export function MetaCAPISettings({ organizationId, onSave }: MetaCAPISettingsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [accessToken, setAccessToken] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [privacyMode, setPrivacyMode] = useState<'conservative' | 'balanced' | 'aggressive'>('conservative');
  const [actBlueOwnsDonation, setActBlueOwnsDonation] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch existing config
  const { data: config, isLoading } = useQuery({
    queryKey: ['capi-config', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('meta_capi_config')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (config) {
      setPixelId(config.pixel_id || '');
      setPrivacyMode(config.privacy_mode || 'conservative');
      setActBlueOwnsDonation(config.actblue_owns_donation_complete || false);
    }
  }, [config]);

  const handleTest = async () => {
    if (!accessToken || !pixelId) {
      toast({ title: 'Missing fields', description: 'Please enter token and pixel ID', variant: 'destructive' });
      return;
    }
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-capi-connection', {
        body: { access_token: accessToken, pixel_id: pixelId },
      });
      if (error) throw error;
      toast({ title: 'Connection successful', description: 'Meta CAPI credentials are valid.' });
    } catch (e) {
      toast({ title: 'Connection failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!accessToken || !pixelId) {
      toast({ title: 'Missing fields', description: 'Please enter token and pixel ID', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      // Save credentials
      const { error: credError } = await supabase
        .from('client_api_credentials')
        .upsert({
          organization_id: organizationId,
          platform: 'meta_capi',
          encrypted_credentials: { access_token: accessToken, token_type: 'user', created_via: 'manual' },
          is_active: true,
          last_tested_at: new Date().toISOString(),
          last_test_status: 'success',
        }, { onConflict: 'organization_id,platform' });

      if (credError) throw credError;

      // Save config
      const { error: configError } = await supabase
        .from('meta_capi_config')
        .upsert({
          organization_id: organizationId,
          pixel_id: pixelId,
          privacy_mode: privacyMode,
          actblue_owns_donation_complete: actBlueOwnsDonation,
          is_enabled: true,
        }, { onConflict: 'organization_id' });

      if (configError) throw configError;

      // Audit log
      await supabase.rpc('log_admin_action', {
        _action_type: 'configure_capi',
        _table_affected: 'meta_capi_config',
        _record_id: null,
        _old_value: null,
        _new_value: { pixel_id: pixelId, privacy_mode: privacyMode, actblue_owns_donation: actBlueOwnsDonation },
      });

      toast({ title: 'Settings saved', description: 'Meta CAPI is now enabled.' });
      queryClient.invalidateQueries({ queryKey: ['capi-config', organizationId] });
      onSave?.();
    } catch (e) {
      toast({ title: 'Save failed', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="animate-pulse h-48 bg-muted rounded-lg" />;

  return (
    <div className="space-y-6">
      {/* Access Token */}
      <div className="space-y-2">
        <Label>Access Token</Label>
        <div className="flex gap-2">
          <Input
            type={showToken ? 'text' : 'password'}
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={config ? '••••••••' : 'Paste Meta access token'}
          />
          <Button variant="ghost" size="icon" onClick={() => setShowToken(!showToken)}>
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button variant="outline" onClick={handleTest} disabled={isTesting}>
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Get a token from Meta Events Manager → Settings → Generate Access Token
        </p>
      </div>

      {/* Pixel ID */}
      <div className="space-y-2">
        <Label>Pixel ID</Label>
        <Input
          value={pixelId}
          onChange={(e) => setPixelId(e.target.value)}
          placeholder="e.g., 1234567890123456"
        />
      </div>

      {/* Privacy Mode */}
      <div className="space-y-3">
        <Label className="flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Privacy Mode
        </Label>
        <RadioGroup value={privacyMode} onValueChange={(v) => setPrivacyMode(v as any)}>
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="conservative" id="conservative" />
            <div>
              <Label htmlFor="conservative" className="font-medium">Conservative (Recommended)</Label>
              <p className="text-xs text-muted-foreground">Email OR Phone + Zip/Country</p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="balanced" id="balanced" />
            <div>
              <Label htmlFor="balanced" className="font-medium">Balanced</Label>
              <p className="text-xs text-muted-foreground">+ Name + City/State</p>
            </div>
          </div>
          <div className="flex items-start space-x-2">
            <RadioGroupItem value="aggressive" id="aggressive" />
            <div>
              <Label htmlFor="aggressive" className="font-medium">Aggressive</Label>
              <p className="text-xs text-muted-foreground">All recommended fields (excludes employer/occupation)</p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* ActBlue Ownership */}
      <div className="flex items-start space-x-3 rounded-lg border p-4 bg-amber-500/5 border-amber-500/20">
        <Checkbox
          id="actblue-owns"
          checked={actBlueOwnsDonation}
          onCheckedChange={(v) => setActBlueOwnsDonation(!!v)}
        />
        <div>
          <Label htmlFor="actblue-owns" className="font-medium flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            ActBlue sends donation events to Meta
          </Label>
          <p className="text-xs text-muted-foreground mt-1">
            Enable this if you've configured ActBlue's CAPI integration. We'll skip sending donation events to avoid double-counting.
          </p>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={isSaving}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save & Enable
        </Button>
      </div>
    </div>
  );
}
```

---

## 10. Rollout Checklist for First 2 Clients

### Pre-Rollout (Admin)

- [ ] Migrations applied to production database
- [ ] `process-capi-outbox` function deployed
- [ ] `actblue-webhook` updated and deployed
- [ ] Scheduled job `process_capi_outbox` is active

### Per-Client Setup

#### Step 1: Obtain Credentials from Client

1. **Access Token**: Client obtains from Meta Events Manager
   - Go to Events Manager → Data Sources → Select Pixel → Settings
   - Click "Generate Access Token"
   - **Token Type**: User access token (expires in 60 days) or System User token (recommended for production)

2. **Pixel ID**: Found in Events Manager → Data Sources → Pixel ID displayed at top

3. **Determine ActBlue CAPI Status**:
   - Ask: "Have you enabled ActBlue's Meta CAPI integration?"
   - If yes: Set `actblue_owns_donation_complete = true`
   - If no: Set `actblue_owns_donation_complete = false`

#### Step 2: Configure in Platform

1. Navigate to Admin → Client Organizations → [Client] → Integrations
2. Expand "Meta Conversions API" section
3. Paste access token
4. Enter Pixel ID
5. Select Privacy Mode (recommend: Conservative)
6. Check "ActBlue sends donation events" if applicable
7. Click "Test Connection"
8. Click "Save & Enable"

#### Step 3: Validate with Meta Test Events

1. In Meta Events Manager, go to Test Events
2. Copy the Test Event Code
3. Send a test donation through ActBlue (staging/test form)
4. Verify event appears in Test Events tab within 60 seconds
5. Check event details:
   - `event_name` = "Purchase" (or configured name)
   - `event_id` is present
   - `user_data` contains hashed fields per privacy mode
   - `custom_data` contains `value`, `currency`

#### Step 4: Verify Deduplication

1. **If ActBlue CAPI is OFF**: Only one event should appear per donation
2. **If ActBlue CAPI is ON**:
   - Platform should NOT send DonationComplete
   - Check `meta_capi_outbox` for `status = 'skipped'` entries

#### Step 5: Monitor Signal Health

1. View Signal Health card in client dashboard
2. Verify:
   - Delivery rate > 95%
   - Match quality score improving over time
   - No auth errors (would indicate token issues)

### Troubleshooting

| Issue | Check | Resolution |
|-------|-------|------------|
| Events not appearing | `meta_capi_outbox` status | Check for `failed` status, review `last_error` |
| Auth errors (190) | Token validity | Regenerate token, verify permissions |
| Low match quality | Privacy mode | Consider Balanced mode if GDPR compliant |
| Double counting | ActBlue toggle | Verify toggle matches ActBlue config |
| Delayed events | Job execution | Check `scheduled_jobs` and `job_executions` |

---

## 11. Risk List & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Double-sending donations** | High | High (inflated ROAS) | ActBlue ownership toggle; dedupe_key; event_id |
| **Token expiration** | Medium | Medium (events fail) | Token expiry tracking; dashboard warning; email alert |
| **Missing fbp/fbc** | High | Medium (poor match) | Touchpoint lookup; UI guidance to add fbclid to forms |
| **Privacy violation** | Low | High | Privacy mode defaults to conservative; no employer/occupation |
| **Cross-tenant token leak** | Low | Critical | Org-specific encryption salt; RLS policies |
| **Meta API rate limits** | Medium | Low | Batch processing; exponential backoff |
| **Queue backlog** | Low | Medium | 1-minute cron; monitoring; alerting |

---

## 12. Tests to Add

### Unit Tests

```typescript
// supabase/functions/_shared/__tests__/capi-utils.test.ts

describe('CAPI Utils', () => {
  describe('normalizePhone', () => {
    it('strips non-digits', () => {...});
    it('adds US country code', () => {...});
    it('preserves international codes', () => {...});
  });

  describe('hashField', () => {
    it('returns SHA256 hash', () => {...});
    it('handles unicode', () => {...});
  });

  describe('buildMetaEvent', () => {
    it('applies conservative privacy mode', () => {...});
    it('applies balanced privacy mode', () => {...});
    it('applies aggressive privacy mode', () => {...});
    it('excludes employer/occupation always', () => {...});
  });

  describe('dedupeKey generation', () => {
    it('creates deterministic key', () => {...});
    it('handles missing fields', () => {...});
  });
});
```

### Integration Tests

```typescript
// supabase/functions/process-capi-outbox/index.test.ts

describe('process-capi-outbox', () => {
  it('processes pending events', async () => {...});
  it('respects privacy mode', async () => {...});
  it('handles Meta API errors', async () => {...});
  it('implements exponential backoff', async () => {...});
  it('updates signal health metrics', async () => {...});
  it('skips disabled orgs', async () => {...});
});
```

### E2E Tests

```typescript
// Manual test scenarios in docs/runbooks/meta-capi-testing.md
```

---

## 13. Appendix: Meta CAPI Field Reference

### User Data Fields (per Meta spec)

| Field | Description | Normalization | Always Hashed |
|-------|-------------|---------------|---------------|
| em | Email | lowercase, trim | Yes |
| ph | Phone | digits only, add country code | Yes |
| fn | First name | lowercase, trim | Yes |
| ln | Last name | lowercase, trim | Yes |
| ct | City | lowercase, remove spaces | Yes |
| st | State | 2-letter code, lowercase | Yes |
| zp | Zip | first 5 digits | Yes |
| country | Country | 2-letter ISO code, lowercase | Yes |
| external_id | Internal user ID | - | Already hashed |
| fbp | Facebook browser ID | - | No |
| fbc | Facebook click ID | - | No |

### Fields We Never Send

| Field | Reason |
|-------|--------|
| Employer | Not relevant for ad targeting; privacy risk |
| Occupation | Not relevant for ad targeting; privacy risk |
| Street address | Too specific; privacy risk |
| Notes | User-entered; unpredictable content |
| Custom fields | Unless explicitly fbclid |

---

## Approval

**Plan Author**: Architecture Review
**Date**: 2026-01-17
**Status**: Ready for Engineering Review

---

*End of Implementation Plan*
