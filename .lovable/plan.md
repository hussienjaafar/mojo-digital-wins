

# Fix: Show Detailed Pain Points Instead of Broad Topics

## Problem

The `topic` column in `meta_creative_insights` only has 6 broad categories ("foreign policy", "fundraising general", etc.), while `issue_specifics` is completely empty. However, `donor_pain_points` contains rich, specific data like "frustration with lobbyist influence (AIPAC)" and "belief that tax dollars are funding 'genocide'."

Currently the UI shows the broad `topics` field as the "Top Topic" column — which is unhelpful.

## Plan

### 1. Change "Top Topic" column to "Top Issue" — show pain points instead

In `DonorUniverse.tsx`:
- Rename column header from "Top Topic" to "Top Issue"
- Display `pain_points[0]` (falling back to `topics[0]`) as the badge content
- Truncate to fit the column

### 2. Update detail panel priority in `DonorUniverseDetail.tsx`

- Lead with **Pain Points** (most specific data) instead of topics
- Show topics only as a secondary "Category" label
- Reorder the motivation section: Pain Points → Values → Topics (as category tag)

### Files changed

| File | Change |
|------|--------|
| `src/components/admin/DonorUniverse.tsx` | Swap "Top Topic" column to show `pain_points[0]` with fallback to `topics[0]` |
| `src/components/admin/DonorUniverseDetail.tsx` | Reorder motivation section to prioritize pain points over broad topics |

