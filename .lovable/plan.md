

# Generation History for Ad Copy Studio

## Overview

Add a "Generation History" feature that lets users select an organization and browse all previously generated ad copy, with full detail about which video/ad it was generated for, the audience segments, model used, and the ability to re-view and re-export past generations.

## Where It Lives

The history view will be accessible from two places:
1. **Organization Selection Gate (Step 0):** Each org row shows a small badge with the count of past generations. After selecting an org, a "History" tab appears alongside the wizard.
2. **Wizard Header:** A "History" button/icon next to the reset button opens a slide-out panel showing past generations for the current org.

## Data Available

The `ad_copy_generations` table already stores everything needed:
- `organization_id` -- which org
- `video_ref` -- links to `meta_ad_videos.id` (has `original_filename`)
- `transcript_ref` -- links to `meta_ad_transcripts.id` 
- `actblue_form_name`, `refcode` -- campaign config
- `audience_segments` -- JSON with segment names/descriptions
- `generated_copy` / `meta_ready_copy` -- the actual ad copy output
- `tracking_url` -- the destination URL
- `generation_model`, `generation_prompt_version` -- AI model info
- `generated_at` -- timestamp

## Implementation

### Step 1: Create GenerationHistoryPanel component

New file: `src/components/ad-copy-studio/GenerationHistoryPanel.tsx`

A slide-out panel (or full-width section) that:
- Fetches all `ad_copy_generations` for the selected `organization_id`, joined with `meta_ad_videos` (for `original_filename`) via `video_ref`
- Displays a list of generation cards sorted by `generated_at` DESC
- Each card shows:
  - **Video name** (from `meta_ad_videos.original_filename`) -- the ad it was generated for
  - **Date/time** generated (relative, e.g., "2 hours ago" + absolute on hover)
  - **Audience segments** as pills/badges (from `audience_segments` JSON)
  - **ActBlue form** name + refcode
  - **Model version** badge (e.g., "Gemini 2.5 Pro v4.0")
  - **Variation count** (computed from `generated_copy` keys)
- Clicking a card expands it to show the full generated copy in the same format as Step 5 (CopyExportStep), with copy-to-clipboard buttons

### Step 2: Add history button to wizard header

In `AdCopyWizard.tsx`, add a `History` icon button (Clock icon) next to the reset button. Clicking it opens the `GenerationHistoryPanel` as either:
- A right-side slide-out panel (using Vaul or a custom drawer), or
- A full-page overlay that replaces the wizard content temporarily

The panel receives `organizationId` and fetches data independently.

### Step 3: Show generation counts on the Organization Selection Gate

In `OrganizationSelectionGate.tsx`, fetch generation counts per org using a single query:
```sql
SELECT organization_id, COUNT(*) as gen_count 
FROM ad_copy_generations 
GROUP BY organization_id
```

Display a small badge on each org row: "12 generations" or "No history yet"

### Step 4: Generation detail view (expand/modal)

When a user clicks a generation card, show a detailed view with:
- Full copy output grouped by segment (reusing the variation card UI from CopyExportStep)
- Individual copy buttons for each element (primary text, headline, description)
- "Copy All" button for the entire generation
- Video metadata (filename, duration if available)
- Campaign config summary (ActBlue form, refcode, recurring settings)
- Generation metadata (model, prompt version, timestamp)

---

## Technical Details

### Files to Create
| File | Purpose |
|------|---------|
| `src/components/ad-copy-studio/GenerationHistoryPanel.tsx` | Main history panel with list and detail views |

### Files to Modify
| File | Change |
|------|--------|
| `AdCopyWizard.tsx` | Add History button to header, state for panel open/close |
| `OrganizationSelectionGate.tsx` | Fetch and display generation counts per org |
| `AdminAdCopyStudio.tsx` | Pass org name to history panel if needed |

### Database Queries

**Fetch generations for an org (with video name):**
```sql
SELECT 
  g.id, g.generated_at, g.actblue_form_name, g.refcode, 
  g.audience_segments, g.generated_copy, g.meta_ready_copy,
  g.tracking_url, g.generation_model, g.generation_prompt_version,
  g.recurring_default, g.amount_preset,
  v.original_filename as video_name
FROM ad_copy_generations g
LEFT JOIN meta_ad_videos v ON g.video_ref = v.id
WHERE g.organization_id = $orgId
ORDER BY g.generated_at DESC
```

**Fetch generation counts for gate:**
```sql
SELECT organization_id, COUNT(*) as count
FROM ad_copy_generations
GROUP BY organization_id
```

### UI Design

**History card layout:**
```
+-----------------------------------------------+
| [Video icon] 25.1003.1 - MPAC - Ad 5.mp4      |
| Feb 7, 2026 at 6:20 PM                        |
|                                                |
| [Large Donors]  [Progressive Base]  segments   |
|                                                |
| ActBlue: mpac-meta  |  Refcode: campaign-0205  |
| Gemini 2.5 Pro  |  v4.0  |  5 variations      |
|                                        [View >]|
+-----------------------------------------------+
```

**Gate org row with count:**
```
[Logo] A New Policy          5 generations  [>]
[Logo] Save Democracy PAC    No history     [>]
```

### Reuse Strategy

The detail view will reuse the `VariationCard` rendering logic from `CopyExportStep.tsx` to display past copy in the exact same format users are familiar with, including per-element copy buttons and character count indicators.

