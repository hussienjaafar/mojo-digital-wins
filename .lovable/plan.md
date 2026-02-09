

# Fix Video Deletion Cleanup and Stuck Transcription

## Problem 1: Old Video 2 Data Persists After Deletion

When a user removes a video from the upload step, `removeVideo()` only removes it from local React state. It does not:
- Delete the `meta_ad_videos` database record
- Delete the associated `meta_ad_transcripts` record
- Clean up the analysis from `stepData.analyses`
- Remove related storage files

This means the old hallucinated transcript and analysis for Video 2 (DB ID `86d560c8`) still exist in the database and in the persisted session data.

## Problem 2: Re-uploaded Video (Video 6) Stuck at PENDING

The re-uploaded video (`27f89e0f`) was inserted and the edge function was invoked, but the OLD code (before the ID fix deployment) was still running. It passed the `video_id` column value (`upload_xxx`) instead of the UUID primary key, causing a postgres UUID parse error. The function returned 404 and exited.

After the code fix was deployed, the function was never re-invoked. The poller sees `PENDING` in the DB forever, but `PENDING` is not a terminal status, so it just keeps polling without ever re-triggering the transcription.

## Solution

### 1. Make `removeVideo` a full cleanup operation

**File:** `src/hooks/useVideoUpload.ts`

Update `removeVideo` to:
- Delete the `meta_ad_videos` record from the database (if it has a `video_id`)
- Delete the associated `meta_ad_transcripts` record
- Delete associated audio/video files from storage buckets
- Remove from local state (as it does now)

### 2. Clean up analyses in AdCopyWizard when video is removed

**File:** `src/components/ad-copy-studio/AdCopyWizard.tsx`

Wrap the `removeVideo` call to also:
- Remove the video's analysis from the `analyses` state (keyed by `video_id`)
- Remove the video's transcript ID from `transcriptIds` state
- Persist the cleaned-up state to `stepData`

### 3. Add a stuck-detection mechanism to the poller

**File:** `src/hooks/useVideoTranscriptionFlow.ts` or `src/components/ad-copy-studio/AdCopyWizard.tsx`

When polling detects a video has been in `PENDING` status for more than 30 seconds, re-trigger the edge function automatically. This handles cases where the initial invocation failed (as happened here).

### 4. Manually fix the current stuck video

The existing Video 6 record (`27f89e0f`) needs its transcription re-triggered. The poller stuck-detection fix (item 3) will handle this automatically on the next page load, or the user can click the retry button.

## Technical Details

### Updated removeVideo (useVideoUpload.ts)

```text
removeVideo(id):
  find video by local id
  if video has video_id (DB record):
    delete from meta_ad_transcripts where video_ref = video.video_id
    delete from meta_ad_videos where id = video.video_id
    delete audio file from meta-ad-audio bucket
    delete video file from meta-ad-videos bucket (if exists)
  remove from local state
```

### Wrapped removal in AdCopyWizard

```text
handleRemoveVideo(id):
  find the video's video_id (DB ID)
  call removeVideo(id)  // does DB + local cleanup
  remove analyses[video_id]
  remove transcriptIds[video_id]
  update stepData with cleaned analyses, transcriptIds, and filtered videos list
```

### Stuck detection in polling loop

```text
pollForCompletion(videoId):
  ...existing polling loop...
  if status === 'PENDING' and elapsed > 30s:
    log warning
    re-invoke transcribe-meta-ad-video edge function
    reset elapsed timer
    continue polling
```

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useVideoUpload.ts` | Make `removeVideo` delete DB records, transcripts, and storage files |
| `src/components/ad-copy-studio/AdCopyWizard.tsx` | Wrap `removeVideo` to also clean up `analyses` and `transcriptIds` state + stepData |
| `src/hooks/useVideoTranscriptionFlow.ts` | Add stuck-detection: re-trigger edge function if PENDING > 30 seconds |

### Database Impact

No schema changes needed. This only deletes data rows for the specific removed video.

