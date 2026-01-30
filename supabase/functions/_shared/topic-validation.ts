/**
 * Topic Extraction Validation with Coherence Scoring
 *
 * Validates LLM-extracted topics for:
 * - Coherence: presence of expected fields
 * - Diversity: topic tags are not all duplicates
 * - Sanity: no suspiciously long values (hallucination indicators)
 *
 * Based on research:
 * - Topic coherence evaluates semantic interpretability (-1 to 1, higher = better)
 * - Diversity = proportion of unique words across topics (0-1)
 * - G-Eval uses chain-of-thought for LLM self-evaluation
 */

export interface TopicExtractionResult {
  issue_primary: string | null;
  issue_tags: string[] | null;
  political_stances: string[] | null;
  donor_pain_points: string[] | null;
  policy_positions?: string[] | null;
  targets_attacked?: string[] | null;
  targets_supported?: string[] | null;
  values_appealed?: string[] | null;
}

export interface ValidationResult {
  isValid: boolean;
  coherenceScore: number; // 0-1, measures presence of expected fields
  diversityScore: number; // 0-1, measures uniqueness of tags
  issues: string[];
}

/**
 * Validate topic extraction results for coherence and diversity
 *
 * @param result - The extracted topic data from LLM
 * @returns ValidationResult with scores and any issues found
 */
export function validateTopicExtraction(result: TopicExtractionResult): ValidationResult {
  const issues: string[] = [];

  // Check for empty/null primary issue
  if (!result.issue_primary || result.issue_primary.trim() === '') {
    issues.push('Missing primary issue');
  }

  // Check issue_tags diversity (not all duplicates of issue_primary)
  const tags = result.issue_tags || [];
  const uniqueTags = new Set(tags.filter(t => t !== result.issue_primary));
  const diversityScore = tags.length > 0 ? uniqueTags.size / tags.length : 0;

  if (diversityScore < 0.3 && tags.length > 1) {
    issues.push('Low tag diversity - possible extraction error');
  }

  // Check for suspiciously long values (LLM hallucination indicator)
  const allValues = [
    result.issue_primary,
    ...(result.issue_tags || []),
    ...(result.political_stances || []),
    ...(result.donor_pain_points || []),
    ...(result.policy_positions || []),
    ...(result.targets_attacked || []),
    ...(result.targets_supported || []),
    ...(result.values_appealed || []),
  ].filter(Boolean) as string[];

  const longValues = allValues.filter(v => v && v.length > 100);
  if (longValues.length > 0) {
    issues.push('Suspiciously long values detected');
  }

  // Check for generic/vague primary issue (hallucination indicator)
  const genericTerms = [
    'general', 'various', 'multiple', 'several', 'many',
    'N/A', 'n/a', 'none', 'unknown', 'unclear', 'not specified'
  ];

  if (result.issue_primary) {
    const isGeneric = genericTerms.some(term =>
      result.issue_primary!.toLowerCase().includes(term)
    );
    if (isGeneric) {
      issues.push('Primary issue too generic or vague');
    }
  }

  // Calculate coherence (presence of expected fields with content)
  // Expanded to check 6 key fields instead of just 3 for better coverage
  const expectedFields: (keyof TopicExtractionResult)[] = [
    'issue_primary',       // Core: what the ad is about
    'issue_tags',          // Tags for categorization
    'political_stances',   // Political positions taken
    'donor_pain_points',   // Psychology: what motivates donors
    'values_appealed',     // Psychology: values triggered
    'policy_positions'     // Specific policies advocated
  ];

  const presentFields = expectedFields.filter(fieldName => {
    const val = result[fieldName];
    if (!val) return false;
    return Array.isArray(val) ? val.length > 0 : val.trim() !== '';
  });

  const coherenceScore = presentFields.length / expectedFields.length;

  // Validation passes if:
  // 1. No critical issues found
  // 2. Coherence is at least 0.33 (at least 2 of 6 fields populated)
  const isValid = issues.length === 0 && coherenceScore >= 0.33;

  return {
    isValid,
    coherenceScore,
    diversityScore,
    issues
  };
}

/**
 * Calculate dynamic confidence from LLM self-rating
 *
 * @param confidenceRating - LLM's self-rating (1-5 scale)
 * @param defaultValue - Default if rating is missing (default: 3)
 * @returns Confidence score normalized to 0.2-1.0 range
 */
export function calculateDynamicConfidence(
  confidenceRating: number | undefined,
  defaultValue: number = 3
): number {
  // Use default if undefined, null, or 0 (falsy)
  const rawRating = confidenceRating || defaultValue;

  // Clamp to valid [1, 5] range to handle out-of-range LLM responses
  const rating = Math.min(5, Math.max(1, rawRating));

  // Log if input was out of range (for monitoring)
  if (confidenceRating !== undefined && (confidenceRating < 1 || confidenceRating > 5)) {
    console.warn(`[topic-validation] Out-of-range confidence_rating: ${confidenceRating}, clamped to ${rating}`);
  }

  // Normalize 1-5 scale to 0.2-1.0 range
  return rating / 5;
}

/**
 * Combine confidence and coherence for final analysis confidence
 *
 * Uses weighted average instead of multiplication to prevent
 * one weak signal from killing the entire score.
 *
 * @param llmConfidence - LLM self-reported confidence (0-1)
 * @param coherenceScore - Validation coherence score (0-1)
 * @returns Combined confidence score (0-1)
 */
export function combineConfidenceScores(
  llmConfidence: number,
  coherenceScore: number
): number {
  // Weighted combination: LLM rating (60%) + coherence validation (40%)
  // This prevents aggressive penalty when one component is weak
  // E.g., LLM 0.8 + coherence 0.5 = 0.6*0.8 + 0.4*0.5 = 0.48 + 0.2 = 0.68
  // vs multiplicative: 0.8 * 0.5 = 0.4 (too harsh)
  return 0.6 * llmConfidence + 0.4 * coherenceScore;
}
