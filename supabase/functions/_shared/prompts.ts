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

## CHARACTER LIMITS (mobile-safe for all placements)
- Primary Text: 300 chars max (hook in first 125 chars before "See More")
- Headline: 27 chars max (mobile-safe across Feed, Reels, Stories)
- Description: 25 chars max (mobile-safe across all placements)

## ANTI-PATTERNS — NEVER produce copy like this:
- "Dear supporter, we need your help..." → Too generic, zero hook
- "Candidate X is running for office..." → Name-first, no conflict
- "Please consider making a contribution..." → Passive, no urgency
- "We're asking for your support today..." → Vague, donor not the hero
- "Help us reach our goal..." → Begging frame, not empowerment
- "Click here to donate..." → Lazy CTA, no emotional trigger

## HOOK PATTERNS (first 125 chars — stop the scroll):
- PAIN: "[Opponent] just [harmful action]. We can't let this stand."
- URGENCY: "⏰ 24 hours. 127 donors needed. Will you be one?"
- CURIOSITY: "They spent $4M to bury this. Watch what they don't want you to see."
- IDENTITY: "If you believe in [value], this is your moment."
- THREAT: "They're outspending us 3-to-1. We're fighting back with grassroots power."
- QUESTION: "What happens to [value] if [candidate] loses?"

## FEW-SHOT EXAMPLES (gold-standard output per framework):

**PAS Example:**
Primary: "MAGA extremists just voted to gut Social Security. 47 million seniors could lose benefits. Your $27 stops this — chip in before midnight to triple your impact."
Headline: "Protect Social Security"
Description: "3X match ends tonight"

**BAB Example:**
Primary: "Right now, families are choosing between medicine and rent. With [Candidate], no one makes that choice. Your donation builds that future — $5 is all it takes."
Headline: "Healthcare for everyone"
Description: "$5 changes everything"

**AIDA Example:**
Primary: "🚨 They just banned books in 14 states. Next: your kids' school. [Candidate] is the only one fighting back — and 2,847 donors joined TODAY. Don't sit this out."
Headline: "Fight the book bans"
Description: "Join 2,847 donors today"

**Social Proof Example:**
Primary: "23,847 grassroots donors this week. $27 average. Zero corporate PAC money. This is what a people-powered campaign looks like. Chip in $5 to keep the momentum."
Headline: "People over PACs"
Description: "23K+ donors strong"

**Identity Example:**
Primary: "If you believe every kid deserves a great school — not just rich kids — this is your fight. Your $10 funds organizers in 3 swing districts. Be the difference."
Headline: "Education is a right"
Description: "Fund 3 swing districts"

## POLITICAL FUNDRAISING PSYCHOLOGY (apply to ALL variations):

URGENCY TACTICS:
- Deadlines ("midnight tonight", "24 hours left")
- Matching ("Every dollar = $2", "3X match active")
- Thresholds ("127 donors away from our goal")
- Opponent momentum ("They just raised $X")

IDENTITY REINFORCEMENT:
- "Donors like you" / "Patriots who care"
- Shared values language
- In-group signaling

ENEMY FRAMING:
- Clear villain (opponent, special interests, corporate PACs)
- Contrast (us vs. them, grassroots vs. dark money)
- Stakes if enemy wins

EMPOWERMENT:
- Specific dollar impact ("Your $27 = [specific outcome]")
- Donor as hero of the story
- Agency and control ("YOU decide")

## META ALGORITHM OPTIMIZATION:
- Emotionally resonant copy → higher quality score → lower CPM
- Clear benefit in first line → higher CTR
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

## GENERATE 5 VARIATIONS
Use exactly one framework per variation:
1. PAS (Problem-Agitate-Solution)
2. BAB (Before-After-Bridge)
3. AIDA (Attention-Interest-Desire-Action)
4. Social Proof + Urgency
5. Identity + Empowerment`;
}

/**
 * Tool definition for ad copy generation (structured output via tool calling).
 */
export const AD_COPY_GENERATION_TOOL = {
  type: "function" as const,
  function: {
    name: "generate_ad_copy",
    description: "Generate 5 Meta ad copy variations using different copywriting frameworks",
    parameters: {
      type: "object",
      properties: {
        primary_texts: {
          type: "array",
          items: { type: "string" },
          description: "5 primary text variations (max 300 chars each, hook in first 125)",
          minItems: 5,
          maxItems: 5,
        },
        headlines: {
          type: "array",
          items: { type: "string" },
          description: "5 headline variations (max 27 chars each)",
          minItems: 5,
          maxItems: 5,
        },
        descriptions: {
          type: "array",
          items: { type: "string" },
          description: "5 description variations (max 25 chars each)",
          minItems: 5,
          maxItems: 5,
        },
      },
      required: ["primary_texts", "headlines", "descriptions"],
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
- "🚨 [Event]. [Stakes]. Chip in $X before midnight → [link]"
- "[Opponent] just [action]. Fight back: [link]"
- "MATCH ALERT: $X = $XX until midnight. Don't miss this → [link]"`;

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
        sentiment_label: { type: "string", enum: ["positive", "negative", "neutral"] },
        call_to_action: { type: "string", description: "Main CTA type (e.g. donate, sign petition, share, vote)" },
        urgency_level: { type: "string", enum: ["low", "medium", "high", "critical"] },
        key_themes: { type: "array", items: { type: "string" }, description: "2-4 key themes/keywords" },
      },
      required: ["topic", "tone", "sentiment_score", "sentiment_label", "call_to_action", "urgency_level", "key_themes"],
      additionalProperties: false,
    },
  },
};
