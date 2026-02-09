

# Increase Primary Text Length for Better Fundraising Copy

## What Changes

The primary text limit will be raised from 300 to 900 characters, and the AI prompt will be updated to produce longer, multi-paragraph fundraising copy. The first 125 characters remain the scroll-stopping hook (this is the part visible before "See More" on Meta), but the full text will now include a proper narrative arc.

## Why

Meta allows up to 2,200 characters for primary text. Research shows that fundraising ads perform best in the 400-900 character range because they give enough room for emotional storytelling, impact framing, and a strong CTA. The current 300-character cap forces the AI to compress everything into a single short paragraph, losing persuasive power.

## Changes (2 files, 4 edits)

### File 1: `supabase/functions/_shared/prompts.ts`

1. **System prompt character limit** (line 146): Change "300 chars max" to "600-900 chars target"
2. **Ad structure arc** (lines 150-153): Update the structure to have a proper 4-part arc:
   - HOOK (first 125 chars): Scroll-stopper (unchanged)
   - BRIDGE (~150 chars): Stakes, evidence, emotional deepening
   - EMOTIONAL DEEPENING (~200 chars): Transcript-derived story, consequences, villain/hero contrast
   - CTA (~100 chars): Specific dollar amount + impact framing + action verb
3. **Tool schema** (line 399): Update `primary_text` description from "max 300 chars" to "600-900 chars target"

### File 2: `supabase/functions/generate-ad-copy/index.ts`

4. **Validation limit** (line 132): Change `primary_text_max` from `300` to `900`

## What Stays the Same

- Headlines: 27 chars max
- Descriptions: 25 chars max
- First 125 chars of primary text remain the hook (visible before "See More")
- All 5 frameworks (PAS, BAB, AIDA, Social Proof, Identity) still used
- Few-shot examples will be updated to demonstrate the longer format
