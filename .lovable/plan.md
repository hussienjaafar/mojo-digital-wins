

# Fix Video 2 Persistent Hallucination - Deep Investigation Results

## Root Cause (Three Cascading Failures)

### Failure 1: Original Video Never Available for Retry

When you upload a large video (Video 2 is 289MB), the client extracts audio to a small `.m4a` file and uploads **only the audio** to the `meta-ad-audio` bucket. The original video file is never stored in Supabase Storage. The `video_source_url` in the database points to this extracted `.m4a` file.

When the retry logic tries to find the original video, it looks at the wrong path (`videos/{org_id}/{video_id}.mp4`) in the `meta-ad-videos` bucket -- but the original video was never uploaded there. The lookup fails silently, and it retries with the same bad audio.

### Failure 2: Detection Thresholds Too Lenient

The `no_speech_prob` values for Video 2's segments average ~0.35 (range 0.17-0.44). The current threshold requires >0.4 to flag as "elevated" risk. This means Whisper is ~35% confident there's no speech, but the system treats this as acceptable.

### Failure 3: No Semantic Validation

The transcript text is coherent-sounding English gibberish ("I'm a lesbian. I'm morally distracted from the moment my life began...") -- it's grammatically plausible but completely unrelated to the video content. Neither repetition detection nor language checks can catch semantically wrong but linguistically valid text.

## Solution: Three-Pronged Fix

### 1. Upload Original Video Alongside Audio

**File:** `src/hooks/useVideoUpload.ts`

After extracting audio, also upload the original video file to the `meta-ad-videos` bucket at a predictable path. This ensures the retry logic can actually find and use the original video.

- Upload audio to `meta-ad-audio` bucket (as now, for initial transcription)
- Also upload original video to `meta-ad-videos` bucket at path `{org_id}/{batchId}/{videoId}_{filename}`
- Store the original video storage path in the database

### 2. Lower the no_speech_prob Threshold

**File:** `supabase/functions/_shared/hallucination-detection.ts`

Lower the threshold from 0.4 to 0.3 for the "elevated" tier. Video 2's average of 0.35 would then be caught:

```text
Current:
  > 0.6 -> risk 0.9
  > 0.4 -> risk 0.6

New:
  > 0.5 -> risk 0.9
  > 0.3 -> risk 0.6
```

### 3. Add LLM-Based Semantic Coherence Check

**File:** `supabase/functions/_shared/hallucination-detection.ts` and edge functions

After transcription, use Lovable AI (which requires no extra API key) to do a quick coherence check: "Does this transcript sound like a real political advocacy advertisement?" This catches the case where Whisper produces grammatically valid but semantically nonsensical text.

- Only run this check when `no_speech_prob` is borderline (0.2-0.5 range)
- Use a fast, cheap model (gemini-2.5-flash-lite) with a simple yes/no prompt
- If the LLM says "no", flag hallucination risk at 0.85

### 4. Fix the Retry Video Path Lookup

**File:** `supabase/functions/transcribe-meta-ad-video/index.ts`

Fix the retry code to look up the original video at the correct storage path. Query the `meta_ad_videos` table for the actual storage path information instead of guessing.

For existing videos that were already uploaded (like Video 2), the original video isn't in storage. In this case, the system should clearly tell the user that a re-upload is needed.

## Technical Details

### Storage Path Fix for Retry

The current retry code guesses: `videos/{org_id}/{video_id}.mp4`

The actual upload path is: `{org_id}/{batch_id}/{video_id}_{sanitized_filename}`

Fix: Query the `meta_ad_videos` table for `original_filename` and reconstruct the path, or better yet, store the video storage path in a new column.

### Semantic Check Prompt

```text
You are evaluating if a transcript is real or hallucinated by an AI speech model.
A real transcript from a political ad would discuss policy, candidates, donations, or community issues.
A hallucinated transcript contains random, incoherent, or unrelated content.

Transcript: "{text}"

Is this a real political ad transcript? Reply with only "real" or "hallucinated".
```

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/_shared/hallucination-detection.ts` | Lower `no_speech_prob` thresholds (0.4 to 0.3); add `semanticCoherenceCheck()` function |
| `supabase/functions/transcribe-meta-ad-video/index.ts` | Fix retry video path lookup; integrate semantic check; log more detail on retry failures |
| `supabase/functions/upload-video-for-transcription/index.ts` | Integrate semantic check |
| `src/hooks/useVideoUpload.ts` | Upload original video alongside extracted audio for future retries |

### Database Changes

Add column to `meta_ad_videos`:
- `video_storage_path` (text, nullable) -- stores the path to the original video in storage for retry purposes

## What This Fixes

- **Immediate**: Lowered `no_speech_prob` threshold catches Video 2 (avg 0.35 > new 0.3 threshold)
- **Semantic check**: Even if `no_speech_prob` is low, the LLM coherence check catches gibberish text like "I'm morally distracted from the moment my life began"
- **Future retries**: Original video is uploaded to storage, so retry can use a different audio extraction approach
- **Existing videos**: For videos already uploaded without the original file, the UI will prompt the user to re-upload

