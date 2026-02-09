

# Fix: Detect and Handle Whisper Hallucinations

## Problem

Whisper-1 is generating completely fabricated transcripts when a video has poor audio quality, background music, or minimal speech. The telltale sign is Whisper detecting the language as "latin" and producing nonsensical text about unrelated topics (e.g., "Buddha Shakyamuni..."). This is a well-documented Whisper hallucination problem.

## Evidence from the Database

- Video 2 ("AD 1 - 1x1 (1).mp4"): language = "latin", transcript is total gibberish
- All other 4 videos: language = "english", transcripts are accurate and relevant

## Solution: Multi-Layer Hallucination Detection

### Layer 1: Use Whisper's Built-in `no_speech_prob` (Backend)

Whisper returns a `no_speech_prob` value per segment. When this is high (>0.5), the segment is likely hallucinated. Currently the edge function ignores this field.

**Files:** `supabase/functions/transcribe-meta-ad-video/index.ts` and `supabase/functions/upload-video-for-transcription/index.ts`

- Parse `no_speech_prob` from each Whisper segment
- Calculate average `no_speech_prob` across all segments
- If average > 0.5, or if detected language is unexpected (not in a reasonable set like english, spanish, arabic, etc.), flag the transcript as `LOW_CONFIDENCE`
- Store a `hallucination_risk` score (0-1) in the transcript record

### Layer 2: Language Sanity Check (Backend)

If Whisper detects "latin", "welsh", "maori", or other highly unlikely languages for political ad content, automatically flag the transcript.

- Add a set of "expected languages" (configurable, defaulting to common languages)
- If detected language is not in the expected set, mark `transcription_confidence` as low (e.g., 0.2 instead of hardcoded 0.95)

### Layer 3: Retry with Enhanced Whisper Settings (Backend)

When a hallucination is detected, automatically retry with better Whisper parameters:

- Add `language: "en"` to force English detection (prevents Whisper from drifting into hallucination)
- Add `prompt` parameter with context hint like "This is a political advertisement about advocacy and policy" to ground Whisper

### Layer 4: UI Warning (Frontend)

When a transcript has low confidence or hallucination risk, show a warning banner in the transcript review step.

**File:** Transcript display component in Ad Copy Studio

- Show an amber warning: "This transcript may be inaccurate. The audio may contain mostly music or background noise. You can edit the transcript manually or re-upload the video."
- Make the "Edit transcript" button more prominent for flagged transcripts

## Database Changes

Add two columns to `meta_ad_transcripts`:
- `hallucination_risk` (float, nullable) - 0 to 1 score
- `auto_retry_count` (int, default 0) - tracks retry attempts

## Implementation Order

1. Add database columns
2. Update `transcribe-meta-ad-video` edge function with hallucination detection + auto-retry
3. Update `upload-video-for-transcription` edge function with same logic
4. Add UI warning for low-confidence transcripts
5. Deploy edge functions

## Technical Details

### Whisper API Enhancement

```text
Current call:
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')

Enhanced call (on retry):
  + formData.append('language', 'en')
  + formData.append('prompt', 'Political advocacy advertisement about policy and community organizing.')
```

### Hallucination Detection Logic

```text
function detectHallucination(result):
  avgNoSpeechProb = average of segments[].no_speech_prob
  unexpectedLanguage = language NOT IN ['english','spanish','arabic','french','urdu','hindi','chinese','korean','japanese','german','portuguese','italian','russian','turkish','persian','tagalog','vietnamese','polish','ukrainian','dutch','indonesian','malay','thai','bengali','swahili','hausa','amharic','somali','hebrew']
  
  hallucinationRisk = 0
  if avgNoSpeechProb > 0.6: hallucinationRisk = 0.9
  else if avgNoSpeechProb > 0.4: hallucinationRisk = 0.6
  if unexpectedLanguage: hallucinationRisk = max(hallucinationRisk, 0.8)
  
  return { hallucinationRisk, shouldRetry: hallucinationRisk > 0.5 }
```

### Files to Modify

| File | Change |
|------|--------|
| Database migration | Add `hallucination_risk` and `auto_retry_count` columns |
| `supabase/functions/transcribe-meta-ad-video/index.ts` | Add hallucination detection, auto-retry with language hint |
| `supabase/functions/upload-video-for-transcription/index.ts` | Same hallucination detection logic |
| Transcript review UI component | Add low-confidence warning banner |

