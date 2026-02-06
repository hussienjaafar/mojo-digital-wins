

# Audit: Ad Copy Prompt -- Best Practices Review

## Current State Summary

The prompt is solid on structure (tool calling, anti-patterns, truthfulness rule). This audit focuses on **effectiveness improvements** -- making the copy convert better.

---

## Finding 1: HIGH -- No "Thinking Before Writing" Instruction

**Problem:** The prompt asks the model to directly output 5 variations. Research consistently shows that asking the model to reason about the input BEFORE generating creative output produces dramatically better results. This is the "chain-of-thought for creative tasks" pattern.

**Fix:** Add a `reasoning` field to the tool schema that the model fills FIRST, forcing it to analyze the transcript's key emotional levers before writing copy. This doesn't add latency (it's one call) but forces deeper engagement with the source material.

Add to `AD_COPY_GENERATION_TOOL` schema:
```
reasoning: {
  type: "object",
  properties: {
    core_conflict: { type: "string", description: "The central conflict/threat from the transcript in one sentence" },
    emotional_lever: { type: "string", description: "The strongest emotional trigger for this audience" },
    donor_identity: { type: "string", description: "Who the donor becomes by giving (hero framing)" },
    villain: { type: "string", description: "The clear antagonist or opposing force" },
    stakes: { type: "string", description: "What happens if the donor does NOT act" },
  },
  required: ["core_conflict", "emotional_lever", "donor_identity", "villain", "stakes"]
}
```

---

## Finding 2: HIGH -- Missing Comparative Framing Guidance

**Problem:** Academic research (Alavi et al. 2025, "Mobilizing Donors on Social Media") shows that negative ads are most effective for fundraising ONLY when they include **comparative elements** -- contrasting the opponent's position with the candidate's alternative. Pure attack ads without comparison suppress donations among progressive/Biden-type supporters.

The current prompt has "ENEMY FRAMING" but no explicit instruction to always **pair the attack with the candidate's positive alternative**.

**Fix:** Update the ENEMY FRAMING section:
```
ENEMY FRAMING (always comparative -- research shows pure attacks suppress progressive donations):
- Always pair the villain with the hero: "[Opponent] wants X. [Candidate] is fighting for Y."
- Contrast creates clarity: "They're cutting. We're investing."
- Never attack without offering the positive alternative
- The donor's contribution bridges the gap between villain's action and hero's solution
```

---

## Finding 3: HIGH -- Segment Tone Guidance Is Too Vague

**Problem:** The `getSegmentTone()` function returns generic one-line guidance like "PROGRESSIVE_BASE: Use values-forward, movement language." This gives the model almost no actionable direction for how the copy should DIFFER between segments.

**Fix:** Expand each segment tone to include specific psychological levers, dollar amount framing, and CTA style:

```
PROGRESSIVE_BASE:
- Lead with shared values and movement identity
- Use collective language ("we", "together", "our movement")
- Frame donation as participation in systemic change
- Suggest amounts: $27 (Bernie anchor), $10, $5
- CTA tone: empowerment ("Be part of this", "Join the fight")

SWING_VOTERS:
- Lead with consequences and tangible impacts, NOT ideology
- Avoid partisan labels (no "progressive", "liberal", "MAGA")
- Focus on pocketbook issues and personal safety
- Use loss aversion: "You could lose X" > "We could gain Y"
- Suggest amounts: $10, $25 (moderate, not extreme)
- CTA tone: protective ("Protect your family", "Don't let this happen")

HIGH_DOLLAR:
- Frame as strategic investment, not emotional plea
- Insider language: "You understand what's at stake"
- Emphasize outsized impact and exclusive role
- Suggest amounts: $100, $250, $500
- CTA tone: strategic ("Make the decisive investment")

GRASSROOTS:
- Maximum urgency, small amounts feel powerful
- "Your $5 is the backbone of this campaign"
- Collective power: "Millions of $5 gifts beat one billionaire"
- CTA tone: immediate ("Right now", "This moment")
```

---

## Finding 4: MEDIUM -- Few-Shot Examples Don't Match Actual Output Format

**Problem:** The few-shot examples show `Primary:`, `Headline:`, `Description:` as labeled text. But the actual output is via tool calling into arrays (`primary_texts[]`, `headlines[]`, `descriptions[]`). The model sees examples in one format but outputs in another -- this creates cognitive friction and can degrade quality.

**Fix:** Reformat few-shot examples to match the tool output structure, presented as JSON snippets:
```json
// PAS Example:
{
  "primary_texts": ["MAGA extremists just voted to gut Social Security. 47 million seniors could lose benefits. Your $27 helps us fight back -- chip in now to protect what we've earned."],
  "headlines": ["Protect Social Security"],
  "descriptions": ["Chip in to fight back"]
}
```

---

## Finding 5: MEDIUM -- No Explicit Hook-Body-CTA Structure

**Problem:** The prompt says "hook in first 125 chars" but doesn't define the three-part structure that high-performing Meta ads follow. The model sometimes produces a hook with no clear transition to CTA, or buries the ask.

**Fix:** Add explicit structure guidance:
```
## AD STRUCTURE (every primary_text must follow this arc):
1. HOOK (first 125 chars): Conflict, threat, or identity trigger -- stops the scroll
2. BRIDGE (next 100 chars): Stakes, evidence, or emotional deepening
3. CTA (final 75 chars): Specific dollar amount + action verb + empowerment framing

The CTA must ALWAYS include:
- A specific dollar amount ($5, $10, $27)
- An action verb (chip in, fight back, stand up, join)
- Why it matters to the DONOR (not the campaign)
```

---

## Finding 6: MEDIUM -- Tool Schema Lacks Per-Variation Metadata

**Problem:** The tool returns flat arrays (`primary_texts[]`, `headlines[]`, `descriptions[]`) with no way to know which framework was used for which variation, or why. This means:
- No way to A/B test by framework
- No way to learn which framework performs best for which segment
- No traceability

**Fix:** Restructure the tool schema to return an array of variation objects:
```json
{
  "reasoning": { ... },
  "variations": [
    {
      "framework": "PAS",
      "primary_text": "...",
      "headline": "...",
      "description": "...",
      "hook_strategy": "pain"
    }
  ]
}
```

This requires a corresponding update to the `generate-ad-copy/index.ts` parsing logic and the `createMetaReadyCopy` function.

---

## Finding 7: LOW -- Temperature 0.95 May Be Too High for Constrained Output

**Problem:** At temperature 0.95 with strict character limits (27 chars headline, 25 chars description), the model sometimes produces outputs that exceed limits or become incoherent. High temperature + tight constraints = more failures.

**Fix:** Lower to **0.85**. Still creative, but more reliable within tight character constraints. The diversity across variations comes from the framework requirement (5 different frameworks), not from temperature randomness.

---

## Finding 8: LOW -- Meta Algorithm Optimization Section is Generic

**Problem:** The "META ALGORITHM OPTIMIZATION" section at the end of the prompt contains generic advice ("emotionally resonant copy -> higher quality score") that doesn't give the model actionable instructions.

**Fix:** Replace with specific, actionable formatting rules:
```
## META BEST PRACTICES:
- Use emoji sparingly (1 max per primary_text) -- overuse triggers spam filters
- Avoid ALL CAPS for more than 2 words -- Meta quality score penalty
- No exclamation marks in headlines -- reduces trust score
- Questions in hooks outperform statements by 15% on CTR
- Numbers and dollar amounts stop the scroll ("$27", "47 million", "14 states")
```

---

## Implementation Summary

### Changes to `supabase/functions/_shared/prompts.ts`:

| Change | Section | Impact |
|--------|---------|--------|
| Add reasoning field to tool schema | `AD_COPY_GENERATION_TOOL` | Forces deeper transcript analysis before writing |
| Add comparative framing rule | `ENEMY FRAMING` | Prevents pure attack ads that suppress progressive donations |
| Expand segment tone guidance | `getSegmentTone()` in `generate-ad-copy/index.ts` | Better differentiation between audience segments |
| Reformat few-shot examples to JSON | `FEW-SHOT EXAMPLES` | Aligns examples with actual output format |
| Add Hook-Bridge-CTA structure | New section after HOOK PATTERNS | Explicit three-part structure for every primary_text |
| Restructure tool schema to per-variation objects | `AD_COPY_GENERATION_TOOL` | Enables framework-level A/B testing and learning |
| Lower temperature to 0.85 | `generate-ad-copy/index.ts` | Better reliability within tight char constraints |
| Replace generic Meta section | `META ALGORITHM OPTIMIZATION` | Actionable formatting rules |

### Changes to `supabase/functions/generate-ad-copy/index.ts`:

| Change | Impact |
|--------|--------|
| Update `generateCopyForSegment` parsing | Handle new `variations[]` structure instead of flat arrays |
| Update `createMetaReadyCopy` | Map from `variations[]` to `MetaReadyVariation[]` |
| Expand `getSegmentTone` | Richer per-segment guidance |
| Lower temperature to 0.85 | Better reliability |
| Store `framework` per variation in DB | Enable framework-level performance analysis |

### Files Changed

- `supabase/functions/_shared/prompts.ts` -- Prompt restructuring, tool schema update, examples reformat
- `supabase/functions/generate-ad-copy/index.ts` -- Parsing logic, segment tones, temperature, DB storage

