

# Enrich Ad Copy Generation with Organization Context and Research-Backed Improvements

## Overview

The ad copy generation currently only uses transcript data and audience segment info. The `organization_profiles` table already stores rich organization context (mission, focus areas, allies, opponents, stakeholders, key issues, geographies, sensitivity redlines, and raw AI-extracted website data) that is never passed to the AI. This plan integrates that context into the prompt and applies research-backed improvements to donation amount strategy.

## Changes

### 1. Fetch Organization Profile in Edge Function

**File:** `supabase/functions/generate-ad-copy/index.ts`

After fetching the org slug (line ~403), also fetch the organization profile:

```sql
SELECT mission_summary, focus_areas, key_issues, allies, opponents,
       stakeholders, geographies, sensitivity_redlines, ai_extracted_data
FROM organization_profiles
WHERE organization_id = effectiveOrgId
```

This data is already in the database from the onboarding scrape -- no new scraping needed at generation time.

### 2. Add Organization Context to the Prompt

**File:** `supabase/functions/_shared/prompts.ts`

Update `buildAdCopyUserMessage` to accept an optional `organizationContext` parameter and inject a new `## ORGANIZATION CONTEXT` section into the user message:

```
## ORGANIZATION CONTEXT
Mission: [mission_summary]
Focus Areas: [focus_areas joined]
Key Issues: [key_issues joined]
Allies: [allies joined]
Opponents: [opponents joined]
Geographic Focus: [geographies joined]
Redlines (NEVER say this): [sensitivity_redlines]
```

This gives the AI grounding in who the organization is, what they stand for, and what to avoid -- all derived from their actual website.

### 3. Update System Prompt with Research-Backed Improvements

**File:** `supabase/functions/_shared/prompts.ts`

Enhance `AD_COPY_SYSTEM_PROMPT` with three additions:

**a) Segment-Aware Donation Amounts** -- Currently hardcoded. Add a rule:
- Acquisition/cold traffic: suggest $5, $10 (low friction)
- Retention/warm traffic: suggest $27, $50 (higher anchor)
- The segment tone guidance already handles this per-segment, so reinforce it in the system prompt as a hard rule

**b) Enforced Impact Framing** -- Currently optional. Make it a hard rule:
- Every CTA with a dollar amount MUST connect it to a concrete outcome from the transcript (e.g., "Your $10 helps us fight the bill that would cut X")
- Add this as Hard Rule #7

**c) Organization Alignment Rule** -- New hard rule:
- Copy MUST reflect the organization's mission and values from the context
- Copy MUST NOT violate any sensitivity redlines
- Add this as Hard Rule #8

### 4. Pass Organization Context Through the Generation Pipeline

**File:** `supabase/functions/generate-ad-copy/index.ts`

- Pass the fetched profile data into `generateCopyForSegment`
- `generateCopyForSegment` passes it to `buildAdCopyUserMessage`
- No changes to the tool schema or AI response format needed -- this is purely additional context in the user message

### 5. Graceful Degradation

If no organization profile exists (e.g., profile wasn't set up during onboarding), generation proceeds as before with no organization context section. The profile fetch uses `.maybeSingle()` so a missing profile is not an error.

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/generate-ad-copy/index.ts` | Fetch org profile from DB; pass to `generateCopyForSegment` |
| `supabase/functions/_shared/prompts.ts` | Add org context param to `buildAdCopyUserMessage`; add hard rules #7 (impact framing) and #8 (org alignment + redlines) to system prompt |

## What This Does NOT Change

- No database migrations needed (data already exists)
- No UI changes needed (context is injected server-side)
- No changes to the tool calling schema or response format
- No new edge functions or API calls at generation time
- The existing scrape-organization-website flow during onboarding already populates this data

