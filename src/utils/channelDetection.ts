/**
 * Unified Channel Detection Utility
 *
 * This is the SINGLE SOURCE OF TRUTH for detecting donation channels on the frontend.
 * It mirrors the logic in the SQL function `public.attribute_transaction`.
 *
 * Attribution Waterfall (4 Tiers):
 *
 * TIER 1 - Deterministic (100% confidence):
 *   - Click ID (click_id, fbclid) present
 *   - Explicit attribution_method from donation_attribution
 *   - Meta campaign/ad IDs present
 *
 * TIER 2 - High Probability (85-95% confidence):
 *   - Pattern rules: jp*, th*, meta_*, fb_*, ig_* → Meta
 *   - Pattern rules: txt*, sms* → SMS
 *   - Pattern rules: em*, email* → Email
 *   - Source campaign contains platform name
 *
 * TIER 3 - Medium Probability (60-80% confidence):
 *   - Contribution form contains platform hint (e.g., "sms")
 *   - Has refcode but no explicit platform match
 *
 * TIER 4 - Low/None:
 *   - No attribution signals = "unattributed"
 */

export type AttributionChannel = 'meta' | 'sms' | 'email' | 'other' | 'unattributed';

/**
 * Confidence levels for attribution - mirrors SQL enum attribution_confidence_level
 */
export type ConfidenceLevel = 'deterministic' | 'high' | 'medium' | 'low' | 'none';

/**
 * Attribution result with confidence scoring
 */
export interface AttributionResult {
  channel: AttributionChannel;
  confidenceScore: number;       // 0.00 - 1.00
  confidenceLevel: ConfidenceLevel;
  attributionMethod: string;     // How the attribution was determined
  attributionTier: 1 | 2 | 3 | 4 | 0;  // 0 = unattributed
}

export interface ChannelDetectionInput {
  contribution_form?: string | null;
  refcode?: string | null;
  source_campaign?: string | null;
  click_id?: string | null;
  fbclid?: string | null;
  attributed_campaign_id?: string | null;
  attributed_ad_id?: string | null;
  attributed_creative_id?: string | null;
  attribution_method?: string | null;
}

/**
 * Pattern rules for Tier 2 attribution (High Probability)
 * These mirror the default rules in the attribution_rules database table.
 * GLOBAL RULES - Apply to ALL organizations
 */
const PATTERN_RULES: Array<{
  patterns: string[];
  type: 'prefix' | 'regex';
  channel: AttributionChannel;
  confidence: number;
}> = [
  // Meta patterns (90% confidence)
  { patterns: ['jp'], type: 'prefix', channel: 'meta', confidence: 0.90 },
  { patterns: ['th'], type: 'prefix', channel: 'meta', confidence: 0.90 },
  { patterns: ['meta_'], type: 'prefix', channel: 'meta', confidence: 0.90 },
  { patterns: ['fb_'], type: 'prefix', channel: 'meta', confidence: 0.90 },
  { patterns: ['ig_'], type: 'prefix', channel: 'meta', confidence: 0.90 },
  { patterns: ['facebook_'], type: 'prefix', channel: 'meta', confidence: 0.90 },
  { patterns: ['instagram_'], type: 'prefix', channel: 'meta', confidence: 0.90 },

  // SMS patterns (90% confidence)
  { patterns: ['txt'], type: 'prefix', channel: 'sms', confidence: 0.90 },
  { patterns: ['sms'], type: 'prefix', channel: 'sms', confidence: 0.90 },
  { patterns: ['text_'], type: 'prefix', channel: 'sms', confidence: 0.90 },

  // Email patterns (90% confidence)
  { patterns: ['em'], type: 'prefix', channel: 'email', confidence: 0.90 },
  { patterns: ['email'], type: 'prefix', channel: 'email', confidence: 0.90 },
  { patterns: ['mail_'], type: 'prefix', channel: 'email', confidence: 0.90 },
  { patterns: ['newsletter'], type: 'prefix', channel: 'email', confidence: 0.90 },
];

/**
 * Detects the attribution channel with confidence scoring.
 * Implements the 4-tier Attribution Waterfall.
 * This function mirrors the SQL function `public.attribute_transaction`.
 */
export function detectChannelWithConfidence(input: ChannelDetectionInput): AttributionResult {
  const {
    contribution_form,
    refcode,
    source_campaign,
    click_id,
    fbclid,
    attributed_campaign_id,
    attributed_ad_id,
    attributed_creative_id,
    attribution_method,
  } = input;

  // ============================================================================
  // TIER 1: DETERMINISTIC (100% confidence)
  // ============================================================================

  // 1a. Click ID (click_id, fbclid) - highest confidence
  if (click_id || fbclid) {
    return {
      channel: 'meta',
      confidenceScore: 1.0,
      confidenceLevel: 'deterministic',
      attributionMethod: 'click_id',
      attributionTier: 1,
    };
  }

  // 1b. Explicit attribution_method from donation_attribution view
  if (attribution_method) {
    const method = attribution_method.toLowerCase();
    if (method.includes('sms') || method === 'sms_last_touch') {
      return {
        channel: 'sms',
        confidenceScore: 1.0,
        confidenceLevel: 'deterministic',
        attributionMethod: 'attribution_method_sms',
        attributionTier: 1,
      };
    }
    if (method.includes('meta') || method.includes('facebook') || method === 'refcode_meta') {
      return {
        channel: 'meta',
        confidenceScore: 1.0,
        confidenceLevel: 'deterministic',
        attributionMethod: 'attribution_method_meta',
        attributionTier: 1,
      };
    }
    if (method.includes('email')) {
      return {
        channel: 'email',
        confidenceScore: 1.0,
        confidenceLevel: 'deterministic',
        attributionMethod: 'attribution_method_email',
        attributionTier: 1,
      };
    }
  }

  // 1c. Meta campaign/ad/creative IDs present
  if (attributed_campaign_id || attributed_ad_id || attributed_creative_id) {
    return {
      channel: 'meta',
      confidenceScore: 1.0,
      confidenceLevel: 'deterministic',
      attributionMethod: 'meta_ids_present',
      attributionTier: 1,
    };
  }

  // ============================================================================
  // TIER 2: HIGH PROBABILITY (85-95% confidence)
  // Pattern-based attribution rules (GLOBAL - applies to all organizations)
  // ============================================================================

  // 2a. Source campaign contains platform name
  if (source_campaign) {
    const campaign = source_campaign.toLowerCase();
    if (campaign.includes('meta') || campaign.includes('facebook') || campaign.includes('instagram')) {
      return {
        channel: 'meta',
        confidenceScore: 0.90,
        confidenceLevel: 'high',
        attributionMethod: 'source_campaign_meta',
        attributionTier: 2,
      };
    }
    if (campaign.includes('sms') || campaign.includes('text')) {
      return {
        channel: 'sms',
        confidenceScore: 0.90,
        confidenceLevel: 'high',
        attributionMethod: 'source_campaign_sms',
        attributionTier: 2,
      };
    }
    if (campaign.includes('email')) {
      return {
        channel: 'email',
        confidenceScore: 0.90,
        confidenceLevel: 'high',
        attributionMethod: 'source_campaign_email',
        attributionTier: 2,
      };
    }
  }

  // 2b. Refcode pattern matching (jp*, th*, meta_*, fb_*, txt*, sms*, em*, email*)
  if (refcode) {
    const code = refcode.toLowerCase();

    for (const rule of PATTERN_RULES) {
      for (const pattern of rule.patterns) {
        if (rule.type === 'prefix' && code.startsWith(pattern)) {
          return {
            channel: rule.channel,
            confidenceScore: rule.confidence,
            confidenceLevel: 'high',
            attributionMethod: `pattern_prefix_${pattern}`,
            attributionTier: 2,
          };
        }
      }
    }
  }

  // ============================================================================
  // TIER 3: MEDIUM PROBABILITY (60-80% confidence)
  // ============================================================================

  // 3a. Contribution form contains platform hint (e.g., "mltcosms", "smithsms")
  if (contribution_form) {
    const form = contribution_form.toLowerCase();
    if (form.includes('sms')) {
      return {
        channel: 'sms',
        confidenceScore: 0.70,
        confidenceLevel: 'medium',
        attributionMethod: 'contribution_form_sms',
        attributionTier: 3,
      };
    }
    if (form.includes('email') || form.includes('em_')) {
      return {
        channel: 'email',
        confidenceScore: 0.70,
        confidenceLevel: 'medium',
        attributionMethod: 'contribution_form_email',
        attributionTier: 3,
      };
    }
  }

  // 3b. Has refcode but no platform match - "other" attributed
  if (refcode && refcode.trim() !== '') {
    return {
      channel: 'other',
      confidenceScore: 0.50,
      confidenceLevel: 'medium',
      attributionMethod: 'refcode_unknown_pattern',
      attributionTier: 3,
    };
  }

  // ============================================================================
  // TIER 4: NO MATCH - Unattributed (0% confidence)
  // ============================================================================
  return {
    channel: 'unattributed',
    confidenceScore: 0,
    confidenceLevel: 'none',
    attributionMethod: 'no_attribution_signals',
    attributionTier: 0,
  };
}

/**
 * Legacy function for backward compatibility.
 * Detects the attribution channel for a donation transaction.
 * For new code, prefer `detectChannelWithConfidence()` to get confidence scoring.
 */
export function detectChannel(input: ChannelDetectionInput): AttributionChannel {
  return detectChannelWithConfidence(input).channel;
}

/**
 * Aggregates transactions by channel
 */
export function aggregateByChannel<T extends ChannelDetectionInput>(
  transactions: T[]
): Record<AttributionChannel, T[]> {
  const result: Record<AttributionChannel, T[]> = {
    meta: [],
    sms: [],
    email: [],
    other: [],
    unattributed: [],
  };

  for (const txn of transactions) {
    const channel = detectChannel(txn);
    result[channel].push(txn);
  }

  return result;
}

/**
 * Counts transactions by channel
 */
export function countByChannel<T extends ChannelDetectionInput>(
  transactions: T[]
): Record<AttributionChannel, number> {
  const groups = aggregateByChannel(transactions);
  return {
    meta: groups.meta.length,
    sms: groups.sms.length,
    email: groups.email.length,
    other: groups.other.length,
    unattributed: groups.unattributed.length,
  };
}

/**
 * Returns human-readable channel label
 */
export function getChannelLabel(channel: AttributionChannel): string {
  const labels: Record<AttributionChannel, string> = {
    meta: 'Meta Ads',
    sms: 'SMS',
    email: 'Email',
    other: 'Other',
    unattributed: 'Unattributed',
  };
  return labels[channel];
}

/**
 * Returns channel color for charts
 */
export function getChannelColor(channel: AttributionChannel): string {
  const colors: Record<AttributionChannel, string> = {
    meta: 'hsl(var(--chart-1))',
    sms: 'hsl(var(--chart-2))',
    email: 'hsl(var(--chart-3))',
    other: 'hsl(var(--chart-4))',
    unattributed: 'hsl(var(--muted))',
  };
  return colors[channel];
}

/**
 * Returns human-readable confidence level label
 */
export function getConfidenceLabel(level: ConfidenceLevel): string {
  const labels: Record<ConfidenceLevel, string> = {
    deterministic: 'Deterministic (100%)',
    high: 'High Confidence (85-95%)',
    medium: 'Medium Confidence (60-80%)',
    low: 'Low Confidence (40%)',
    none: 'Unattributed',
  };
  return labels[level];
}

/**
 * Returns confidence level color for UI indicators
 */
export function getConfidenceColor(level: ConfidenceLevel): string {
  const colors: Record<ConfidenceLevel, string> = {
    deterministic: 'hsl(var(--success))',      // Green
    high: 'hsl(var(--chart-1))',               // Blue
    medium: 'hsl(var(--warning))',             // Yellow/Orange
    low: 'hsl(var(--destructive))',            // Red
    none: 'hsl(var(--muted))',                 // Gray
  };
  return colors[level];
}

/**
 * Aggregates transactions by channel WITH confidence scoring
 */
export function aggregateByChannelWithConfidence<T extends ChannelDetectionInput>(
  transactions: T[]
): Record<AttributionChannel, Array<T & { attribution: AttributionResult }>> {
  const result: Record<AttributionChannel, Array<T & { attribution: AttributionResult }>> = {
    meta: [],
    sms: [],
    email: [],
    other: [],
    unattributed: [],
  };

  for (const txn of transactions) {
    const attribution = detectChannelWithConfidence(txn);
    result[attribution.channel].push({ ...txn, attribution });
  }

  return result;
}

/**
 * Counts transactions by confidence level
 */
export function countByConfidenceLevel<T extends ChannelDetectionInput>(
  transactions: T[]
): Record<ConfidenceLevel, number> {
  const result: Record<ConfidenceLevel, number> = {
    deterministic: 0,
    high: 0,
    medium: 0,
    low: 0,
    none: 0,
  };

  for (const txn of transactions) {
    const { confidenceLevel } = detectChannelWithConfidence(txn);
    result[confidenceLevel]++;
  }

  return result;
}

/**
 * Returns attribution quality summary for a set of transactions
 */
export function getAttributionQualitySummary<T extends ChannelDetectionInput>(
  transactions: T[]
): {
  total: number;
  byConfidence: Record<ConfidenceLevel, { count: number; percentage: number }>;
  byChannel: Record<AttributionChannel, { count: number; percentage: number }>;
  averageConfidenceScore: number;
  deterministicRate: number;
} {
  const total = transactions.length;
  if (total === 0) {
    return {
      total: 0,
      byConfidence: {
        deterministic: { count: 0, percentage: 0 },
        high: { count: 0, percentage: 0 },
        medium: { count: 0, percentage: 0 },
        low: { count: 0, percentage: 0 },
        none: { count: 0, percentage: 0 },
      },
      byChannel: {
        meta: { count: 0, percentage: 0 },
        sms: { count: 0, percentage: 0 },
        email: { count: 0, percentage: 0 },
        other: { count: 0, percentage: 0 },
        unattributed: { count: 0, percentage: 0 },
      },
      averageConfidenceScore: 0,
      deterministicRate: 0,
    };
  }

  const confidenceCounts = countByConfidenceLevel(transactions);
  const channelCounts = countByChannel(transactions);

  let totalConfidenceScore = 0;
  for (const txn of transactions) {
    totalConfidenceScore += detectChannelWithConfidence(txn).confidenceScore;
  }

  const pct = (count: number) => Math.round((count / total) * 100 * 100) / 100;

  return {
    total,
    byConfidence: {
      deterministic: { count: confidenceCounts.deterministic, percentage: pct(confidenceCounts.deterministic) },
      high: { count: confidenceCounts.high, percentage: pct(confidenceCounts.high) },
      medium: { count: confidenceCounts.medium, percentage: pct(confidenceCounts.medium) },
      low: { count: confidenceCounts.low, percentage: pct(confidenceCounts.low) },
      none: { count: confidenceCounts.none, percentage: pct(confidenceCounts.none) },
    },
    byChannel: {
      meta: { count: channelCounts.meta, percentage: pct(channelCounts.meta) },
      sms: { count: channelCounts.sms, percentage: pct(channelCounts.sms) },
      email: { count: channelCounts.email, percentage: pct(channelCounts.email) },
      other: { count: channelCounts.other, percentage: pct(channelCounts.other) },
      unattributed: { count: channelCounts.unattributed, percentage: pct(channelCounts.unattributed) },
    },
    averageConfidenceScore: Math.round((totalConfidenceScore / total) * 100) / 100,
    deterministicRate: pct(confidenceCounts.deterministic),
  };
}
