# Ad Copy Studio - Transcription Pipeline Implementation

## Status: ✅ COMPLETED

The transcription pipeline has been connected to the video upload flow.

## Changes Made

### 1. New Hook: `useVideoTranscriptionFlow.ts`
- `triggerTranscription(videoId)`: Calls the edge function
- `pollForCompletion(videoId)`: Polls `meta_ad_videos.status` until terminal state
- `fetchAnalysis(videoId)`: Fetches analysis from `meta_ad_transcripts` by `video_ref`
- `processVideo(videoId)`: Complete workflow (trigger → poll → fetch)

### 2. Modified: `useVideoUpload.ts`
- After DB insert, automatically triggers `transcribe-meta-ad-video` edge function
- Passes `video_id` column value (not primary key) to edge function
- Sets video status to `transcribing` instead of `ready`

### 3. Modified: `AdCopyWizard.tsx`
- Integrates `useVideoTranscriptionFlow` hook
- Polls for transcription completion when videos are in `transcribing` state
- Fetches and stores analyses + transcript IDs when transcription completes
- Maps analyses by video local ID for `TranscriptReviewStep`
- Uses tracked `transcriptIds` for copy generation

### 4. Existing: `VideoUploadStep.tsx`
- Already had status display for `transcribing` and `analyzing` states

## Flow After Implementation

```
Upload Video -> Storage -> DB Record (PENDING)
                               |
                               v
                    status = 'transcribing'
                               |
                               v
                    Edge function called
                               |
                               v
                    Poll meta_ad_videos.status
                               |
                               v
                    Fetch from meta_ad_transcripts
                               |
                               v
Step 2: analyses populated -> Display analysis
```


