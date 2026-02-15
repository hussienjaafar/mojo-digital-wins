

# Execute: Lead-to-Call Velocity Funnel at `/experience`

## Implementation Order

### Phase 1: Database Migrations

Create 4 tables in a single migration:

**1. `content_optimization`** -- A/B variant copy for each step
- Columns: `id` (uuid PK), `step_key` (text), `variant_label` (text), `headline_text`, `subheadline_text` (nullable), `cta_text`, `body_content` (jsonb, nullable), `is_active` (bool, default true), `created_at`
- RLS: anon SELECT; admin-only write via `is_admin()` check

**2. `funnel_sessions`** -- Visitor session tracking + attribution
- Columns: `id` (uuid PK), `session_id` (text, unique), `variant_label`, `segment` (nullable), `selected_channels` (text[], nullable), `utm_source/medium/campaign/content` (nullable), `device_type`, `fb_pixel_id` (nullable), `ip_address` (nullable), `started_at`, `completed_at` (nullable), `lead_id` (uuid, nullable)
- RLS: anon INSERT; admin-only SELECT

**3. `funnel_analytics`** -- Step-level interaction logging
- Columns: `id` (uuid PK), `session_id`, `step_key`, `step_number` (int), `action` (text), `variant_label`, `segment` (nullable), `metadata` (jsonb, nullable), `created_at`
- RLS: anon INSERT; admin-only SELECT

**4. `funnel_leads`** -- Qualified + abandoned leads with PII protection
- Columns: `id` (uuid PK), `session_id` (text, unique for upsert), `segment`, `variant_label`, `name`, `email`, `email_hash` (SHA-256), `organization`, `role`, `is_decision_maker` (bool), `budget_range`, `selected_channels` (text[]), `buying_authority_info`, `performance_kpis` (text[]), `utm_source`, `utm_campaign`, `lead_score` (int, default 0), `status` (text, default 'incomplete'), `created_at`
- RLS: anon INSERT + UPDATE (scoped by session_id); SELECT restricted to `has_pii_access()`
- Uses `ALTER TABLE funnel_leads FORCE ROW LEVEL SECURITY`

**Seed data**: Insert A/B variant copy for all 8 step keys (welcome, segment_select, commercial_opportunity, political_opportunity, commercial_proof, political_proof, qualification, thank_you).

---

### Phase 2: Custom Hooks (4 files)

**`src/hooks/useFunnelSession.ts`**
- Generates `session_id` via `crypto.randomUUID()`
- Reads `?variant=A|B` from URL or assigns randomly
- Captures UTM params from URL search params
- Reads `_fbp` cookie for Meta cross-device attribution
- Calls `get-client-ip` edge function (fire-and-forget, `keepalive: true`) for IP
- Inserts row into `funnel_sessions`
- Exposes: `sessionId`, `variant`, `segment`, `setSegment`, `selectedChannels`, `setSelectedChannels`, `deviceType`

**`src/hooks/useAbandonedLeadCapture.ts`**
- On email field `onBlur`: validates email with regex, upserts partial row into `funnel_leads` with `status: 'incomplete'`
- Tracks `capturedEarly` ref to prevent duplicate inserts
- Full form submission later upserts the same row (by `session_id`)

**`src/hooks/useFunnelAnalytics.ts`**
- Batches analytics writes to a queue, flushed every 2 seconds
- On `visibilitychange`/`pagehide`, uses `navigator.sendBeacon` fallback for reliability
- `logStep(stepKey, stepNumber, action, metadata?)` queues inserts into `funnel_analytics`
- Uses `requestIdleCallback` to avoid blocking main thread (INP < 200ms target)
- Fires Meta Pixel custom events via existing `trackCustomEvent`/`trackEvent`:
  - `FunnelStepView`, `SegmentSelected`, `QualificationStarted`
  - `Lead` (standard) on submit
  - `Lead_Qualified` custom event ONLY when budget >= "$10k+"

**`src/hooks/useFunnelVariants.ts`**
- Fetches all active rows from `content_optimization` for the assigned variant using React Query (`staleTime: 5min`)
- Returns map: `{ [step_key]: { headline, subheadline, cta, body } }`

---

### Phase 3: Frontend Components (11 files)

**`src/pages/Experience.tsx`**
- Full-screen page, dark theme (`bg-[#0a0f1a]`)
- No Navigation, Footer, or ExitIntentPopup
- Initializes all 4 hooks; manages `currentStep` and `segment` state
- Uses `startTransition` for all step changes (INP optimization)

**`src/components/funnel/FunnelContainer.tsx`**
- Framer Motion `AnimatePresence` with vertical `translateY` transitions (300ms ease-out, hardware-accelerated)
- Integrates `useSwipeGesture` for touch swipe (up = next, down = back)
- Keyboard support: ArrowDown/Enter = next, ArrowUp = back
- All buttons minimum 48x48px

**`src/components/funnel/FunnelProgress.tsx`**
- Minimal dot-style progress bar fixed at bottom
- Adapts dot count based on active segment path (6 for commercial, 6 for political)

**Step 0 -- `src/components/funnel/steps/WelcomeStep.tsx`**
- `<video autoPlay muted loop playsInline>` hero with high-contrast CSS captions
- Dynamic headline from `content_optimization`
- Early email + organization capture fields
- `onBlur` on email triggers `useAbandonedLeadCapture` -- immediate Supabase insert
- "Get Started" CTA (48px height)

**Step 1 -- `src/components/funnel/steps/SegmentChannelStep.tsx`**
- Two large stacked cards: "Commercial Brand / Retailer" vs "Political Campaign / Non-Profit"
- After segment selection, multi-select checklist: "Which pillars are in your 2026 work plan?"
  - Options: CTV, Digital Ads, Direct Mailers, Billboards (OOH)
  - SMS Fundraising: shown ONLY for Political path
- All checkboxes 48px touch targets

**Step 2A -- `src/components/funnel/steps/CommercialOpportunityStep.tsx`**
- "Generation M" market saturation messaging
- $170.8B stat, 26% aged 18-24, 92% cultural relevance
- Omnichannel: TV + mailbox + commute coverage

**Step 2B -- `src/components/funnel/steps/PoliticalOpportunityStep.tsx`**
- "1:1 Household Precision" messaging
- 33% more swing voters, USPS Tag 57 prioritized delivery
- 40% accuracy tax elimination

**Step 3A -- `src/components/funnel/steps/CommercialProofStep.tsx`**
- Badges: "HIPAA-Compliant Data", "Retail Media Network", "Cultural CTV Precision"
- NO "Voter File" badge (political-only)
- "Trusted by 50+ National Organizations", Cultural Authenticity badge

**Step 3B -- `src/components/funnel/steps/PoliticalProofStep.tsx`**
- Badges: "National Voter File", "FEC Compliant", "Campaign Verify"
- FEC REG 2011-02 disclaimer: persistent overlay with 4-second minimum timer; "Next" button disabled until timer completes (enforced via `useState` + `useEffect` countdown)
- Cultural Authenticity badge

**Step 4 -- `src/components/funnel/steps/QualificationStep.tsx`**
- Single-column layout, pre-filled email/org from Step 0
- Fields: Name, Email, Organization, Role, "Decision Maker?" toggle
- "Who else is involved?" text field (buying authority)
- Multi-select KPI: Cost Per Verified Patient, ROAS, CPA, Voter Persuasion Lift, Donor LTV
- Budget: 3 large color-coded buttons ($5k-$10k blue, $10k-$50k green, $50k+ gold)
- Zod validation on all fields
- On submit: upsert `funnel_leads`, call `funnel-lead-alert` edge function, fire Meta `Lead` event
- If budget >= "$10k+": also fire `Lead_Qualified` custom event (browser-side AND server CAPI via `trackConversion`)

**Step 5 -- `src/components/funnel/steps/ThankYouStep.tsx`**
- If `redirect_to_calendar` is true (score >= 50): "Connecting you..." + auto-redirect to Calendly after 1.5s
- Otherwise: "We'll be in touch within 24 hours" + social links

---

### Phase 4: Edge Function

**`supabase/functions/funnel-lead-alert/index.ts`**
- Registration: `[functions.funnel-lead-alert] verify_jwt = false`
- POST endpoint, uses `getCorsHeaders` from `_shared/security.ts`
- Lead score calculation:
  - Budget "$50k+" = +30
  - Budget "$10k-$50k" = +15
  - Decision Maker = +20
  - 3+ channels selected = +15
  - Has organization = +5
- Hashes email via SHA-256 (reusing `computeEmailHash` from `_shared/phoneHash.ts`)
- Updates `funnel_leads.lead_score` and `status = 'qualified'`
- Updates `funnel_sessions.completed_at` and `lead_id`
- If score >= 50: invokes `send-notification-email` to alert sales team
- If budget >= "$10k+": fires `Lead_Qualified` to Meta CAPI via `meta-conversions` edge function
- Returns `{ redirect_to_calendar: boolean, lead_score: number }`

---

### Phase 5: Routing + Integration

**`src/App.tsx` changes:**
- Add lazy import: `const Experience = lazy(() => import("./pages/Experience"))`
- Add routes: `/experience` and `/get-started` (Navigate redirect to `/experience`)
- Add `/experience` to `DomainRouter` marketing routes array
- The `ExitIntentPopup` already self-filters to `MARKETING_ROUTES` so `/experience` is automatically excluded

**Meta Pixel events** (wired through `useFunnelAnalytics`):
- `PageView`: automatic via existing MetaPixel component
- `FunnelStepView`: custom event per step
- `SegmentSelected`: custom event on path choice
- `Lead`: standard event on form submit
- `Lead_Qualified`: custom event for budget >= $10k+ (fires both browser-side via `trackCustomEvent` AND server-side via `trackConversion` which invokes `meta-conversions` edge function)

---

### Performance Guarantees
- LCP < 2.5s: No heavy images on Step 0; video is muted autoplay; variant copy cached via React Query
- INP < 200ms: All step transitions wrapped in `startTransition`; analytics writes batched and non-blocking via `requestIdleCallback`; no synchronous DB calls on tap handlers
- Bundle: Page lazy-loaded; no new dependencies (Framer Motion already installed)
- Hardware-accelerated Framer Motion: `translateY` only, `will-change: transform`
- Single-column layout on all form steps; all tap targets 48x48px minimum

