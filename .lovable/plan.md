

# Fix: Ad Copy Generation Returning Empty Results

## What Happened

The edge function logs show the exact failure chain:

1. The AI call to `google/gemini-2.5-pro` completed (20s latency) but **did not return tool calls** -- it returned the content as plain text instead
2. The fallback JSON parser in `callLovableAIWithTools` tried to extract JSON via regex but failed (likely markdown code fences wrapping the JSON)
3. The error `"AI did not return structured tool call output"` was thrown
4. `generateCopyForSegment` caught the error and returned `null`
5. The main handler treated `null` as empty arrays and returned a **200 success** with zero copy -- silently failing

## Root Causes

**Cause 1: Fragile fallback JSON parsing.** The regex `[\[{][\s\S]*[\]}]` doesn't handle markdown-fenced responses like:
```
```json
{ "reasoning": {...}, "variations": [...] }
```                                             <-- This backtick breaks the regex
```

**Cause 2: Silent failure.** When all segments fail to generate, the function returns `200 OK` with empty arrays instead of an error. The frontend sees "success" and moves to step 5 with nothing to show.

**Cause 3: `toolChoice` format may not be fully supported.** The current format `{ type: "function", function: { name: "generate_ad_copy" } }` is the OpenAI format. The Lovable AI Gateway proxying to Gemini may not translate this correctly, causing Gemini to ignore the tool and respond with plain text.

## Fix Plan

### 1. Improve fallback JSON parsing in `ai-client.ts`

Strip markdown code fences before attempting JSON extraction:

```typescript
if (aiResult.content) {
  try {
    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    let cleaned = aiResult.content;
    cleaned = cleaned.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
    const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      return {
        result: JSON.parse(jsonMatch[0]) as T,
        model: aiResult.model,
        latencyMs: aiResult.latencyMs,
      };
    }
  } catch {
    // Fall through to error
  }
}
```

### 2. Add logging of raw AI content on fallback failure in `ai-client.ts`

When tool calls are missing, log what the model actually returned so we can debug:

```typescript
if (!aiResult.toolCalls || aiResult.toolCalls.length === 0) {
  console.warn(`[AI] No tool calls returned. Content length: ${aiResult.content?.length || 0}`);
  console.warn(`[AI] Content preview: ${aiResult.content?.substring(0, 500) || 'empty'}`);
  // ... existing fallback logic
}
```

### 3. Return error when all segments produce empty results in `generate-ad-copy/index.ts`

After the generation loop, check if ALL segments returned empty and return an error instead of silent success:

```typescript
// After building generatedCopy and metaReadyCopy...
const totalVariations = Object.values(metaReadyCopy)
  .reduce((sum, seg) => sum + seg.variations.length, 0);

if (totalVariations === 0) {
  return new Response(
    JSON.stringify({ success: false, error: 'AI generation failed for all segments. Please try again.' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### 4. Simplify `toolChoice` format for broader gateway compatibility

Change from the explicit function-forcing format to the simpler `"auto"` or `"required"` format:

```typescript
// Before
toolChoice: { type: "function", function: { name: "generate_ad_copy" } }

// After
toolChoice: "required"
```

`"required"` tells the model it MUST use a tool call but doesn't force a specific function name -- this has broader compatibility across gateways.

## Files Changed

| File | Changes |
|------|---------|
| `supabase/functions/_shared/ai-client.ts` | Better fallback parsing (strip markdown fences), debug logging |
| `supabase/functions/generate-ad-copy/index.ts` | Error on empty results, simplify toolChoice |

## Technical Details

- Only 2 files change, both are edge functions
- No database or frontend changes needed
- The frontend already handles error responses (shows retry button)
