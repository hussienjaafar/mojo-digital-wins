
# Fix: Deleted Video Still Showing on Refcode Page

## Problem

When a video is deleted in Step 1 or Step 2, the `handleRemoveVideo` function cleans up `analyses`, `transcriptIds`, and `stepData.videos`, but it does NOT remove the deleted video's entry from `config.refcodes`. This stale refcode entry persists in the session data.

## Root Cause

In `src/components/ad-copy-studio/AdCopyWizard.tsx`, the `handleRemoveVideo` callback (lines 492-524) is missing cleanup for the campaign config's `refcodes` map.

## Fix

Add refcode cleanup to `handleRemoveVideo` in `AdCopyWizard.tsx`:

- When a video with a `video_id` (DB ID) is removed, also delete its entry from `campaignConfig.refcodes`
- Update the persisted `stepData.config` accordingly

### File to Modify

| File | Change |
|------|--------|
| `src/components/ad-copy-studio/AdCopyWizard.tsx` | Add refcode cleanup inside `handleRemoveVideo` when `dbId` is available |

### Code Change (inside `handleRemoveVideo`, after the `setTranscriptIds` block)

```typescript
// Clean up refcode for the deleted video
setCampaignConfig(prev => {
  const updatedRefcodes = { ...prev.refcodes };
  delete updatedRefcodes[dbId];
  const updated = { ...prev, refcodes: updatedRefcodes };
  updateStepData({ config: updated });
  return updated;
});
```

This is a single addition (~6 lines) to one file.
