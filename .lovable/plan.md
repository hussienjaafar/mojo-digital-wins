
# SMS Data Optimization & AI Learning Integrity Plan

## Current State Summary

| Metric | Value | Status |
|--------|-------|--------|
| **SMS Campaigns** | 83 total, 81 with message text | ✅ Data exists |
| **Campaigns Analyzed** | 0 of 81 | ❌ Critical gap |
| **Deep Motivation Fields** | 0% populated | ❌ AI learning blocked |
| **sms_creative_insights table** | 0 rows | ❌ Empty |
| **Creative Learnings (SMS)** | None | ❌ No patterns learned |
| **Performance Data** | 54 campaigns with conversions | ✅ Available |

---

## Problem Identified

The AI learning system is not receiving donor psychology signals because:

1. **analyze-sms-campaigns** (populates `sms_campaigns.donor_pain_points`, etc.) has **never run** - no scheduled job exists
2. **analyze-sms-creatives** runs on schedule but reads from `sms_creative_insights` which is **empty**
3. **calculate-creative-learnings** cannot compute ROAS correlations for pain points/values without input data

**Bottom line**: The system can tell you *what* campaigns raised money, but not *why* (what psychological triggers worked).

---

## Recommended Strategy

### Safe SMS Storage Optimizations

These changes will **not impact AI learning** since they affect raw event data, not the aggregate campaign data:

| Optimization | Space Saved | Impact on AI |
|--------------|-------------|--------------|
| Purge `delivered` events > 30 days | ~2-3 GB | ✅ None - not used by AI |
| Purge `unknown` events > 7 days | ~500 MB | ✅ None - not used by AI |
| Convert `phone_hash` to BYTEA | ~1 GB | ✅ None - internal format |
| Archive events > 90 days | Ongoing | ⚠️ Low - donor journeys truncated in UI |

### Restore AI Learning (Critical Path)

1. **Run analyze-sms-campaigns** on all 81 unanalyzed campaigns to populate motivation fields
2. **Add scheduled job** for analyze-sms-campaigns (batch of 10, every 4 hours)
3. **Populate sms_creative_insights** from sms_campaigns so calculate-creative-learnings can process SMS data
4. **Verify creative learnings** job processes SMS channel data

---

## Phase 1: Immediate AI Backfill

Run the existing `analyze-sms-campaigns` function on all 81 unanalyzed campaigns.

**Expected Outcome**: All campaigns will have:
- topic, tone, urgency_level
- donor_pain_points (e.g., "deportation of community members")
- values_appealed (e.g., "family protection", "immigrant rights")
- emotional_triggers (e.g., "fear", "solidarity")

---

## Phase 2: Automated Analysis Schedule

Create a scheduled job entry for `analyze-sms-campaigns`:

| Field | Value |
|-------|-------|
| job_name | Analyze SMS Campaigns |
| job_type | edge_function |
| endpoint | analyze-sms-campaigns |
| schedule | 0 */4 * * * (every 4 hours) |
| payload | {"batch_size": 10} |

---

## Phase 3: Storage Optimization (Safe)

### A. Immediate Cleanup - Low-Value Events

Create edge function or SQL to purge:
- `event_type = 'delivered'` older than 30 days
- `event_type = 'unknown'` older than 7 days
- `event_type = 'sent'` older than 60 days (keep metadata in sms_campaigns)

### B. Schema Optimization (Future)

Convert `phone_hash` from 64-char hex TEXT to 32-byte BYTEA:
- Requires migration script
- ~1 GB savings
- Must update all functions using phone_hash (5 edge functions)

---

## Phase 4: Bridge SMS Data to Learning Pipeline

The `sms_creative_insights` table exists but is unpopulated. Two options:

**Option A**: Create sync function to copy analyzed campaigns to sms_creative_insights
- Preserves existing architecture
- More tables to maintain

**Option B**: Modify `calculate-creative-learnings` to read directly from `sms_campaigns`
- Simpler data flow
- Single source of truth

---

## Expected Outcomes

After implementation:

| Capability | Before | After |
|------------|--------|-------|
| AI knows what topics perform best | ❌ | ✅ |
| AI knows which pain points drive donations | ❌ | ✅ |
| AI knows which emotional triggers work | ❌ | ✅ |
| Donor segmentation by motivation | ❌ | ✅ |
| SMS storage size | ~6.3 GB | ~3.5 GB |

---

## Technical Implementation Order

1. **Backfill analysis** - Run analyze-sms-campaigns for all 81 campaigns (AI prerequisite)
2. **Add scheduled job** - Automate future analysis
3. **Verify data flow** - Confirm creative learnings can access SMS motivation data
4. **Storage cleanup** - Purge low-value raw events (after AI data is secured)
5. **Schema optimization** - BYTEA migration (optional, future phase)

---

## Risk Assessment

| Action | Risk | Mitigation |
|--------|------|------------|
| Purging delivered/unknown events | Low - not used by AI | Verify with queries first |
| Purging old sent events | Medium - donor journey UI | Keep 90 days minimum |
| BYTEA migration | Medium - code changes | Test in staging first |
| Backfill analysis | Low | Already uses rate limiting |

---

## Summary

The storage optimizations are **safe** for AI learning because the AI systems read from **aggregate tables** (`sms_campaigns`, `creative_performance_learnings`), not raw `sms_events`.

However, a **critical gap** was discovered: the AI has never actually analyzed any SMS campaigns for donor psychology. This must be fixed **before** any storage cleanup to ensure the learning data is captured.
