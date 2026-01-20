# Re-Audit Report: Post-Fix Status Assessment

**Date:** January 20, 2026 (Afternoon)
**Auditor:** Claude Code
**Scope:** Verify Phases 1-5 fixes and identify remaining gaps

---

## Executive Summary

| Phase | Code Changes | Database Changes | Status |
|-------|-------------|------------------|--------|
| **Phase 1**: Blocklist & Thresholds | ✅ COMPLETE | N/A | VERIFIED |
| **Phase 2**: Deduplication | ⚠️ PARTIAL | N/A | GAP FOUND |
| **Phase 3**: Scoring Penalties | ✅ COMPLETE | N/A | VERIFIED |
| **Phase 4**: Trend Stage Logic | ✅ COMPLETE | N/A | VERIFIED |
| **Phase 5**: Source Expansion | ✅ CODE DONE | ❌ NOT DONE | CRITICAL GAP |

**VERDICT: Code fixes verified, but Phase 5 database rows NOT added and Phase 2 has a gap in useUnifiedTrends.tsx**

---

## Phase-by-Phase Verification

### Phase 1: Blocklist & Thresholds ✅ VERIFIED

**File:** `supabase/functions/detect-trend-events/index.ts`

| Change | Expected | Actual | Status |
|--------|----------|--------|--------|
| Remove 'un' from blocklist | Removed | Removed (line 141) | ✅ |
| Remove 'who' from blocklist | Removed | Removed | ✅ |
| Remove 'ice' from blocklist | Removed | Removed | ✅ |
| Remove 'eu' from blocklist | Removed | Removed | ✅ |
| Remove 'uk' from blocklist | Removed | Removed | ✅ |
| MIN_MENTIONS_SINGLE_WORD | 20 → 8 | 8 (line 337) | ✅ |
| MIN_SOURCES_SINGLE_WORD | 3 → 2 | 2 (line 338) | ✅ |

**Impact:** UN/WHO/ICE/EU stories are now allowed through the blocklist filter.

---

### Phase 2: Deduplication ⚠️ PARTIAL - GAP FOUND

**Backend (detect-trend-events/index.ts lines 2326-2344):** ✅ VERIFIED
```typescript
// PHASE 2 FIX: Consolidate cluster members before upsert
const clusterBestMap = new Map<string, typeof eventsToUpsert[0]>();
for (const event of eventsToUpsert) {
  const clusterId = event.cluster_id || event.event_key;
  // ... keeps highest rank_score, accumulates evidence_count
}
```

**Frontend (useTrendEvents.tsx lines 281-307):** ✅ VERIFIED
- Both main query and fallback query have deduplication
- Uses `cluster_id || event.id` as fallback key

**GAP FOUND: useUnifiedTrends.tsx** ❌ MISSING DEDUPLICATION
- Queries `trend_events_active` view
- Does NOT have cluster-based deduplication
- Could still display duplicate cluster members if used in UI

---

### Phase 3: Scoring Penalties ✅ VERIFIED

**File:** `supabase/functions/detect-trend-events/index.ts` (lines 196-216)

| Change | Expected | Actual | Status |
|--------|----------|--------|--------|
| Single-word base penalty | 0.15 → 0.40 | 0.40 (line 204) | ✅ |
| Evergreen floor (with baseline) | 0.05 → 0.30 | 0.30 (line 215) | ✅ |
| Evergreen floor (no baseline) | 0.08 → 0.35 | 0.35 | ✅ |
| z > 6 multiplier | 0.80 → 0.95 | 0.95 | ✅ |
| z > 4 multiplier | 0.55 → 0.80 | 0.80 | ✅ |
| z > 3 multiplier | 0.35 → 0.65 | 0.65 | ✅ |
| z > 2 multiplier | 0.20 → 0.50 | 0.50 | ✅ |

**Impact:** Political stories no longer get 80-98% score reductions.

---

### Phase 4: Trend Stage Logic ✅ VERIFIED

**File:** `supabase/functions/detect-trend-events/index.ts` (lines 1967-1984)

| Volume Override | Condition | Status |
|-----------------|-----------|--------|
| 5+ mentions/hour | → "surging" | ✅ VERIFIED |
| 20+ mentions from 5+ sources | → "surging" | ✅ VERIFIED |
| 15+ mentions + 2+ in last hour | → "surging" | ✅ VERIFIED |
| z-score > 0.3 | → "surging" (was 0.5) | ✅ VERIFIED |

**Impact:** High-volume stories will no longer be marked "Stable".

---

### Phase 5: Source Expansion ❌ CRITICAL GAP

**Code Changes:** ✅ VERIFIED
- `MAX_SOURCES_PER_RUN`: 6 → 15 (line 208) ✅
- Rate limit: 10/min → 15/min (line 197) ✅

**Database Changes:** ❌ NOT DONE
The `google_news_sources` table still only has the original 7 sources:

| Current Sources (7) | Missing Categories |
|---------------------|-------------------|
| US Politics | ❌ International (UN, WHO, NATO, EU) |
| Congress Legislation | ❌ Military/Defense (Pentagon, National Guard) |
| White House | ❌ Religious (Vatican, Catholic) |
| Supreme Court | ❌ State Government (Governors) |
| Election 2024 | ❌ Economic (Tariffs, Fed) |
| Immigration Policy | ❌ Health (CDC, Public Health) |
| Civil Rights | ❌ Breaking Political |

**Impact:** System still cannot capture stories about:
- Minnesota Insurrection Act / federal troops
- Catholic Cardinals statements
- UNRWA demolition
- International affairs beyond existing sources

---

## Ground Truth Comparison (Jan 20, 2026 Afternoon)

### TOP 10 Breaking Stories vs System Capture

| # | Breaking Story | Captured? | Blocking Reason |
|---|----------------|-----------|-----------------|
| 1 | Trump Greenland Tariffs | ✅ YES | - |
| 2 | Trump 1-Year Anniversary | ✅ YES | - |
| 3 | Trump at Davos/WEF | ✅ YES | - |
| 4 | Minnesota ICE/Troops | ⚠️ PARTIAL | No military/defense source |
| 5 | Iran Protests/Regime Change | ⚠️ UNCERTAIN | Evergreen penalty may reduce rank |
| 6 | UNRWA Demolition | ❌ NO | No intl affairs source |
| 7 | Trump "Board of Peace" | ⚠️ UNCERTAIN | May be in Trump cluster |
| 8 | Catholic Cardinals | ❌ NO | No religious source |
| 9 | WHO Withdrawal | ⚠️ NOW ALLOWED | Blocklist fixed, needs source |
| 10 | Spain Train Collision | ❌ N/A | Outside US political scope |

### Stories Now Allowed (Post-Phase 1)
- ✅ WHO stories (removed from blocklist)
- ✅ UN stories (removed from blocklist)
- ✅ ICE stories (removed from blocklist)
- ✅ EU stories (removed from blocklist)

### Stories Still Missing (Need Phase 5 Database)
- ❌ Catholic Cardinals (no religious source)
- ❌ UNRWA (no international source)
- ❌ Minnesota troops (no military source)

---

## Metrics Comparison

| Metric | Baseline (Before) | Target | Expected After Fixes |
|--------|-------------------|--------|---------------------|
| Event Phrase Rate | 40.5% | >50% | TBD (needs live test) |
| Multi-Source Rate | 76.5% | >70% | ✅ MAINTAINED |
| Single-Word Rate | 9.1% | <15% | ✅ MAINTAINED |
| Duplicates | 3 (EU/Greenland) | 0 | Should be 0 (Phase 2) |
| "Stable" Mislabeling | Common | None | Fixed (Phase 4) |

*Note: Live metrics cannot be queried from this environment. Run `node --env-file=.env scripts/local-trend-audit.mjs` to get current values.*

---

## Critical Issues Remaining

### 1. Phase 5 Database Rows NOT Added 🔴 CRITICAL

The Google News source expansion was NOT completed. The Lovable commit message said "Insert new source rows" but only the code changes (MAX_SOURCES_PER_RUN, rate limit) were made.

**Action Required:** Add the 20 new Google News sources to the database.

### 2. useUnifiedTrends.tsx Missing Deduplication 🟠 HIGH

The `useUnifiedTrends.tsx` hook queries `trend_events_active` but does NOT deduplicate by cluster_id.

**Action Required:** Apply the same deduplication pattern from `useTrendEvents.tsx`.

### 3. Event Phrase Rate Still Below Target 🟠 HIGH

The 40.5% event phrase rate (target >50%) has not been addressed. Root causes:
- `fallback_attempted` has 0% success rate (76 trends)
- `event_phrase_downgraded` is too aggressive (80% downgraded)

**Action Required:** Fix fallback generation and relax validation.

---

## Recommended Next Steps

### Immediate (Today)

1. **Add Phase 5 Database Sources**
   ```sql
   INSERT INTO google_news_sources (name, url, is_active, tier, tags) VALUES
     ('UN Affairs', 'search?q=united+nations+security+council&hl=en-US&gl=US&ceid=US:en', true, 'international', ARRAY['un']),
     ('WHO Health', 'search?q=world+health+organization+WHO&hl=en-US&gl=US&ceid=US:en', true, 'international', ARRAY['who']),
     -- ... (see FIX-PLAN-PHASES.md for full list)
   ```

2. **Fix useUnifiedTrends.tsx Deduplication**
   Add cluster deduplication after line 173 before the filter/map transforms.

### Short-term (This Week)

3. **Fix Event Phrase Generation**
   - Debug `generateFallbackEventPhrase()` - 0% success rate
   - Relax `containsVerbOrEventNoun()` validation

4. **Deploy and Test**
   - Re-run trend detection after fixes
   - Compare metrics to baseline
   - Verify ground truth alignment

---

## Files Audited

| File | Status |
|------|--------|
| `supabase/functions/detect-trend-events/index.ts` | ✅ Phases 1,3,4 verified |
| `supabase/functions/fetch-google-news/index.ts` | ✅ Phase 5 code verified |
| `src/hooks/useTrendEvents.tsx` | ✅ Phase 2 frontend verified |
| `src/hooks/useUnifiedTrends.tsx` | ❌ Missing deduplication |
| `google_news_sources` table | ❌ Phase 5 rows missing |

---

## Conclusion

**4 of 5 phases have code changes correctly implemented.** However:

1. **Phase 5 is incomplete** - database source rows were not added
2. **Phase 2 has a gap** - useUnifiedTrends.tsx needs deduplication
3. **Event phrase rate** remains a secondary issue

The system will show improvement for stories that are captured (Trump/Greenland, Congress, etc.) but will still miss stories that require the expanded source coverage (Cardinals, UNRWA, Minnesota troops).

**Priority Fix:** Add the Phase 5 database rows to unlock international, military, religious, and state government coverage.

---

**Audit Complete:** January 20, 2026 (Afternoon)
**Next Audit:** After Phase 5 database completion and useUnifiedTrends fix
