
# Improve Ad Copy Generation with Research-Backed Best Practices

## Executive Summary

The current ad copy generation prompt is producing generic, low-converting copy because it lacks:
- Proven copywriting frameworks (PAS, BAB, AIDA)
- Political fundraising psychology and donor conversion tactics  
- Meta algorithm optimization for engagement signals
- Proper hook creation and scroll-stopping techniques
- Emotional triggers specific to political giving

This plan implements research-backed improvements that will generate higher-converting copy optimized for Meta's algorithm.

---

## Research Findings

### Meta Character Limits (2025 Best Practices)
| Element | Visible Limit | Recommended |
|---------|--------------|-------------|
| Primary Text | 125 chars before "See More" | Front-load hook in first 125, can extend to 300 for full context |
| Headline | 40 characters | 27-40 chars ideal |
| Description | 30 characters | Optional, use for urgency/proof |

### Meta Algorithm Ranking Factors
1. **Estimated Action Rate** - How likely user takes desired action
2. **Quality/Engagement/Conversion Rankings** - Better ads cost less
3. **User Feedback** - Negative signals hurt delivery
4. **Alignment** - Creative must match landing page intent

### Political Fundraising Psychology
- **Urgency**: Deadlines, matching grants, opponent threats
- **Identity**: "Donors like you", "Patriots who care"
- **Social Proof**: Donor counts, momentum signals
- **Fear of Loss**: What happens if we don't act
- **Empowerment**: "Your $X can change..."

---

## Implementation Plan

### Step 1: Update Character Limit Constants

Update the limits to align with 2025 Meta specs and allow more compelling primary text:

```text
primary_text_visible: 125      (hook must fit here)
primary_text_max: 300          (new: allow extended context)
headline_max: 40               (unchanged)  
description_max: 30            (unchanged)
```

### Step 2: Completely Rewrite the System Prompt

Replace the current basic prompt with a research-backed prompt that includes:

**Role Definition:**
- Expert political fundraising copywriter specializing in ActBlue/Meta ads
- Deep understanding of donor psychology and conversion optimization

**Framework Requirements:**
- Use proven frameworks: PAS, BAB, AIDA, Social Proof
- Each variation must use a DIFFERENT framework (not just angle)

**Hook Requirements (First 125 Characters):**
- Must stop the scroll - use pattern interrupts
- 6 hook types: Pain Point, Curiosity Gap, Benefit-First, FOMO, Question, Story
- No slow builds - front-load the emotional punch

**Political Fundraising Specifics:**
- Urgency tactics: deadlines, matching, thresholds
- Identity reinforcement: "donors like you", shared values
- Enemy framing: clear villain, contrast
- Empowerment: specific impact of donation
- Social proof: momentum signals

**Meta Algorithm Optimization:**
- Copy that drives engagement (likes, shares, comments)
- Clear benefit in first line
- Emotional resonance for higher quality ranking
- CTA alignment with donation intent

### Step 3: Add Structured Framework Instructions

Each of the 5 variations will use a specific framework:

1. **PAS (Problem-Agitate-Solution)**
   - Open with the threat/problem
   - Intensify the stakes (what happens if we fail)
   - Position the candidate/cause + donation as the solution

2. **BAB (Before-After-Bridge)** 
   - Before: The current danger/injustice
   - After: The future we're fighting for
   - Bridge: "Your donation makes this possible"

3. **AIDA (Attention-Interest-Desire-Action)**
   - Attention: Pattern interrupt hook
   - Interest: Compelling detail/stat
   - Desire: What donor will feel/achieve
   - Action: Urgent CTA

4. **Social Proof + Urgency**
   - Momentum signals ("23,847 donors this week")
   - Deadline urgency ("48 hours left")
   - Collective identity ("Join [X] patriots")

5. **Identity + Empowerment**
   - Identity reinforcement ("If you believe...")
   - Specific impact ("Your $27 provides...")
   - Call to values, not just wallet

### Step 4: Add Hook-Specific Templates

Provide concrete hook patterns for political fundraising:

```text
PAIN POINT HOOKS:
- "[Opponent] just voted to [harmful action]. We can't let this stand."
- "They're spending millions to defeat [Candidate]. We're fighting back."

URGENCY HOOKS:
- "DEADLINE: Midnight tonight. [X] donors needed."
- "MATCHING ACTIVE: Every dollar = $2 until midnight."

CURIOSITY HOOKS:
- "The GOP doesn't want you to see this video..."
- "Here's what they're not telling you about..."

IDENTITY HOOKS:
- "If you believe [value], this message is for you."
- "This is for every [identity] who's had enough."
```

### Step 5: Add Segment-Aware Tone Adaptation

Match tone/approach to audience segment type:

| Segment Type | Approach |
|--------------|----------|
| Progressive base | Values-forward, movement language |
| Swing/persuadable | Fear of loss, specific impacts |
| High-dollar donors | Empowerment, strategic framing |
| Grassroots | Urgency, collective action |

---

## Technical Changes

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/generate-ad-copy/index.ts` | Complete rewrite of `buildPrompt()` function, update constants, add framework instructions |

### New Prompt Structure

```text
EXPERT ROLE:
You are a world-class political fundraising copywriter who has raised 
$50M+ through Meta ads for progressive campaigns. You understand:
- Donor psychology and what triggers donations
- Meta's algorithm and what drives engagement
- ActBlue optimization and conversion tactics

VIDEO ANALYSIS:
[transcript data - unchanged]

TARGET AUDIENCE:
[segment data - unchanged]

COPYWRITING FRAMEWORKS (Use ONE per variation):
1. PAS Framework - Open with threat, agitate stakes, donation = solution
2. BAB Framework - Before danger, After victory, Bridge = their donation
3. AIDA Framework - Attention hook, Interest detail, Desire/emotion, Action
4. Social Proof + Urgency - Momentum signals, deadline pressure
5. Identity + Empowerment - Values call, specific impact of their dollars

HOOK REQUIREMENTS (CRITICAL - First 125 chars):
The first 125 characters MUST stop the scroll. Use pattern interrupts:
- Lead with conflict, threat, or surprise
- Use "you" language - make it personal  
- Create curiosity gap or fear of missing out
- Never start with the candidate's name or generic statements

POLITICAL FUNDRAISING TACTICS:
- Always include urgency (deadlines, matching, thresholds)
- Reinforce donor identity ("donors like you", shared values)
- Create clear villain/contrast
- Specify donation impact ($27 = specific outcome)
- Use social proof when available (donor counts, momentum)

META ALGORITHM OPTIMIZATION:
- Emotionally resonant copy ranks higher (quality score)
- Clear benefit in line 1 improves click-through
- Authentic voice > polished marketing speak
- Match energy/tone to landing page intent

OUTPUT FORMAT:
{
  "primary_texts": [
    // 5 variations, each 200-300 chars, hook in first 125
  ],
  "headlines": [
    // 5 variations, max 40 chars each, action-oriented
  ],
  "descriptions": [
    // 5 variations, max 30 chars, urgency/proof/value
  ]
}
```

---

## Expected Improvements

| Metric | Current | Expected |
|--------|---------|----------|
| Hook strength | Generic angles | Scroll-stopping pattern interrupts |
| Emotional resonance | Low | High (donor psychology) |
| Framework consistency | None | Proven frameworks per variation |
| Meta algorithm fit | Basic compliance | Engagement-optimized |
| Conversion intent | Generic CTAs | ActBlue-optimized urgency |

---

## Additional Recommendations

### Future Enhancements (Not in This Plan)

1. **A/B Testing Integration**: Track which frameworks perform best per segment
2. **Dynamic Urgency**: Pull real deadline/matching data from campaign settings
3. **Competitor Analysis**: Analyze opponent messaging for contrast opportunities
4. **Performance Feedback Loop**: Use conversion data to refine prompts over time

---

## Summary of Technical Work

1. Update `META_COPY_LIMITS` constant to include `primary_text_max: 300`
2. Completely rewrite `buildPrompt()` function with research-backed structure
3. Add framework-specific instructions for each variation
4. Include political fundraising psychology and Meta algorithm optimization
5. Deploy updated edge function
