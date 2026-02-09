
# Fix: Generate Unique Ad Copy Per Video

## Problem

The generation step calls the edge function only once using the first video's transcript. All videos therefore show identical ad copy in the export step, even though each video has its own unique transcript and analysis.

## Solution

Loop over all videos during generation, calling the edge function once per video with that video's specific transcript and refcode. Store results keyed by video ID so each video tab in the export step shows its own unique copy.

## Changes Required

### 1. Types (`src/types/ad-copy-studio.ts`)

- Add a new type alias for per-video results:
  ```
  PerVideoGeneratedCopy = Record<videoId, GeneratedCopy>
  PerVideoMetaReadyCopy = Record<videoId, MetaReadyCopy>
  ```
- Update `SessionStepData.generated_copy` to support the per-video structure

### 2. Generation Hook (`src/hooks/useAdCopyGeneration.ts`)

- Change `generateCopy` to accept an array of videos (each with transcript ID, video ID, and refcode) instead of a single transcript ID
- Loop over each video, calling the edge function per video
- Accumulate results into a `Record<videoId, GeneratedCopy>` and `Record<videoId, MetaReadyCopy>` map
- Track progress across all videos (e.g., 20% per video if 5 videos)
- Support partial success: if one video fails, others still succeed (with warnings)

### 3. Wizard (`src/components/ad-copy-studio/AdCopyWizard.tsx`)

- Update `handleGenerate` to build the per-video params array from all videos that have transcripts
- Pass each video's specific refcode from `campaignConfig.refcodes[videoId]`
- Pass the per-video results down to `CopyExportStep`

### 4. Export Step (`src/components/ad-copy-studio/steps/CopyExportStep.tsx`)

- Accept per-video copy maps instead of flat maps
- When a video tab is selected, look up that video's copy from the per-video map
- The segment tabs and variation cards remain unchanged -- they just read from the active video's slice of data
- Update "Copy All" and CSV export to include all videos or just the active one

### 5. Edge function -- No changes needed

The edge function already accepts a single `transcript_id` and `refcode` and returns copy for that transcript. We just call it multiple times from the frontend.

## Flow Diagram

```text
Before:
  handleGenerate -> generateCopy(video1.transcriptId) -> edge function -> same copy for all tabs

After:
  handleGenerate -> for each video:
    generateCopy(video.transcriptId, video.refcode) -> edge function -> video-specific copy
  -> store as { videoId1: { segmentCopy... }, videoId2: { segmentCopy... } }
  -> CopyExportStep reads activeVideo's copy
```

## Files to Modify

| File | Change |
|------|--------|
| `src/types/ad-copy-studio.ts` | Add per-video type aliases, update SessionStepData |
| `src/hooks/useAdCopyGeneration.ts` | Accept multi-video params, loop and accumulate results per video |
| `src/components/ad-copy-studio/AdCopyWizard.tsx` | Build per-video params array in handleGenerate |
| `src/components/ad-copy-studio/steps/CopyExportStep.tsx` | Read copy from per-video map based on active video tab |

## Edge Cases

- If a video's generation fails, the others still complete; a warning toast is shown
- Single-video sessions work identically (map has one entry)
- Session recovery: persisted `step_data.generated_copy` uses the new per-video structure
- History panel: existing generation history records use the old flat format and will continue to work as-is (they were single-video generations)
