

# Ad Copy Prompt Engineering Overhaul

## Research Conclusion: Best Model for Ad Copy

After deep research across multiple 2025/2026 benchmarks and reviews:

- **GPT-5** has weaker creative writing than its predecessor -- multiple independent reviews describe its output as "dry," "academic," and "robotic." OpenAI traded literary flair for accuracy.
- **Claude (Opus 4/Sonnet 4)** is the consensus winner for creative/marketing copy, but is NOT available through the Lovable AI Gateway.
- **Gemini 2.5 Pro** is the strongest available model -- best reasoning, largest context window, and solid creative capabilities. With proper prompt engineering (few-shot examples, anti-patterns, high temperature), it produces strong results.

**Decision: Use `google/gemini-2.5-pro`** for all ad copy generation (highest quality available), and `google/gemini-3-flash-preview` for analysis/classification tasks (fast, cheap, accurate for structured extraction).

---

## Implementation Plan

### Phase 1: Create Shared Infrastructure

**New file: `supabase/functions/_shared/prompts.ts`**
- Unified transcript analysis prompt (used by 3 functions today)
- Political ad copy system prompt with negative examples and few-shot examples
- SMS analysis system prompt

**New file: `supabase/functions/_shared/ai-client.ts`**
- `callLovableAI()` helper that wraps the gateway call
- Handles 429 (rate limit) and 402 (payment required) errors
- Configurable model, temperature, and tool calling support
- Logging for model/latency tracking

### Phase 2: Overhaul `generate-ad-copy` (Primary Revenue Function)

**Changes to `supabase/functions/generate-ad-copy/index.ts`:**

1. **Migrate from OpenAI direct to Lovable AI Gateway** (`google/gemini-2.5-pro`)
2. **Restructure prompt architecture:**
   - System message: Persona + hard constraints + anti-patterns + few-shot examples
   - User message: Only variable data (transcript, segment, limits)
   - Currently both messages duplicate the persona, wasting tokens
3. **Add negative examples section** to the prompt:
   ```
   ANTI-PATTERNS (never produce copy like this):
   - "Dear supporter, we need your help..." (too generic, no hook)
   - "Candidate X is running for office..." (name-first, no conflict)
   - "Please consider making a contribution..." (passive, no urgency)
   - "We're asking for your support today..." (vague, donor not the hero)
   ```
4. **Add 1 few-shot gold-standard example per framework** (PAS, BAB, AIDA, Social Proof, Identity) showing a complete primary_text + headline + description triplet
5. **Update Meta character limits** for mobile-safe placements:
   - Headline: 27 chars (mobile safe) instead of 40
   - Description: 25 chars (mobile safe) instead of 30
   - Primary text: Keep 125/300 split (correct)
6. **Increase temperature to 0.95** for maximum creative diversity
7. **Switch to tool calling** for structured JSON output (eliminates regex parsing failures)
8. **Update `generation_model` field** in database insert from `gpt-4-turbo-preview` to `google/gemini-2.5-pro`

### Phase 3: Overhaul `generate-campaign-messages` (SMS)

**Changes to `supabase/functions/generate-campaign-messages/index.ts`:**

1. **Add system message** with SMS copywriting persona and hard constraints (160 char limit)
2. **Switch to tool calling** for structured JSON output
3. **Set temperature to 0.8** (creative but constrained by 160 chars)
4. **Add negative examples** for SMS anti-patterns

### Phase 4: Fix `analyze-sms-creatives` (Classification)

**Changes to `supabase/functions/analyze-sms-creatives/index.ts`:**

1. **Switch to tool calling** for structured JSON output
2. **Set temperature to 0.1** (pure classification -- should be deterministic)
3. **Replace hardcoded `analysis_confidence: 0.85`** with model-reported confidence or remove it

### Phase 5: Migrate Transcript Analysis Functions

**Changes to `supabase/functions/reanalyze-transcript/index.ts`:**
1. Migrate from direct OpenAI API to Lovable AI Gateway (`google/gemini-3-flash-preview`)
2. Import shared prompt from `_shared/prompts.ts`
3. Set temperature to 0.1 (analysis task)
4. Switch to tool calling for structured output

**Changes to `supabase/functions/upload-video-for-transcription/index.ts`:**
1. Migrate analysis step from direct OpenAI API to Lovable AI Gateway
2. Import shared prompt from `_shared/prompts.ts`
3. Note: Whisper transcription step still needs OpenAI API (audio transcription is not available through Lovable AI Gateway)

### Phase 6: Deploy All Functions

Deploy all 6 updated functions:
- `generate-ad-copy`
- `generate-campaign-messages`
- `analyze-sms-creatives`
- `reanalyze-transcript`
- `upload-video-for-transcription`
- `transcribe-meta-ad-video` (if applicable)

---

## Files Changed Summary

| File | Change Type | Model |
|------|------------|-------|
| `supabase/functions/_shared/prompts.ts` | NEW | -- |
| `supabase/functions/_shared/ai-client.ts` | NEW | -- |
| `supabase/functions/generate-ad-copy/index.ts` | MAJOR rewrite | gemini-2.5-pro |
| `supabase/functions/generate-campaign-messages/index.ts` | Moderate update | gemini-2.5-flash (keep, SMS is simpler) |
| `supabase/functions/analyze-sms-creatives/index.ts` | Moderate update | gemini-2.5-flash (keep) |
| `supabase/functions/reanalyze-transcript/index.ts` | API migration | gemini-3-flash-preview |
| `supabase/functions/upload-video-for-transcription/index.ts` | Partial migration | gemini-3-flash-preview (analysis only) |

