

# Add "Retranscribe" Button to Transcript Review Step

## Overview

Add a button on the transcript review step that lets you retranscribe a single video without affecting other videos. This is especially useful when a transcript came back as gibberish (hallucination) and you want to try again.

## What You'll See

- A "Retranscribe" button in the hallucination warning banner (for flagged transcripts) and in the transcript panel header (for all transcripts)
- Clicking it will re-run the transcription for just that one video
- The video's transcript area will show a loading state while processing
- Other videos' transcripts remain completely untouched
- Once complete, the new transcript and analysis replace the old one

## Technical Details

### 1. Pass retranscribe capability to TranscriptReviewStep

**File:** `src/components/ad-copy-studio/AdCopyWizard.tsx`

- Add a new `onRetranscribe` prop that accepts a video ID, resets that video's DB status back to PENDING, re-triggers the `transcribe-meta-ad-video` edge function, polls for completion, and updates the analysis state
- Wire this up using the existing `retryTranscription` (from `useVideoUpload`) combined with re-polling and re-fetching analysis (from `useVideoTranscriptionFlow`)

### 2. Add retranscribe handler and UI to TranscriptReviewStep

**File:** `src/components/ad-copy-studio/steps/TranscriptReviewStep.tsx`

- Accept `onRetranscribe?: (videoId: string) => Promise<void>` prop
- Add a "Retranscribe" button with a `RefreshCw` icon in the transcript panel header (next to "Edit transcript")
- For videos with high hallucination risk, add a prominent "Retry Transcription" button inside the warning banner
- While retranscribing, show a spinner and disable the button; hide the transcript text and show a "Retranscribing..." placeholder
- Track `retranscribingVideoId` state to know which video is currently being retranscribed

### 3. Handle state updates after retranscription

**File:** `src/components/ad-copy-studio/AdCopyWizard.tsx`

- After retranscription completes, clear the old analysis and fetch the new one
- Update `analyses`, `transcriptIds`, and `stepData` for just the affected video
- Other videos' state remains completely unchanged

### Files to Modify

| File | Change |
|------|--------|
| `src/components/ad-copy-studio/AdCopyWizard.tsx` | Create `handleRetranscribeVideo` callback; pass as `onRetranscribe` prop to TranscriptReviewStep |
| `src/components/ad-copy-studio/steps/TranscriptReviewStep.tsx` | Add `onRetranscribe` prop, retranscribe button in header + warning banner, loading state |

