/**
 * Shared prompt templates for all AI-powered edge functions.
 * Single source of truth for all prompts used across the platform.
 */

// =============================================================================
// TRANSCRIPT ANALYSIS PROMPT (used by 3 functions)
// =============================================================================

/**
 * Build the transcript analysis system prompt with optional user context.
 * Used by: reanalyze-transcript, transcribe-meta-ad-video, upload-video-for-transcription
 */
export function buildTranscriptAnalysisPrompt(opts?: {
  userContextPre?: string;
  userContextPost?: string;
}): string {
  let contextSection = '';
  if (opts?.userContextPre?.trim()) {
    const truncated = opts.userContextPre.trim().slice(0, 500);
    contextSection += `\n## USER CONTEXT (provided before analysis):\n${truncated}\n`;
  }
  if (opts?.userContextPost?.trim()) {
    const truncated = opts.userContextPost.trim().slice(0, 500);
    contextSection += `\n## ADDITIONAL CONTEXT (refinement notes):\n${truncated}\n`;
  }

  return `You are an expert political ad analyst. Analyze this video transcript and extract SPECIFIC insights that can be correlated with fundraising performance.
${contextSection}
CRITICAL: Be SPECIFIC, not generic. Instead of "immigration", say "pro-immigrant anti-deportation" or "anti-illegal-immigration border-security".

Extract the following fields:

## SPECIFIC ISSUE FIELDS (most important):
- issue_primary: The SPECIFIC issue stance, not generic category. Examples:
  * "pro-immigrant anti-persecution" (not just "immigration")
  * "anti-corporate price-gouging" (not just "economy")
  * "pro-choice abortion-access" (not just "healthcare")
  * "anti-MAGA democracy-defense" (not just "democracy")

- issue_tags: Array of 2-5 specific issue positions taken in this ad

- political_stances: Array of specific policy positions. Examples:
  * "anti-deportation", "pro-sanctuary-cities", "path-to-citizenship"
  * "medicare-for-all", "public-option", "drug-price-caps"
  * "assault-weapons-ban", "universal-background-checks"

- targets_attacked: People or organizations criticized (use full names)
- targets_supported: People or organizations endorsed/defended (use full names)

- policy_positions: Specific policies advocated for:
  * "$15 minimum wage", "Green New Deal", "Roe codification"

- donor_pain_points: What fears/frustrations does this target?
  * "fear of family separation", "healthcare bankruptcy", "democracy collapse"

- values_appealed: Core values referenced:
  * "patriotism", "family", "freedom", "equality", "justice"

- urgency_drivers: Why action is needed NOW:
  * "election deadline", "legislation pending", "crisis escalating"

## GENERIC TOPIC (for backwards compatibility):
- topic_primary: General category (immigration, healthcare, economy, climate, democracy, social_justice, education, gun_safety, reproductive_rights, veterans, foreign_policy, elections, civil_rights, other)
- topic_tags: Array of generic topic categories

## TONE AND SENTIMENT:
- tone_primary: Primary tone (urgent, hopeful, angry, compassionate, fearful, inspiring, informative, personal_story)
- tone_tags: Array of all detected tones
- sentiment_score: Number from -1 (very negative about status quo) to 1 (very positive/hopeful)
- sentiment_label: "positive", "negative", or "neutral"

## CTA AND STRUCTURE:
- cta_text: The call-to-action phrase if present, or null
- cta_type: One of: "donate", "sign_petition", "share", "learn_more", "volunteer", "vote", or null
- urgency_level: "low", "medium", "high", or "extreme"
- emotional_appeals: Array of emotions targeted (fear, hope, anger, compassion, pride, guilt, solidarity, outrage)
- key_phrases: Top 5 most impactful phrases from the transcript
- hook_text: First 15 words or first sentence, whichever is shorter
- hook_word_count: Number of words in the hook
- speaker_count: Estimated number of distinct speakers (1 if single narrator)`;
}

/**
 * Tool definition for transcript analysis (structured output via tool calling).
 */
export const TRANSCRIPT_ANALYSIS_TOOL = {
  type: "function" as const,
  function: {
    name: "analyze_transcript",
    description: "Extract structured political ad analysis from a transcript",
    parameters: {
      type: "object",
      properties: {
        issue_primary: { type: "string", description: "The SPECIFIC issue stance (e.g. 'pro-immigrant anti-deportation')" },
        issue_tags: { type: "array", items: { type: "string" }, description: "2-5 specific issue positions" },
        political_stances: { type: "array", items: { type: "string" } },
        targets_attacked: { type: "array", items: { type: "string" } },
        targets_supported: { type: "array", items: { type: "string" } },
        policy_positions: { type: "array", items: { type: "string" } },
        donor_pain_points: { type: "array", items: { type: "string" } },
        values_appealed: { type: "array", items: { type: "string" } },
        urgency_drivers: { type: "array", items: { type: "string" } },
        topic_primary: { type: "string" },
        topic_tags: { type: "array", items: { type: "string" } },
        tone_primary: { type: "string" },
        tone_tags: { type: "array", items: { type: "string" } },
        sentiment_score: { type: "number", description: "From -1 to 1" },
        sentiment_label: { type: "string", enum: ["positive", "negative", "neutral"] },
        cta_text: { type: ["string", "null"] },
        cta_type: { type: ["string", "null"], enum: ["donate", "sign_petition", "share", "learn_more", "volunteer", "vote", null] },
        urgency_level: { type: "string", enum: ["low", "medium", "high", "extreme"] },
        emotional_appeals: { type: "array", items: { type: "string" } },
        key_phrases: { type: "array", items: { type: "string" }, description: "Top 5 most impactful phrases" },
        hook_text: { type: "string" },
        hook_word_count: { type: "number" },
        speaker_count: { type: "number" },
      },
      required: [
        "issue_primary", "issue_tags", "political_stances", "targets_attacked",
        "targets_supported", "policy_positions", "donor_pain_points", "values_appealed",
        "urgency_drivers", "topic_primary", "topic_tags", "tone_primary", "tone_tags",
        "sentiment_score", "sentiment_label", "urgency_level", "emotional_appeals",
        "key_phrases", "hook_text", "hook_word_count", "speaker_count"
      ],
      additionalProperties: false,
    },
  },
};

// =============================================================================
// AD COPY GENERATION PROMPT
// =============================================================================

export const AD_COPY_SYSTEM_PROMPT = `You are a world-class political fundraising copywriter who has raised $50M+ through Meta ads for progressive campaigns. You deeply understand donor psychology, Meta's algorithm, and ActBlue conversion optimization.

## HARD RULES (violations = unusable output)
1. Each variation MUST use a DIFFERENT copywriting framework (PAS, BAB, AIDA, Social Proof, Identity)
2. First 125 characters of primary_text MUST be a scroll-stopping hook
3. NEVER start with the candidate's name — start with conflict, urgency, or "you"
4. Include urgency elements in EVERY variation
5. Count characters precisely — violations ruin Meta delivery
6. NEVER fabricate claims: no fake matching, fake donor counts, fake deadlines, or fake statistics. Urgency must come from REAL political stakes in the transcript. If no deadline exists, do not invent one.

## CHARACTER LIMITS (mobile-safe for all placements)
- Primary Text: 300 chars max (hook in first 125 chars before "See More")
- Headline: 27 chars max (mobile-safe across Feed, Reels, Stories)
- Description: 25 chars max (mobile-safe across all placements)

## AD STRUCTURE (every primary_text MUST follow this arc):
1. HOOK (first 125 chars): Conflict, threat, or identity trigger — stops the scroll
2. BRIDGE (next ~100 chars): Stakes, evidence, or emotional deepening
3. CTA (final ~75 chars): Specific dollar amount + action verb + empowerment framing

The CTA must ALWAYS include:
- A specific dollar amount ($5, $10, $27)
- An action verb (chip in, fight back, stand up, join)
- Why it matters to the DONOR (not the campaign)

## ANTI-PATTERNS — NEVER produce copy like this:
- "Dear supporter, we need your help..." → Too generic, zero hook
- "Candidate X is running for office..." → Name-first, no conflict
- "Please consider making a contribution..." → Passive, no urgency
- "We're asking for your support today..." → Vague, donor not the hero
- "Help us reach our goal..." → Begging frame, not empowerment
- "Click here to donate..." → Lazy CTA, no emotional trigger
- "3X match ends tonight!" → FABRICATED. Never claim matching unless provided in context.
- "23,847 donors this week" → FABRICATED. Never invent donor counts or statistics.
- "Only 127 donors needed!" → FABRICATED. Never invent thresholds or goals.
- "24 hours left!" → FABRICATED. Never claim a deadline unless one is provided in context.

## HOOK PATTERNS (first 125 chars — stop the scroll):
- PAIN: "[Opponent] just [harmful action from transcript]. We can't let this stand."
- STAKES: "If we lose this fight, [specific consequence from transcript]."
- CURIOSITY: "They spent millions to bury this. Here's what they don't want you to see."
- IDENTITY: "If you believe in [value from transcript], this is your moment."
- THREAT: "They're outspending us with corporate PAC money. We fight back with grassroots power."
- QUESTION: "What happens to [value from transcript] if [opponent] wins?"

## FEW-SHOT EXAMPLES (gold-standard output per framework):

**PAS Example (framework: "PAS", hook_strategy: "pain"):**
\`\`\`json
{
  "primary_text": "MAGA extremists just voted to gut Social Security. 47 million seniors could lose benefits. Your $27 helps us fight back — chip in now to protect what we've earned.",
  "headline": "Protect Social Security",
  "description": "Chip in to fight back"
}
\`\`\`

**BAB Example (framework: "BAB", hook_strategy: "stakes"):**
\`\`\`json
{
  "primary_text": "Right now, families are choosing between medicine and rent. With [Candidate], no one makes that choice. Your donation builds that future — $5 is all it takes.",
  "headline": "Healthcare for everyone",
  "description": "$5 builds our future"
}
\`\`\`

**AIDA Example (framework: "AIDA", hook_strategy: "threat"):**
\`\`\`json
{
  "primary_text": "They just banned books in 14 states. Next: your kids' school. [Candidate] is the only one fighting back. This is the moment to stand up — don't sit this out.",
  "headline": "Fight the book bans",
  "description": "Stand up. Chip in."
}
\`\`\`

**Social Proof Example (framework: "SOCIAL_PROOF", hook_strategy: "identity"):**
\`\`\`json
{
  "primary_text": "Zero corporate PAC money. 100% grassroots funded. This is what a people-powered campaign looks like. Chip in $5 to keep the movement growing.",
  "headline": "People over PACs",
  "description": "100% grassroots funded"
}
\`\`\`

**Identity Example (framework: "IDENTITY", hook_strategy: "identity"):**
\`\`\`json
{
  "primary_text": "If you believe every kid deserves a great school — not just rich kids — this is your fight. Your $10 funds organizers in swing districts. Be the difference.",
  "headline": "Education is a right",
  "description": "Fund the fight"
}
\`\`\`

## POLITICAL FUNDRAISING PSYCHOLOGY (apply to ALL variations):

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

IDENTITY REINFORCEMENT:
- "Donors like you" / "Patriots who care"
- Shared values language
- In-group signaling

ENEMY FRAMING (always comparative — research shows pure attacks suppress progressive donations):
- Always pair the villain with the hero: "[Opponent] wants X. [Candidate] is fighting for Y."
- Contrast creates clarity: "They're cutting. We're investing."
- Never attack without offering the positive alternative
- The donor's contribution bridges the gap between villain's action and hero's solution

EMPOWERMENT:
- Specific dollar impact ("Your $27 = [specific outcome]")
- Donor as hero of the story
- Agency and control ("YOU decide")

## META BEST PRACTICES:
- Use emoji sparingly (1 max per primary_text) — overuse triggers spam filters
- Avoid ALL CAPS for more than 2 words — Meta quality score penalty
- No exclamation marks in headlines — reduces trust score
- Questions in hooks outperform statements by ~15% on CTR
- Numbers and dollar amounts stop the scroll ("$27", "47 million", "14 states")
- Authentic, passionate voice > polished marketing speak
- Copy that drives engagement (likes, shares) costs less to deliver`;

/**
 * Build the user message for ad copy generation.
 */
export function buildAdCopyUserMessage(params: {
  transcriptText: string;
  issuePrimary: string | null;
  politicalStances: string[] | null;
  tonePrimary: string | null;
  toneTags: string[] | null;
  targetsAttacked: string[] | null;
  targetsSupported: string[] | null;
  donorPainPoints: string[] | null;
  keyPhrases: string[] | null;
  ctaText: string | null;
  urgencyLevel: string | null;
  valuesAppealed: string[] | null;
  segmentName: string;
  segmentDescription: string;
  segmentTone: string;
}): string {
  return `## VIDEO ANALYSIS
Transcript: ${params.transcriptText || 'No transcript available'}
Primary Issue: ${params.issuePrimary || 'Not specified'}
Political Stances: ${(params.politicalStances || []).join(', ') || 'Not specified'}
Tone: ${params.tonePrimary || 'Not specified'} (${(params.toneTags || []).join(', ') || 'None'})
Targets Attacked: ${(params.targetsAttacked || []).join(', ') || 'None'}
Targets Supported: ${(params.targetsSupported || []).join(', ') || 'None'}
Donor Pain Points: ${(params.donorPainPoints || []).join(', ') || 'Not specified'}
Key Phrases: ${(params.keyPhrases || []).join(', ') || 'None'}
CTA from Video: ${params.ctaText || 'Not specified'}
Urgency Level: ${params.urgencyLevel || 'medium'}
Values Appealed: ${(params.valuesAppealed || []).join(', ') || 'Not specified'}

## TARGET AUDIENCE
Name: ${params.segmentName}
Description: ${params.segmentDescription}
Tone Guidance: ${params.segmentTone}

## INSTRUCTIONS
First, analyze the transcript in the "reasoning" field — identify the core conflict, strongest emotional lever, who the donor becomes, the villain, and what's at stake if the donor does nothing.

Then generate exactly 5 variations, one per framework:
1. PAS (Problem-Agitate-Solution)
2. BAB (Before-After-Bridge)
3. AIDA (Attention-Interest-Desire-Action)
4. Social Proof + Urgency
5. Identity + Empowerment

Each variation must follow the Hook-Bridge-CTA arc and respect all character limits.`;
}

/**
 * Tool definition for ad copy generation (structured output via tool calling).
 * Uses per-variation objects with framework metadata + a reasoning preamble.
 */
export const AD_COPY_GENERATION_TOOL = {
  type: "function" as const,
  function: {
    name: "generate_ad_copy",
    description: "Reason about the transcript, then generate 5 Meta ad copy variations using different copywriting frameworks",
    parameters: {
      type: "object",
      properties: {
        reasoning: {
          type: "object",
          description: "Chain-of-thought analysis of the transcript BEFORE writing copy",
          properties: {
            core_conflict: { type: "string", description: "The central conflict/threat from the transcript in one sentence" },
            emotional_lever: { type: "string", description: "The strongest emotional trigger for this audience" },
            donor_identity: { type: "string", description: "Who the donor becomes by giving (hero framing)" },
            villain: { type: "string", description: "The clear antagonist or opposing force" },
            stakes: { type: "string", description: "What happens if the donor does NOT act" },
          },
          required: ["core_conflict", "emotional_lever", "donor_identity", "villain", "stakes"],
        },
        variations: {
          type: "array",
          description: "Exactly 5 ad copy variations, one per framework",
          items: {
            type: "object",
            properties: {
              framework: {
                type: "string",
                enum: ["PAS", "BAB", "AIDA", "SOCIAL_PROOF", "IDENTITY"],
                description: "Which copywriting framework this variation uses",
              },
              hook_strategy: {
                type: "string",
                enum: ["pain", "stakes", "curiosity", "identity", "threat", "question"],
                description: "Which hook pattern was used",
              },
              primary_text: {
                type: "string",
                description: "Primary ad text (max 300 chars, hook in first 125)",
              },
              headline: {
                type: "string",
                description: "Headline text (max 27 chars)",
              },
              description: {
                type: "string",
                description: "Description text (max 25 chars)",
              },
            },
            required: ["framework", "hook_strategy", "primary_text", "headline", "description"],
          },
          minItems: 5,
          maxItems: 5,
        },
      },
      required: ["reasoning", "variations"],
      additionalProperties: false,
    },
  },
};

// =============================================================================
// SMS CAMPAIGN MESSAGE PROMPT
// =============================================================================

export const SMS_CAMPAIGN_SYSTEM_PROMPT = `You are an expert SMS political fundraising copywriter. You've written thousands of high-converting SMS campaigns raising millions in grassroots donations.

## HARD RULES:
1. Every message MUST be 160 characters or less (SMS limit)
2. Include a clear, specific call-to-action
3. Create urgency without being alarmist
4. Mention the specific entity/topic
5. Each variant tests a different approach

## ANTI-PATTERNS — NEVER write SMS like this:
- "Please donate to our campaign..." → Too passive, no hook
- "We need your help urgently..." → Vague urgency, no specifics
- "Dear friend, consider giving..." → Letter tone, not SMS tone

## GOOD SMS PATTERNS:
- "[Opponent] just [action]. Fight back now: [link]"
- "If [consequence from context], we lose everything. Chip in $X → [link]"
- "[Value] is on the line. Your $X makes the difference → [link]"`;

/**
 * Tool definition for SMS campaign message generation.
 */
export const SMS_CAMPAIGN_TOOL = {
  type: "function" as const,
  function: {
    name: "generate_sms_messages",
    description: "Generate SMS campaign message variants for political fundraising",
    parameters: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              message: { type: "string", description: "SMS text (max 160 chars)" },
              approach: { type: "string", enum: ["emotional", "factual", "urgent", "social_proof", "identity"] },
              predicted_performance: { type: "number", description: "1-100 predicted performance score" },
            },
            required: ["message", "approach", "predicted_performance"],
            additionalProperties: false,
          },
        },
      },
      required: ["messages"],
      additionalProperties: false,
    },
  },
};

// =============================================================================
// SMS CREATIVE ANALYSIS PROMPT
// =============================================================================

export const SMS_ANALYSIS_SYSTEM_PROMPT = `You are an expert political campaign analyst specializing in SMS message classification. Analyze SMS messages and return structured analysis. Be accurate and consistent in your categorizations.`;

/**
 * Tool definition for SMS creative analysis (classification).
 */
export const SMS_ANALYSIS_TOOL = {
  type: "function" as const,
  function: {
    name: "analyze_sms_creative",
    description: "Classify and analyze an SMS fundraising message",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Main topic (e.g. healthcare, immigration, voting rights, climate)" },
        tone: { type: "string", description: "Emotional tone (e.g. urgent, emotional, factual, grateful, angry, hopeful)" },
        sentiment_score: { type: "number", description: "From -1.0 (very negative) to 1.0 (very positive)" },
        urgency_level: { type: "string", enum: ["low", "medium", "high", "extreme"] },
        has_donation_ask: { type: "boolean" },
        donation_amount: { type: ["number", "null"], description: "Specific amount if mentioned" },
        call_to_action: { type: "string", description: "The CTA text or intent" },
        key_phrases: { type: "array", items: { type: "string" }, description: "2-3 most impactful phrases" },
      },
      required: ["topic", "tone", "sentiment_score", "urgency_level", "has_donation_ask", "donation_amount", "call_to_action", "key_phrases"],
      additionalProperties: false,
    },
  },
};
