

## Fix: Connect Video Upload to Transcription Pipeline

### Problem Identified

When a video is uploaded in Ad Copy Studio:
1. The video is uploaded to storage successfully
2. A record is created in `meta_ad_videos` with status `PENDING`
3. **The transcription edge function is never called**
4. Step 2 shows "No analysis available" because the `analyses` object is empty

### Current Flow (Broken)

```text
Upload Video -> Storage -> DB Record (PENDING) -> [STOP]
                                                     |
Step 2: analyses = {} -> "No analysis available"
```

### Required Flow

```text
Upload Video -> Storage -> DB Record (PENDING)
                               |
                               v
                    Call transcribe-meta-ad-video
                               |
                               v
                    Poll/wait for completion
                               |
                               v
                    Fetch transcript from meta_ad_transcripts
                               |
                               v
Step 2: analyses = { video_id: TranscriptAnalysis } -> Display analysis
```

### Solution Overview

Add automatic transcription triggering after video upload completes, then fetch the analysis data for step 2.

### Implementation Plan

#### 1. Create a new hook: `useVideoTranscriptionFlow.ts`

This hook will manage the transcription workflow for Ad Copy Studio:

- **triggerTranscription(videoId)**: Calls the `transcribe-meta-ad-video` edge function
- **pollTranscriptionStatus(videoId)**: Polls `meta_ad_videos` status until complete
- **fetchTranscriptAnalysis(videoId)**: Fetches analysis data from `meta_ad_transcripts`

```typescript
// Key functions
async function triggerTranscription(organizationId: string, videoId: string)
async function waitForTranscription(videoId: string, maxWaitMs: number)
async function fetchAnalysis(organizationId: string, videoId: string): TranscriptAnalysis
```

#### 2. Modify `useVideoUpload.ts`

After successful database insert, automatically trigger transcription:

```typescript
// After line ~395 where status becomes 'ready'
// Call edge function to start transcription
await supabase.functions.invoke('transcribe-meta-ad-video', {
  body: {
    organization_id: organizationId,
    video_id: videoId,
    mode: 'single',
  },
});
```

Update video status tracking to include transcription states:
- `ready` -> `transcribing` -> `analyzing` -> `complete`

#### 3. Modify `AdCopyWizard.tsx`

Add logic to:
1. Track transcription progress for uploaded videos
2. Poll for transcription completion when videos are in pending states
3. Fetch analysis data from `meta_ad_transcripts` when complete
4. Populate the `analyses` state for step 2

```typescript
// Add effect to fetch analyses when videos are ready
useEffect(() => {
  const fetchAnalyses = async () => {
    const readyVideos = currentVideos.filter(v => v.video_id);
    for (const video of readyVideos) {
      const analysis = await fetchTranscriptAnalysis(organizationId, video.video_id);
      if (analysis) {
        setAnalyses(prev => ({ ...prev, [video.id]: analysis }));
      }
    }
  };
  fetchAnalyses();
}, [currentVideos]);
```

#### 4. Update Video Status Display

In `VideoUploadStep.tsx`, update status progression:
- `pending` -> Waiting to upload
- `uploading` -> Uploading file
- `extracting` -> Extracting audio (for large files)
- `transcribing` -> Audio sent to Whisper API
- `analyzing` -> GPT-4 analyzing transcript
- `ready` -> Complete with analysis

#### 5. Handle Edge Cases

- **Transcription timeout**: Show error and allow retry
- **API failures**: Surface error message and allow manual retry
- **Large files**: Handle the longer processing time gracefully
- **Multiple videos**: Process transcriptions in parallel with individual progress

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useVideoTranscriptionFlow.ts` | **New file** - Transcription workflow management |
| `src/hooks/useVideoUpload.ts` | Trigger transcription after upload, track transcription status |
| `src/components/ad-copy-studio/AdCopyWizard.tsx` | Fetch and populate analyses state |
| `src/components/ad-copy-studio/steps/VideoUploadStep.tsx` | Update status display for transcription states |

### Technical Details

**Edge Function Call Pattern:**
```typescript
const { data, error } = await supabase.functions.invoke('transcribe-meta-ad-video', {
  body: {
    organization_id: organizationId,
    video_id: videoId,
    mode: 'single',
  },
});
```

**Polling Pattern:**
```typescript
// Poll meta_ad_videos.status until 'TRANSCRIBED'
const pollInterval = 3000; // 3 seconds
const maxAttempts = 60; // 3 minutes max
```

**Fetch Analysis Pattern:**
```typescript
const { data } = await supabase
  .from('meta_ad_transcripts')
  .select('*')
  .eq('video_id', videoId)
  .single();

// Map to TranscriptAnalysis type
const analysis: TranscriptAnalysis = {
  transcript_text: data.transcript_text,
  issue_primary: data.issue_primary,
  issue_tags: data.issue_tags || [],
  // ... rest of mapping
};
```

### Expected Result

After implementation:
1. User uploads video
2. Progress shows: Uploading -> Extracting -> Transcribing -> Analyzing -> Ready
3. User proceeds to Step 2
4. Transcript and analysis cards display correctly
5. User can review and proceed to Step 3

