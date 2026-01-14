# Ad Performance Attribution System

## Overview

This document explains how donations are attributed to Meta ads for ROAS calculation in the Ad Performance page.

## Attribution Priority

Donations are matched to ads using the following priority order:

| Priority | Method | Key | Description | Quality |
|----------|--------|-----|-------------|---------|
| 1 | Direct ad_id | `attributed_ad_id` | Donation has explicit ad_id from refcode_mappings | Deterministic |
| 2 | Creative ID | `attributed_creative_id` | Donation mapped via creative_id in refcode_mappings | Deterministic |
| 3 | Refcode Direct | `refcode` → `extracted_refcode` | Match donation.refcode to creative's extracted_refcode | Deterministic |
| 4 | Unattributed | - | No match found | Unknown |

## Data Flow

```
ActBlue Transaction
       │
       ├── refcode (from donation URL)
       │
       ▼
refcode_mappings
       │
       ├── ad_id (from creative sync)
       ├── creative_id (from creative sync)
       ├── campaign_id (from creative sync)
       │
       ▼
donation_attribution (VIEW)
       │
       ├── attributed_ad_id
       ├── attributed_creative_id
       ├── attributed_campaign_id
       │
       ▼
useAdPerformanceQuery
       │
       ├── Match by ad_id
       ├── Match by creative_id
       └── Match by refcode (direct)
```

## Requirements for Accurate Attribution

### 1. Unique Refcodes per Ad

Each Meta ad MUST have a unique refcode in its destination URL:

```
https://secure.actblue.com/donate/your-form?refcode=fb_ad_123
```

**Good:**
- `refcode=ad_{ad_id}` - Unique per ad
- `refcode=creative_{creative_id}` - Unique per creative
- `refcode=campaign_2024Q1_ad01` - Descriptive and unique

**Bad:**
- `refcode=facebook` - Too generic, shared across ads
- No refcode at all - Cannot attribute

### 2. Refcode Extraction in Sync

The `sync-meta-ads` function extracts refcodes from:

1. `object_story_spec.link_data.link`
2. `object_story_spec.link_data.call_to_action.value.link`
3. `object_story_spec.video_data.call_to_action.value.link`
4. `asset_feed_spec.link_urls[0].website_url`
5. `asset_feed_spec.call_to_actions[0].value.link`

Extracted refcodes are stored in `meta_creative_insights.extracted_refcode`.

### 3. Refcode Reconciliation

Run `refcode-reconcile` function to sync refcode mappings:

```bash
curl -X POST https://<project>.supabase.co/functions/v1/refcode-reconcile \
  -H "Authorization: Bearer <service_role_key>" \
  -d '{"organization_id": "<org_uuid>"}'
```

This populates `refcode_mappings` with:
- `refcode` → From extracted_refcode
- `ad_id` → From meta_creative_insights.ad_id
- `creative_id` → From meta_creative_insights.creative_id
- `campaign_id` → From meta_creative_insights.campaign_id

## Metrics Data Source

### Ad-Level Metrics (Preferred)

When `meta_ad_metrics_daily` has data:
- Spend, impressions, clicks are TRUE per-ad values
- Matches Meta Ads Manager exactly
- CTR, CPC, CPM calculated from actual ad data

### Campaign-Level Fallback (Legacy)

When `meta_ad_metrics_daily` is empty:
- Falls back to `meta_ad_metrics` table
- Distributes campaign spend evenly across creatives
- Results in identical spend/CTR across ads in same campaign
- Shows "Estimated Metrics" banner in UI

## Attribution Quality Metrics

The system tracks attribution quality:

| Metric | Meaning |
|--------|---------|
| `directAdIdMatches` | Donations with explicit ad_id attribution |
| `creativeIdMatches` | Donations matched via creative_id |
| `refcodeMatches` | Donations matched via refcode direct |
| `unattributedCount` | Donations that couldn't be matched |

## Troubleshooting

### All ads show identical spend

**Cause:** `meta_ad_metrics_daily` table is empty (migration not applied or sync not run)

**Fix:**
1. Apply migration: `20260113000001_ad_level_metrics_daily.sql`
2. Run `sync-meta-ads` for the organization

### Raised is $0 for all ads

**Cause:** No ad_id in `refcode_mappings` or refcodes don't match

**Fix:**
1. Verify ActBlue transactions have refcodes: `SELECT refcode, COUNT(*) FROM actblue_transactions GROUP BY refcode`
2. Verify creatives have extracted_refcode: `SELECT extracted_refcode, ad_id FROM meta_creative_insights WHERE extracted_refcode IS NOT NULL`
3. Run `refcode-reconcile` to sync mappings

### Unattributed donations banner shows

**Cause:** Donations exist but couldn't be matched to any ad

**Possible reasons:**
- Donation refcode doesn't match any creative refcode
- Creative has no ad_id populated
- Refcode not extracted from ad URL

**Check:**
```sql
-- Find unmatched refcodes
SELECT t.refcode, COUNT(*) as donations, SUM(t.net_amount) as raised
FROM actblue_transactions t
LEFT JOIN refcode_mappings rm ON t.refcode = rm.refcode AND t.organization_id = rm.organization_id
WHERE rm.refcode IS NULL AND t.refcode IS NOT NULL
GROUP BY t.refcode
ORDER BY raised DESC;
```

## Best Practices

1. **Always use unique refcodes per ad** - Include ad_id or creative_id in refcode
2. **Run sync-meta-ads regularly** - Ensures fresh ad-level metrics
3. **Run refcode-reconcile after sync** - Updates refcode mappings with new ads
4. **Verify refcodes in Ads Manager** - Check destination URLs have proper refcode params
5. **Monitor attribution quality** - Check console logs in dev mode for stats
