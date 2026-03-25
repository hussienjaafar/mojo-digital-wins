/**
 * Whisper Hallucination Detection
 * 
 * Detects hallucinated transcripts by checking:
 * 1. Average no_speech_prob across segments
 * 2. Unexpected detected language
 * 3. Repetitive looping text (common Whisper failure mode)
 */

const EXPECTED_LANGUAGES = new Set([
  'english', 'spanish', 'arabic', 'french', 'urdu', 'hindi', 'chinese',
  'korean', 'japanese', 'german', 'portuguese', 'italian', 'russian',
  'turkish', 'persian', 'tagalog', 'vietnamese', 'polish', 'ukrainian',
  'dutch', 'indonesian', 'malay', 'thai', 'bengali', 'swahili', 'hausa',
  'amharic', 'somali', 'hebrew',
]);

export interface RepetitionResult {
  repetitionRatio: number;
  hasRepetition: boolean;
}

export interface HallucinationCheckResult {
  hallucinationRisk: number;
  shouldRetry: boolean;
  reason: string | null;
  repetitionDetected: boolean;
}

/**
 * Detect repetitive looping text — a common Whisper hallucination pattern.
 * Splits text into sentences, normalizes them, and checks how much content is repeated.
 */
export function detectRepetition(text: string | undefined | null): RepetitionResult {
  if (!text || text.trim().length === 0) {
    return { repetitionRatio: 0, hasRepetition: false };
  }

  // Split into sentences by common delimiters
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter(s => s.split(' ').length > 5); // only substantial sentences

  if (sentences.length < 2) {
    return { repetitionRatio: 0, hasRepetition: false };
  }

  const seen = new Map<string, number>();
  for (const sentence of sentences) {
    seen.set(sentence, (seen.get(sentence) || 0) + 1);
  }

  let repeatedWordCount = 0;
  let totalWordCount = 0;
  for (const [sentence, count] of seen.entries()) {
    const wordCount = sentence.split(' ').length;
    totalWordCount += wordCount * count;
    if (count > 1) {
      repeatedWordCount += wordCount * (count - 1);
    }
  }

  const repetitionRatio = totalWordCount > 0 ? repeatedWordCount / totalWordCount : 0;
  return { repetitionRatio, hasRepetition: repetitionRatio > 0.3 };
}

export function detectHallucination(
  segments: Array<{ no_speech_prob?: number }>,
  language: string,
  text?: string,
): HallucinationCheckResult {
  // Calculate average no_speech_prob
  const probs = segments
    .map(s => s.no_speech_prob ?? 0)
    .filter(p => typeof p === 'number');
  const avgNoSpeechProb = probs.length > 0
    ? probs.reduce((a, b) => a + b, 0) / probs.length
    : 0;

  const unexpectedLanguage = !EXPECTED_LANGUAGES.has(language?.toLowerCase());

  let hallucinationRisk = 0;
  const reasons: string[] = [];

  // Lowered thresholds: 0.5 -> high risk, 0.3 -> elevated risk
  if (avgNoSpeechProb > 0.5) {
    hallucinationRisk = 0.9;
    reasons.push(`high no_speech_prob (${avgNoSpeechProb.toFixed(2)})`);
  } else if (avgNoSpeechProb > 0.3) {
    hallucinationRisk = 0.6;
    reasons.push(`elevated no_speech_prob (${avgNoSpeechProb.toFixed(2)})`);
  }

  if (unexpectedLanguage) {
    hallucinationRisk = Math.max(hallucinationRisk, 0.8);
    reasons.push(`unexpected language "${language}"`);
  }

  // Repetition detection
  const repetition = detectRepetition(text);
  if (repetition.hasRepetition) {
    hallucinationRisk = Math.max(hallucinationRisk, 0.85);
    reasons.push(`repetitive text detected (${(repetition.repetitionRatio * 100).toFixed(0)}% repeated)`);
  }

  return {
    hallucinationRisk,
    shouldRetry: hallucinationRisk > 0.5,
    reason: reasons.length > 0 ? reasons.join('; ') : null,
    repetitionDetected: repetition.hasRepetition,
  };
}

/**
 * Compute transcription confidence based on hallucination risk.
 * Returns a value between 0.2 and 0.95.
 */
export function computeConfidence(hallucinationRisk: number): number {
  if (hallucinationRisk >= 0.8) return 0.2;
  if (hallucinationRisk >= 0.5) return 0.3;
  if (hallucinationRisk >= 0.3) return 0.5;
  return 0.95;
}

/**
 * LLM-based semantic coherence check using Lovable AI Gateway.
 * Checks if a transcript sounds like a real political ad vs. Whisper gibberish.
 * Only call this when no_speech_prob is borderline (0.2-0.5).
 */
export async function checkSemanticCoherence(text: string): Promise<{
  isCoherent: boolean;
  confidence: number;
}> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) {
    console.warn('[HALLUCINATION] LOVABLE_API_KEY not set, skipping semantic check');
    return { isCoherent: true, confidence: 0 };
  }

  // Only check substantial text
  if (!text || text.trim().split(/\s+/).length < 20) {
    return { isCoherent: true, confidence: 0 };
  }

  try {
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: 'You evaluate if a transcript is real or hallucinated by an AI speech-to-text model (Whisper). A real transcript from a political ad discusses policy, candidates, donations, elections, community issues, or advocacy. A hallucinated transcript contains random, incoherent, repetitive, or completely unrelated content that sounds like gibberish even if grammatically correct. Reply with ONLY the word "real" or "hallucinated".',
          },
          {
            role: 'user',
            content: `Is this a real political ad transcript or hallucinated gibberish?\n\n"${text.substring(0, 1500)}"`,
          },
        ],
        temperature: 0,
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      console.warn(`[HALLUCINATION] Semantic check failed: ${response.status}`);
      return { isCoherent: true, confidence: 0 };
    }

    const data = await response.json();
    const answer = (data.choices?.[0]?.message?.content || '').trim().toLowerCase();
    console.log(`[HALLUCINATION] Semantic check result: "${answer}"`);

    const isCoherent = !answer.includes('hallucinated');
    return { isCoherent, confidence: answer.includes('hallucinated') || answer.includes('real') ? 0.85 : 0.5 };
  } catch (err) {
    console.warn('[HALLUCINATION] Semantic check error:', err);
    return { isCoherent: true, confidence: 0 };
  }
}
