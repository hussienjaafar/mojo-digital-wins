

# Fix: Ad Copy Generation Failures (Empty AI Responses)

## Root Cause

The `generate-ad-copy` edge function calls `google/gemini-2.5-pro` with tool calling (`toolChoice: "required"`). The AI gateway is returning **completely empty responses** — no tool calls, no content, zero bytes. This causes both segments to fail, and since there's no retry logic, the entire generation fails.

The logs confirm:
- "No tool calls returned. Content length: 0"
- "Content preview: empty"  
- Both segments failed with the same error
- Latency was ~20 seconds each (the model processed but returned nothing)

## Solution

### 1. Add Retry Logic to `callLovableAIWithTools` in `_shared/ai-client.ts`

When the AI returns an empty response (no tool calls AND no content), retry up to 2 additional times with a brief delay before throwing. This handles transient empty responses from the gateway.

- Retry only on empty responses (not on actual errors like 429/402)
- Add a 1-second delay between retries
- Log each retry attempt for debugging

### 2. Add Model Fallback in `generate-ad-copy/index.ts`

If `google/gemini-2.5-pro` fails for a segment, retry once with `google/gemini-2.5-flash` as a fallback model. Flash is faster and may succeed when Pro returns empty responses.

- Wrap the `generateCopyForSegment` call with fallback logic
- Log which model ultimately succeeded
- This ensures at least partial generation even when one model has issues

### 3. Partial Success Handling

Currently, if ALL segments fail the function returns an error. But if generation worked for some segments but not others, we should return partial results with a warning rather than failing entirely.

- Return whatever segments succeeded
- Include a `warnings` array in the response listing which segments failed
- Frontend already handles per-segment data so partial results will render correctly

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/_shared/ai-client.ts` | Add retry loop (up to 3 attempts) for empty responses in `callLovableAIWithTools` |
| `supabase/functions/generate-ad-copy/index.ts` | Add model fallback (Pro then Flash) per segment; return partial results on partial failure |

## Technical Details

### Retry Logic (ai-client.ts)

```text
callLovableAIWithTools():
  for attempt 1..3:
    result = callLovableAI(options)
    if result has tool calls OR parseable content -> return
    if attempt < 3 -> log warning, wait 1s, retry
  throw "AI did not return structured tool call output"
```

### Model Fallback (generate-ad-copy/index.ts)

```text
for each segment:
  result = generateCopyForSegment(transcript, segment, "google/gemini-2.5-pro")
  if result is null:
    log "Pro failed, trying Flash fallback"
    result = generateCopyForSegment(transcript, segment, "google/gemini-2.5-flash")
  if result -> add to results
  else -> add to warnings
```

The `generateCopyForSegment` function will accept an optional `model` parameter to support fallback.
