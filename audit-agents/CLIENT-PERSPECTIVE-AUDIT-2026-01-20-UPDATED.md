# Client Perspective Audit Report (UPDATED)

**Date:** January 20, 2026
**Auditor:** Claude Code
**Perspective:** Advocacy Organization / Political Professional User

---

## Executive Summary

**VERDICT: Tool is functional but has a critical UX gap**

| Category | Status | Details |
|----------|--------|---------|
| Data Pipeline | ✅ PASS | 58,965 articles, 585 trending topics |
| Ground Truth Alignment | ✅ PASS | Real breaking news is being captured |
| Multi-Source Rate | ✅ PASS | 76.5% (target >70%) |
| Single-Word Rate | ✅ PASS | 9.1% (target <15%) |
| Event Phrase Rate | ⚠️ BELOW TARGET | 40.5% (target >50%) |
| Drill-Down Quality | ✅ GOOD | Diverse sources, recent articles, useful |
| **Display Labels** | ❌ CRITICAL GAP | Rich context exists but isn't shown |

**Bottom Line:** The tool detects real news accurately, but displays generic entity names instead of actionable event descriptions. A client sees "Israel" when the system knows "Israeli forces kill 9 in Gaza including 5 children."

---

## 1. Ground Truth Comparison

### Does the tool capture what's actually trending?

| Breaking Story (Jan 19-20, 2026) | Captured? | How It Appears |
|----------------------------------|-----------|----------------|
| ICE raids / Minneapolis shooting | ✅ Yes | "Renee Nicole Good", "Chuck Schumer", "Hakeem Jeffries" |
| Trump Greenland ambitions | ✅ Yes | "Donald Trump" drill-down shows Greenland headlines |
| House override votes | ✅ Yes | "House of Representatives", "Colorado" |
| Tim Walz controversy | ✅ Yes | "Tim Walz Is a Reckless Menace" |
| Israel/Gaza violence | ✅ Yes | "Israel" (context: 9 killed including children) |
| Venezuela/Maduro | ✅ Yes | "Venezuela", "Nicolás Maduro" |
| India-China policy shift | ✅ Yes | "India" (context: scrap curbs on Chinese firms) |

**Assessment:** ✅ The tool IS capturing real breaking political news.

---

## 2. The Display Label Problem

### What clients see vs what the system knows

| Display Title (event_title) | Actual Context (canonical_label) | Gap |
|-----------------------------|----------------------------------|-----|
| "Israel" | "Israeli forces kill 9 in Gaza including 5 children" | ❌ Critical |
| "Venezuela" | "Venezuela" | No improvement |
| "Chuck Schumer" | "Jeffries, Schumer demand probes after fatal ICE shooting" | ❌ Critical |
| "House Of Representatives" | "House to vote on overriding Trump vetoes" | ❌ Critical |
| "India" | "India plans to scrap curbs on Chinese firms" | ❌ Critical |

**The system has actionable context but displays generic labels.**

### Why this matters for clients

An advocacy org scanning for breaking news sees:
- ❌ "Israel" - Tells them nothing actionable
- ✅ "Israeli forces kill 9 in Gaza including 5 children" - Immediately actionable

**Recommendation:** Display `canonical_label` when it contains richer context than `event_title`.

---

## 3. Event Phrase Rate Analysis

### Current: 40.5% (Target: >50%)

| Label Source | Count | Event Phrase Rate | Issue |
|--------------|-------|-------------------|-------|
| `fallback_attempted` | 76 | **0%** | Complete failure - needs fix |
| `event_phrase_downgraded` | 98 | 20% | Downgrading good phrases |
| `fallback_downgraded` | 57 | 40% | Moderate |
| `(null/legacy)` | 326 | 53% | Best performing, but untracked |
| `metadata_event_phrase` | 15 | 100% | Working correctly |
| `fallback_generated` | 2 | 100% | Working correctly |

### Root Cause Breakdown

1. **`fallback_attempted` (76 trends, 0% event phrases)**
   - These are trends where fallback generation was attempted but failed
   - 100% failure rate means the fallback logic has a bug
   - **Priority: HIGH**

2. **`event_phrase_downgraded` (98 trends, 20% event phrases)**
   - Good event phrases are being downgraded to entities
   - Likely the validation is too strict
   - **Priority: HIGH**

3. **Legacy data (326 trends, no label_source)**
   - 56% of data is untracked, making it hard to debug
   - Should backfill `label_source` for these records

---

## 4. Drill-Down Quality Assessment

### "Why This Is Trending" Feature - GOOD

Using the "Donald Trump" trend as example:

| Aspect | Assessment | Rating |
|--------|------------|--------|
| Primary context | "Trump reveals snub behind Greenland ambitions" | ✅ Clear |
| Source diversity | 10 sources (Guardian, Al Jazeera, The Hill, etc.) | ✅ Excellent |
| Recency | All within last hour | ✅ Fresh |
| Source quality indicators | Tier 1/2 labels shown | ✅ Useful |
| Headlines shown | Actual article titles, diverse angles | ✅ Informative |

**Verdict:** The drill-down IS useful for a political professional. They can see:
- The main story angle
- Multiple perspectives (left/right sources)
- International coverage
- How recent the story is

### Suggested Improvements

1. **Show canonical_label prominently** - not buried in drill-down
2. **Add "Why This Matters" summary** - algorithm-generated explanation
3. **Highlight cross-source corroboration** - "Reported by 41 sources across political spectrum"

---

## 5. Would a Client Trust This Tool?

### Advocacy Organization Assessment

| Trust Factor | Current | Needed | Gap |
|--------------|---------|--------|-----|
| Captures real news | ✅ Yes | ✅ | None |
| Timely updates | ✅ Yes (hourly) | ✅ | None |
| Source diversity | ✅ 76.5% multi-source | ✅ | None |
| Actionable labels | ❌ Generic entities | Event phrases | **Critical** |
| Drill-down context | ✅ Good | ✅ | None |
| Trustworthy sources | ✅ Tier indicators | ✅ | None |

### Verdict by Use Case

| Use Case | Current Fitness | Blocker |
|----------|-----------------|---------|
| "What's breaking right now?" | ⚠️ Partial | Must click into each trend to understand it |
| "Should we respond to this story?" | ✅ Good | Drill-down provides needed context |
| "Quick scan of political landscape" | ❌ Poor | Labels too generic |
| "Deep dive on specific topic" | ✅ Good | Evidence table is comprehensive |

---

## 6. Priority Fixes

### Critical (Immediate)

1. **Surface canonical_label in the UI**
   - When `canonical_label` is longer/richer than `event_title`, display it
   - Or show both: "Israel: Israeli forces kill 9 in Gaza"

2. **Fix `fallback_attempted` (0% success rate)**
   - 76 trends completely failing to generate event phrases
   - Check `generateFallbackEventPhrase()` in `detect-trend-events`

### High Priority

3. **Investigate `event_phrase_downgraded`**
   - Why are 80% being downgraded?
   - Check `containsVerbOrEventNoun()` validation

4. **Backfill `label_source` for legacy data**
   - 326 trends (56%) have no tracking
   - Run classification on existing data

### Medium Priority

5. **Improve "Why This Matters" explanation**
   - Current: Shows articles
   - Better: "This story spiked 85% in the last hour with coverage from 41 sources including major outlets on both sides of the political spectrum."

---

## 7. Metrics Summary

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| Multi-Source Rate | 76.5% | >70% | ✅ PASS |
| Single-Word Rate | 9.1% | <15% | ✅ PASS |
| Event Phrase Rate | 40.5% | >50% | ⚠️ -9.5% |
| Data Freshness | 114/hour | Active | ✅ PASS |
| Ground Truth Alignment | High | - | ✅ PASS |
| Display Label Quality | Low | High | ❌ CRITICAL |

---

## 8. Conclusion

**The tool works. The detection is accurate. The display is the problem.**

A political professional using this tool would:
- ✅ See real breaking news
- ✅ Get diverse, timely sources in drill-down
- ❌ Struggle to scan quickly (generic labels)
- ❌ Need to click into every trend to understand it

**One critical fix would transform user experience:**
> Display `canonical_label` instead of `event_title` when richer context is available.

This single change would turn:
- "Israel" → "Israeli forces kill 9 in Gaza including 5 children"
- "Chuck Schumer" → "Jeffries, Schumer demand probes after fatal ICE shooting"
- "India" → "India plans to scrap curbs on Chinese firms"

---

## Appendix: Lovable Fix Prompt

```
Fix the event phrase display issue in the trend detection UI.

Current problem: Trends display generic entity names (e.g., "Israel", "Chuck Schumer")
even when the system has richer context in canonical_label (e.g., "Israeli forces kill
9 in Gaza including 5 children").

Changes needed:

1. In the frontend trend display component, prefer canonical_label over event_title when:
   - canonical_label exists and is not null
   - canonical_label.length > event_title.length
   - canonical_label contains a verb (action word)

2. In detect-trend-events/index.ts, fix the fallback_attempted issue:
   - 76 trends have label_source='fallback_attempted' with 0% event phrase rate
   - Check why generateFallbackEventPhrase() is failing for these
   - Add logging to track fallback success/failure reasons

3. Investigate event_phrase_downgraded:
   - 98 trends are being downgraded from event phrases to entities
   - Check the validation in containsVerbOrEventNoun() - may be too strict
   - Log what's being rejected and why

Success criteria:
- Event phrase rate increases from 40.5% to >50%
- UI displays actionable phrases, not just entity names
- fallback_attempted success rate > 50%
```

---

**Audit Complete:** January 20, 2026
**Next Audit:** After display label fixes are deployed
