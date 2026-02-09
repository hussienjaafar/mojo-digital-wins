

# Per-Video Refcodes and Ad Identifiers

## What Changes

### 1. Per-Video Refcodes in Campaign Config (Step 3)

Currently there's a single refcode for the entire campaign. This will change so each video gets its own refcode, auto-generated from the video name/number.

**Type changes** (`src/types/ad-copy-studio.ts`):
- Add `refcodes: Record<string, string>` to `CampaignConfig` (keyed by video_id)
- Keep the existing `refcode` field for backward compatibility but deprecate it

**CampaignConfigStep changes** (`src/components/ad-copy-studio/steps/CampaignConfigStep.tsx`):
- Replace the single refcode input with a list showing each video and its own refcode field
- Each video displays its name/number (e.g., "Video 1 - filename.mp4") with an editable refcode
- Auto-generate refcodes per video on mount (e.g., `ad1-0209-x4f2`, `ad2-0209-k8m1`)
- Each has its own "Regenerate" button

### 2. Video Identifier in Export Step (Step 5)

**CopyExportStep changes** (`src/components/ad-copy-studio/steps/CopyExportStep.tsx`):
- Add a video selector/indicator at the top showing which video's ad copy is being displayed
- Display the video name and its associated refcode prominently (e.g., "Ad 1: campaign_video1.mp4 | Refcode: ad1-0209-x4f2")
- Include the refcode in the variation card headers and clipboard copy output
- The tracking URL section shows the specific refcode for the currently viewed ad

### 3. Generation Updates

**AdCopyWizard changes** (`src/components/ad-copy-studio/AdCopyWizard.tsx`):
- Pass the per-video refcode (from `campaignConfig.refcodes[videoId]`) when calling `generateCopy`
- Pass video info to CopyExportStep so it can display the video identifier

**useAdCopyGeneration changes** (`src/hooks/useAdCopyGeneration.ts`):
- No structural changes needed -- it already accepts `refcode` as a parameter

## Technical Details

### Updated CampaignConfig Type

```typescript
export interface CampaignConfig {
  actblue_form_name: string;
  refcode: string;              // kept for backward compat, used as fallback
  refcode_auto_generated: boolean;
  refcodes: Record<string, string>;  // NEW: videoId -> refcode
  amount_preset?: number;
  recurring_default: boolean;
  audience_segments: AudienceSegment[];
}
```

### CopyExportStep Props Update

```typescript
export interface CopyExportStepProps {
  // ...existing props...
  videos?: Array<{ id: string; filename: string; video_id?: string }>;
  activeVideoRefcode?: string;
}
```

### Files to Modify

| File | Change |
|------|--------|
| `src/types/ad-copy-studio.ts` | Add `refcodes` field to `CampaignConfig` |
| `src/components/ad-copy-studio/steps/CampaignConfigStep.tsx` | Replace single refcode with per-video refcode list; needs videos prop |
| `src/components/ad-copy-studio/steps/CopyExportStep.tsx` | Add video identifier header with name + refcode; include refcode in copy output |
| `src/components/ad-copy-studio/AdCopyWizard.tsx` | Pass videos to CampaignConfigStep and CopyExportStep; use per-video refcode in generation |

### Auto-Generated Refcode Format

Each video gets a refcode like: `ad{N}-{MMDD}-{random4}` where N is the video number (1-based), MMDD is today's date, and random4 is a short random string.

### Export Step Video Identifier

At the top of the export step, a styled banner will show:
- Video name/number (e.g., "Ad 1: my_campaign_video.mp4")
- The refcode for that video
- If multiple videos exist, tabs or a selector to switch between them

