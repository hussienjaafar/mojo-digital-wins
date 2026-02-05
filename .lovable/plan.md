
# Fix: Generate Ad Copy Edge Function Not Deployed

## Problem

The "Generation Failed" error on the final step of the Ad Copy Studio occurs because the `generate-ad-copy` edge function was never registered in `supabase/config.toml` and therefore never deployed.

The function exists in `supabase/functions/generate-ad-copy/index.ts` and uses the configured `OPENAI_API_KEY` secret, but without being in `config.toml`, the runtime doesn't know to deploy it.

## Solution

Add the `generate-ad-copy` function to `supabase/config.toml` and deploy it.

## Implementation

### Step 1: Register Function in config.toml

Add entry to `supabase/config.toml`:

```toml
[functions.generate-ad-copy]
verify_jwt = true  # Requires authentication for ad copy generation
```

This should be added in the client-authenticated functions section (after line 219 with the other content generation functions).

### Step 2: Deploy the Function

After updating the config, deploy the function so it becomes available.

## Files Changed

| File | Change |
|------|--------|
| `supabase/config.toml` | Add `[functions.generate-ad-copy]` entry with `verify_jwt = true` |

## Technical Notes

- The function already exists and is complete (`supabase/functions/generate-ad-copy/index.ts` - 581 lines)
- Uses `OPENAI_API_KEY` which is already configured as a secret
- Uses `gpt-4-turbo-preview` model via direct OpenAI API calls
- Generates 5 variations per audience segment with Meta-compliant character limits
- No code changes needed - only registration and deployment

## Verification

After deployment:
1. Retry the "Generate Ad Copy" step in the Ad Copy Studio
2. The function should successfully call OpenAI and return generated ad copy
3. The UI should display the generated variations for each audience segment
