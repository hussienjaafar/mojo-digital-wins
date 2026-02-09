

# Fix: Refcode Slugs Not Differentiating Due to Hyphen Handling

## Problem

The `issue_primary` values contain hyphenated terms like `"pro-Palestinian"` and `"anti-genocide"`. The current logic strips hyphens with `replace(/[^a-z0-9\s]/g, '')`, which merges them into single words like `"propalestinian"` and `"antigenocide"`. These merged words don't match any skip words (e.g., `"pro"`, `"palestinian"`), so the skip-word filtering has no effect and every slug still starts with `"propalestini..."`.

## Root Cause

Line 62 in `CampaignConfigStep.tsx`:
```
.replace(/[^a-z0-9\s]/g, '')
```
This removes hyphens, fusing `"pro-Palestinian"` into `"propalestinian"` before the word split happens.

## Fix

Change the regex to **replace hyphens (and other non-alphanumeric chars) with spaces** instead of stripping them. This way `"pro-Palestinian"` becomes `"pro palestinian"` and then correctly splits into two words that get filtered out.

### Single line change

In `generateRefcode`, change:
```
.replace(/[^a-z0-9\s]/g, '')
```
to:
```
.replace(/[^a-z0-9]/g, ' ')
```

This ensures hyphens become word boundaries, so the skip-word filter can properly remove "pro", "anti", "palestinian", etc., leaving only the distinctive keywords.

## File to Modify

| File | Change |
|------|--------|
| `src/components/ad-copy-studio/steps/CampaignConfigStep.tsx` | Line 62: replace strip regex with space-replacement regex |

## Expected Results

| `issue_primary` | Before | After |
|-----------------|--------|-------|
| pro-Palestinian advocacy and legislative representation | `propalestini` | `advocacy` |
| pro-Palestinian free-speech defense | `propalestini` | `freespeechde` |
| pro-Palestine anti-offensive-weapons-sales | `propalestine` | `offensiveweap` |
| pro-Palestine anti-genocide political-influence | `propalestine` | `genocidepoli` |
| pro-Muslim political-representation anti-genocide | `promuslimpol` | `politicalrep` |

