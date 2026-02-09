/**
 * Whisper Hallucination Detection
 * 
 * Detects hallucinated transcripts by checking:
 * 1. Average no_speech_prob across segments
 * 2. Unexpected detected language
 */

const EXPECTED_LANGUAGES = new Set([
  'english', 'spanish', 'arabic', 'french', 'urdu', 'hindi', 'chinese',
  'korean', 'japanese', 'german', 'portuguese', 'italian', 'russian',
  'turkish', 'persian', 'tagalog', 'vietnamese', 'polish', 'ukrainian',
  'dutch', 'indonesian', 'malay', 'thai', 'bengali', 'swahili', 'hausa',
  'amharic', 'somali', 'hebrew',
]);

export interface HallucinationCheckResult {
  hallucinationRisk: number;
  shouldRetry: boolean;
  reason: string | null;
}

export function detectHallucination(
  segments: Array<{ no_speech_prob?: number }>,
  language: string,
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

  if (avgNoSpeechProb > 0.6) {
    hallucinationRisk = 0.9;
    reasons.push(`high no_speech_prob (${avgNoSpeechProb.toFixed(2)})`);
  } else if (avgNoSpeechProb > 0.4) {
    hallucinationRisk = 0.6;
    reasons.push(`elevated no_speech_prob (${avgNoSpeechProb.toFixed(2)})`);
  }

  if (unexpectedLanguage) {
    hallucinationRisk = Math.max(hallucinationRisk, 0.8);
    reasons.push(`unexpected language "${language}"`);
  }

  return {
    hallucinationRisk,
    shouldRetry: hallucinationRisk > 0.5,
    reason: reasons.length > 0 ? reasons.join('; ') : null,
  };
}

/**
 * Compute transcription confidence based on hallucination risk.
 * Returns a value between 0.2 and 0.95.
 */
export function computeConfidence(hallucinationRisk: number): number {
  if (hallucinationRisk >= 0.8) return 0.2;
  if (hallucinationRisk >= 0.5) return 0.4;
  return 0.95;
}
