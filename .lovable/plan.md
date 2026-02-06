

# Fix: Remove Fabricated Claims from Ad Copy Prompts

## Problem

The AI prompt explicitly instructs the model to fabricate claims:
- **Gift matching** ("3X match ends tonight", "MATCH ALERT", "Every dollar = $2") -- there is no match program
- **Fake donor counts** ("127 donors needed", "2,847 donors joined TODAY", "23,847 grassroots donors") -- made-up numbers
- **Fake deadlines** ("before midnight", "24 hours left") -- not tied to any real deadline

These are in the system prompt's hook patterns, few-shot examples, and the "URGENCY TACTICS" section. The model follows instructions faithfully and reproduces these fabricated claims in output.

## Root Cause

Three specific sections in `supabase/functions/_shared/prompts.ts`:

1. **HOOK PATTERNS (lines 157-163):** Template hooks with fake numbers ("127 donors needed", "⏰ 24 hours")
2. **FEW-SHOT EXAMPLES (lines 166-190):** 3 of 5 examples contain fabricated stats or match claims
3. **URGENCY TACTICS (lines 193-198):** Explicitly lists "Matching" and "Thresholds" as tactics with fabricated examples
4. **SMS PROMPT (line 328):** "MATCH ALERT" example

## Solution

Rewrite all affected sections to use **only truthful urgency techniques** grounded in the actual transcript/video content. The AI should derive urgency from the political stakes described in the video -- not invent numbers or programs.

### Changes to `supabase/functions/_shared/prompts.ts`

**1. Replace ANTI-PATTERNS section** -- add fabrication as explicit anti-patterns:
```
## ANTI-PATTERNS -- NEVER produce copy like this:
- "Dear supporter, we need your help..." -> Too generic, zero hook
- "Candidate X is running for office..." -> Name-first, no conflict
- "Please consider making a contribution..." -> Passive, no urgency
- "We're asking for your support today..." -> Vague, donor not the hero
- "Help us reach our goal..." -> Begging frame, not empowerment
- "Click here to donate..." -> Lazy CTA, no emotional trigger
- "3X match ends tonight!" -> FABRICATED. Never claim matching unless provided in context.
- "23,847 donors this week" -> FABRICATED. Never invent donor counts or statistics.
- "Only 127 donors needed!" -> FABRICATED. Never invent thresholds or goals.
- "24 hours left!" -> FABRICATED. Never claim a deadline unless one is provided in context.
```

**2. Replace HOOK PATTERNS** -- remove all fabricated numbers:
```
## HOOK PATTERNS (first 125 chars -- stop the scroll):
- PAIN: "[Opponent] just [harmful action from transcript]. We can't let this stand."
- STAKES: "If we lose this fight, [specific consequence from transcript]."
- CURIOSITY: "They spent millions to bury this. Here's what they don't want you to see."
- IDENTITY: "If you believe in [value from transcript], this is your moment."
- THREAT: "They're outspending us with corporate PAC money. We fight back with grassroots power."
- QUESTION: "What happens to [value from transcript] if [opponent] wins?"
```

**3. Replace FEW-SHOT EXAMPLES** -- remove all fabricated stats/matches:
```
**PAS Example:**
Primary: "MAGA extremists just voted to gut Social Security. 47 million seniors could lose benefits. Your $27 helps us fight back -- chip in now to protect what we've earned."
Headline: "Protect Social Security"
Description: "Chip in to fight back"

**BAB Example:**
Primary: "Right now, families are choosing between medicine and rent. With [Candidate], no one makes that choice. Your donation builds that future -- $5 is all it takes."
Headline: "Healthcare for everyone"
Description: "$5 builds our future"

**AIDA Example:**
Primary: "They just banned books in 14 states. Next: your kids' school. [Candidate] is the only one fighting back. This is the moment to stand up -- don't sit this out."
Headline: "Fight the book bans"
Description: "Stand up. Chip in."

**Social Proof Example:**
Primary: "Zero corporate PAC money. 100% grassroots funded. This is what a people-powered campaign looks like. Chip in $5 to keep the movement growing."
Headline: "People over PACs"
Description: "100% grassroots funded"

**Identity Example:**
Primary: "If you believe every kid deserves a great school -- not just rich kids -- this is your fight. Your $10 funds organizers in swing districts. Be the difference."
Headline: "Education is a right"
Description: "Fund the fight"
```

**4. Replace URGENCY TACTICS** -- remove matching and fabricated thresholds:
```
URGENCY TACTICS (use ONLY what is truthful):
- Political stakes ("If we don't act, [real consequence from transcript]")
- Legislative deadlines (ONLY if mentioned in transcript/context)
- Opponent actions ("They just [real action]. We must respond.")
- Momentum framing ("Every dollar strengthens our grassroots campaign")

NEVER FABRICATE:
- Dollar matching (no "2X", "3X match" unless explicitly provided in context)
- Donor counts or statistics (no "X donors this week" unless provided)
- Arbitrary deadlines (no "midnight tonight" unless a real deadline exists)
- Fundraising goals or thresholds (no "X donors away from our goal")
```

**5. Add a top-level TRUTHFULNESS RULE** to the system prompt (new rule #6 in HARD RULES):
```
6. NEVER fabricate claims: no fake matching, fake donor counts, fake deadlines,
   or fake statistics. Urgency must come from REAL political stakes in the
   transcript. If no deadline exists, do not invent one.
```

**6. Fix SMS prompt** -- remove the MATCH ALERT example:
```
## GOOD SMS PATTERNS:
- "[Opponent] just [action]. Fight back now: [link]"
- "If [consequence from context], we lose everything. Chip in $X -> [link]"
- "[Value] is on the line. Your $X makes the difference -> [link]"
```

### Summary of Changes

| Section | Before | After |
|---------|--------|-------|
| Hard Rules | 5 rules | 6 rules (added truthfulness rule) |
| Anti-Patterns | 6 examples | 10 examples (added 4 fabrication anti-patterns) |
| Hook Patterns | Contain fake numbers | All grounded in transcript content |
| Few-Shot Examples | 3/5 have fake stats/matches | 0/5 have fabricated claims |
| Urgency Tactics | Lists matching + thresholds | Lists only truthful tactics + explicit NEVER FABRICATE section |
| SMS Prompt | "MATCH ALERT" example | Grounded examples only |

Only one file changes: `supabase/functions/_shared/prompts.ts`

