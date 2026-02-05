

## Fix: Video Transcription Gets Stuck - Add Cancel/Retry and Proper Error Handling

### Problem Analysis

When transcription fails (status: `TRANSCRIPT_FAILED`), the system gets stuck in an infinite polling loop because:

1. The backend status changes to `TRANSCRIPT_FAILED`
2. The frontend detects this via polling and calls `onError`
3. `processingVideosRef.current.delete(videoId)` removes the video from tracking
4. But the local video status in React state remains `transcribing`
5. The `useEffect` triggers again, sees status is still `transcribing` and video is not in ref, starts polling again
6. Repeat forever

### Solution Overview

Based on your preferences:
- **Cancel**: Mark video as `CANCELLED` in DB and stop polling
- **Retry**: Manual only - show button when stuck/failed
- **Stuck threshold**: Show cancel/retry UI after 1 minute

### Implementation Plan

#### 1. Track Failed/Cancelled Videos (Prevent Polling Loop)

Add a new ref to track videos that have failed or been cancelled, preventing re-polling:

```typescript
// In AdCopyWizard.tsx
const failedVideosRef = useRef<Set<string>>(new Set());
```

Update the polling effect to check this ref:
```typescript
if (failedVideosRef.current.has(v.video_id)) return false; // Failed/cancelled
```

When `onError` fires, add the video to this set.

#### 2. Update Local Video Status When Backend Status Changes

When polling detects `TRANSCRIPT_FAILED`, update the local video status to `error`:

```typescript
onError: (videoId, error) => {
  console.error(`[AdCopyWizard] Transcription error for video ${videoId}:`, error);
  // Add to failed set to prevent re-polling
  failedVideosRef.current.add(videoId);
  // Update local video status to error
  setVideos(prev => prev.map(v => 
    v.video_id === videoId 
      ? { ...v, status: 'error', error_message: error }
      : v
  ));
}
```

This requires exposing a `setVideos` or `updateVideoStatus` callback from `useVideoUpload`.

#### 3. Add Cancel Functionality

Add `cancelVideo` function to `useVideoUpload`:

```typescript
const cancelVideo = useCallback(async (id: string) => {
  const video = videos.find(v => v.id === id);
  if (!video?.video_id) {
    // Just remove from local state
    removeVideo(id);
    return;
  }

  // Update database status to CANCELLED
  await supabase
    .from('meta_ad_videos')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', video.video_id);

  // Update local state
  setVideos(prev => prev.map(v => 
    v.id === id ? { ...v, status: 'error', error_message: 'Cancelled by user' } : v
  ));
}, [videos]);
```

Also call `cancelPolling(videoId)` from the transcription flow hook.

#### 4. Add Retry Functionality

Add `retryTranscription` function:

```typescript
const retryTranscription = useCallback(async (id: string) => {
  const video = videos.find(v => v.id === id);
  if (!video?.video_id) return;

  // Remove from failed set
  failedVideosRef.current.delete(video.video_id);
  
  // Update local status
  updateVideo(id, { status: 'transcribing', error_message: undefined });
  
  // Update database status to PENDING
  await supabase
    .from('meta_ad_videos')
    .update({ status: 'PENDING', error_message: null, retry_count: 0 })
    .eq('id', video.video_id);

  // Re-trigger transcription
  await supabase.functions.invoke('transcribe-meta-ad-video', {
    body: { organization_id: organizationId, video_id: video.video_id, mode: 'single' }
  });
}, [videos, organizationId]);
```

#### 5. Add "Stuck" Detection UI (1-minute threshold)

Track upload start time and show special UI after 1 minute:

```typescript
// In VideoUploadStep, calculate if stuck
const isStuck = video.status === 'transcribing' && 
  video.extractionStartTime && 
  (Date.now() - video.extractionStartTime) > 60_000;
```

Show cancel/retry buttons when stuck or in error state.

#### 6. Update VideoUploadStep UI

Add Cancel and Retry buttons to the video card:

```text
+------------------------------------------+
| video.mp4                                |
| [Transcribing... 2:15]                   |
| Progress: [=====----] 45%                |
| [!] Taking longer than expected          |
|                    [Cancel] [Retry]      |
+------------------------------------------+
```

For error state:
```text
+------------------------------------------+
| video.mp4                        [ERROR] |
| Transcription failed: WHISPER_FAILED     |
|                    [Remove] [Retry]      |
+------------------------------------------+
```

### Database Changes

Add `CANCELLED` to the list of terminal statuses in `useVideoTranscriptionFlow.ts`:

```typescript
const TERMINAL_STATUSES = ['TRANSCRIBED', 'ANALYZED', 'ERROR', 'FAILED', 'TRANSCRIPT_FAILED', 'CANCELLED'];
```

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useVideoUpload.ts` | Add `updateVideoStatus`, `cancelVideo` exports |
| `src/hooks/useVideoTranscriptionFlow.ts` | Add `CANCELLED` to terminal statuses |
| `src/components/ad-copy-studio/AdCopyWizard.tsx` | Track failed videos, update status on error, wire up cancel/retry |
| `src/components/ad-copy-studio/steps/VideoUploadStep.tsx` | Add Cancel/Retry buttons, stuck detection UI |
| `src/types/ad-copy-studio.ts` | Update `VideoUpload.status` type (no change needed - 'error' already exists) |

### Expected Behavior After Fix

1. **Upload starts** - Video shows "Transcribing..." with spinner
2. **After 1 minute** - Shows "Taking longer than expected" with Cancel button
3. **If user clicks Cancel**:
   - Polling stops immediately
   - Database status set to `CANCELLED`
   - Video shows as cancelled with Remove button
4. **If transcription fails**:
   - Status updates to `error` with error message
   - Retry button appears
   - No infinite polling loop
5. **If user clicks Retry**:
   - Status changes back to `transcribing`
   - Edge function re-invoked
   - Polling restarts

### Technical Details

**Preventing the Polling Loop:**
```typescript
// Before (broken)
processingVideosRef.current.delete(videoId);
// Effect re-runs, video still has status='transcribing', starts polling again

// After (fixed)
failedVideosRef.current.add(videoId);
processingVideosRef.current.delete(videoId);
// Effect re-runs, checks failedVideosRef first, skips polling
```

**Cancel Flow:**
```text
User clicks Cancel
    -> cancelVideo(id) called
    -> cancelPolling(video_id) stops the polling loop
    -> DB update: status = 'CANCELLED'
    -> Local update: status = 'error', error_message = 'Cancelled by user'
    -> UI shows error state with Remove button
```

