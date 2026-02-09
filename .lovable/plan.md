

# Deep Investigation: Multi-Video Upload Flow -- Stuck Second Video

## Root Cause Found

The second video gets stuck at "Transcribing" in the UI even though the backend has completed transcription successfully. The core bug is a **missing status update** in the polling/analysis flow.

### The Bug (Critical)

In `AdCopyWizard.tsx` (lines 394-431), the polling effect successfully:
1. Polls until `TRANSCRIBED` status
2. Fetches the transcript analysis
3. Updates `analyses` and `transcriptIds` state

But it **never calls `updateVideoStatus(videoId, 'ready')`** to update the video card's visual status. The video card reads its status from the `videos` array in `useVideoUpload`, which stays stuck at `transcribing` forever.

### Why Video 1 Works (Usually)

Video 1 often appears to work because:
- The `onStatusChange` callback fires during polling transitions (PENDING -> DOWNLOADED -> TRANSCRIBED)
- The backend sync effect (lines 312-377) may catch it on subsequent renders
- But `onStatusChange` only updates a **dead-end** `videoStatuses` state that no component reads

### Secondary Issues Found

**Issue 2: Sequential Processing Blocks UI**

The `uploadFiles` function in `useVideoUpload.ts` (line 209) uses a `for...of` loop that processes files **one at a time**:
- Extract audio for Video 1 (30-60s)
- Upload Video 1 audio
- Create DB record for Video 1
- **Await** transcription edge function for Video 1
- THEN start Video 2

This means Video 2's extraction doesn't even begin until Video 1's transcription API call returns. For 2 large files, this can take several minutes of unnecessary serial waiting.

**Issue 3: `videoStatuses` State is Never Consumed**

The `onStatusChange` callback (line 264-267) updates a `videoStatuses` state map, but this state is **never passed to any component or used anywhere**. It's dead code that gives a false sense that status updates are being propagated.

**Issue 4: Race Condition in Polling Effect Dependencies**

The polling effect depends on `[videos, stepData.videos, fetchAnalysis, pollForCompletion, updateStepData]`. When `videos` changes (e.g., Video 2 is added while Video 1 is still processing), the effect re-runs. But `processingVideosRef` prevents duplicate polling, so this is mostly safe -- except that the effect can fire before Video 2's `video_id` is set, causing it to be skipped initially.

---

## Fix Plan

### Fix 1: Update Video Status to `ready` After Analysis Fetch (Critical)

**File:** `src/components/ad-copy-studio/AdCopyWizard.tsx`

In the polling effect (around line 414), after successfully fetching the analysis, add a call to update the video's UI status:

```typescript
if (result) {
  const { analysis, transcriptId } = result;
  // UPDATE VIDEO STATUS TO READY
  updateVideoStatus(videoId, 'ready');
  
  setAnalyses(prev => { ... });
  setTranscriptIds(prev => { ... });
}
```

This ensures the video card transitions from "Transcribing" to "Ready" when the analysis is available.

### Fix 2: Parallelize File Processing

**File:** `src/hooks/useVideoUpload.ts`

Change the sequential `for` loop to process files in parallel using `Promise.allSettled`:

```text
Current (sequential):
  for (const video of newVideos) {
    await extractAudio(video1);
    await upload(video1);
    await triggerTranscription(video1);
    // NOW video2 starts...
  }

Proposed (parallel):
  await Promise.allSettled(
    newVideos.map(async (video) => {
      await extractAudio(video);
      await upload(video);
      await triggerTranscription(video);
    })
  );
```

This lets both videos extract audio and upload simultaneously, significantly reducing total wait time.

### Fix 3: Remove Dead `videoStatuses` State

**File:** `src/components/ad-copy-studio/AdCopyWizard.tsx`

Remove the unused `videoStatuses` state variable and the `onStatusChange` callback that populates it. Replace it with direct calls to `updateVideoStatus` during polling transitions so the video card status updates in real-time (e.g., showing "Downloaded" -> "Transcribing" -> "Ready" transitions).

### Fix 4: Ensure Polling Picks Up Late-Added Videos

**File:** `src/components/ad-copy-studio/AdCopyWizard.tsx`

The polling effect checks `v.video_id` but for the second video in a sequential upload, `video_id` might not be set yet when the effect first runs. Add a small check or ensure the effect re-triggers when `video_id` is assigned.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/ad-copy-studio/AdCopyWizard.tsx` | Add `updateVideoStatus(videoId, 'ready')` in polling effect after analysis fetch; remove dead `videoStatuses` state; wire `onStatusChange` to `updateVideoStatus` |
| `src/hooks/useVideoUpload.ts` | Parallelize file processing with `Promise.allSettled` instead of sequential `for` loop |

## Technical Notes

- No database or edge function changes needed
- The backend is working correctly (both videos reach TRANSCRIBED status)
- This is purely a frontend state management issue
- The parallel upload change also improves UX by showing both progress bars simultaneously
