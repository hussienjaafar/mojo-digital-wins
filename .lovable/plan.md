
# Fix Persistent Whisper Hallucination on Video 2

## Problem

The hallucination detection catches language-based hallucinations (e.g., "latin") but misses a very common Whisper failure mode: **repetitive looping text**. When Whisper retries with `language: 'en'`, it produces English-sounding gibberish ("I'm Eachy who work in executive work...") that repeats itself -- this passes the current checks because:
- Language = "english" (expected)
- `no_speech_prob` is low (Whisper thinks it heard speech)

The transcript clearly loops: the same paragraph appears twice, which is a telltale sign of Whisper hallucination.

## Solution: Add Repetition Detection Layer

### 1. Add repetition detection to hallucination-detection.ts

**File:** `supabase/functions/_shared/hallucination-detection.ts`

Add a `detectRepetition` function that:
- Splits transcript into sentences
- Checks if any substantial sentence (>5 words) appears more than once
- Calculates a "repetition ratio" (repeated content / total content)
- If ratio > 0.3 (30%+ of text is repeated), flag as hallucination risk 0.85

Integrate this into the existing `detectHallucination` function so both edge functions benefit automatically.

### 2. Update both edge functions to send original video on retry

Currently, retries use the same extracted audio file. If the audio extraction was poor quality (e.g., mostly music track, speech on a different channel), retrying with the same bad audio won't help.

**File:** `supabase/functions/upload-video-for-transcription/index.ts`

When hallucination is detected (including repetition), retry by sending the **original video blob** directly to Whisper instead of just the extracted audio. Whisper accepts video files (mp4) and extracts audio internally, which may capture a different/better audio stream.

**File:** `supabase/functions/transcribe-meta-ad-video/index.ts`

Same change: on hallucination retry, if the source is an extracted audio file (`.m4a`), try to fetch and use the original video file from storage instead. If the original video isn't available, fall back to retrying with the same audio + language hint.

### 3. Lower the confidence threshold for edge cases

**File:** `supabase/functions/_shared/hallucination-detection.ts`

Update `computeConfidence` to also factor in repetition. A transcript with significant repetition should get a confidence of 0.3 max, ensuring the UI shows the warning banner.

## Technical Details

### Repetition Detection Algorithm

```text
function detectRepetition(text):
  sentences = split text by period/exclamation/question
  filter sentences with > 5 words
  
  seen = Map<normalizedSentence, count>
  for each sentence:
    normalized = lowercase, trim whitespace
    seen[normalized] += 1
  
  repeatedWordCount = sum of (wordCount * (count - 1)) for sentences where count > 1
  totalWordCount = total words in text
  
  repetitionRatio = repeatedWordCount / totalWordCount
  return { repetitionRatio, hasRepetition: repetitionRatio > 0.3 }
```

### Updated detectHallucination

```text
function detectHallucination(segments, language, text):
  // Existing checks...
  avgNoSpeechProb check
  unexpectedLanguage check
  
  // NEW: Repetition check
  repetition = detectRepetition(text)
  if repetition.hasRepetition:
    hallucinationRisk = max(hallucinationRisk, 0.85)
    reasons.push("repetitive text detected (X% repeated)")
  
  return { hallucinationRisk, shouldRetry, reason }
```

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/_shared/hallucination-detection.ts` | Add `detectRepetition()` function; integrate into `detectHallucination()`; update `computeConfidence()` |
| `supabase/functions/transcribe-meta-ad-video/index.ts` | Pass transcript text to updated `detectHallucination()`; attempt original video on retry |
| `supabase/functions/upload-video-for-transcription/index.ts` | Pass transcript text to updated `detectHallucination()`; send original video blob on retry |

## What This Fixes

- Video 2's repeated "I'm Eachy..." text will be caught by repetition detection
- The UI will show the hallucination warning banner for this video
- On retry, it will attempt using a different audio source for better results
- No database changes needed -- uses existing `hallucination_risk` column
