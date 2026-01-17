/**
 * Unified Channel Detection Utility
 * 
 * This is the SINGLE SOURCE OF TRUTH for detecting donation channels on the frontend.
 * It mirrors the logic in the SQL function `public.detect_donation_channel`.
 * 
 * Priority order:
 * 1. Explicit attribution_method from donation_attribution
 * 2. Meta campaign/ad IDs present
 * 3. Meta click identifiers (click_id, fbclid)
 * 4. Source campaign indicates Meta
 * 5. Contribution form contains "sms"
 * 6. Refcode patterns (txt*, sms*, em*, email*)
 * 7. Has refcode but no platform match = "other"
 * 8. No attribution signals = "unattributed"
 */

export type AttributionChannel = 'meta' | 'sms' | 'email' | 'other' | 'unattributed';

export interface ChannelDetectionInput {
  contribution_form?: string | null;
  refcode?: string | null;
  source_campaign?: string | null;
  click_id?: string | null;
  fbclid?: string | null;
  attributed_campaign_id?: string | null;
  attributed_ad_id?: string | null;
  attribution_method?: string | null;
}

/**
 * Detects the attribution channel for a donation transaction.
 * This function mirrors the SQL function `public.detect_donation_channel`.
 */
export function detectChannel(input: ChannelDetectionInput): AttributionChannel {
  const {
    contribution_form,
    refcode,
    source_campaign,
    click_id,
    fbclid,
    attributed_campaign_id,
    attributed_ad_id,
    attribution_method,
  } = input;

  // Priority 1: Explicit attribution from donation_attribution
  if (attribution_method) {
    const method = attribution_method.toLowerCase();
    if (method.includes('sms')) return 'sms';
    if (method.includes('meta') || method.includes('facebook')) return 'meta';
    if (method.includes('email')) return 'email';
  }

  // Priority 2: Meta campaign/ad IDs present
  if (attributed_campaign_id || attributed_ad_id) {
    return 'meta';
  }

  // Priority 3: Meta click identifiers
  if (click_id || fbclid) {
    return 'meta';
  }

  // Priority 4: Source campaign indicates Meta
  if (source_campaign && source_campaign.toLowerCase().includes('meta')) {
    return 'meta';
  }

  // Priority 5: Contribution form indicates SMS (e.g., "mltcosms", "smithsms")
  if (contribution_form && contribution_form.toLowerCase().includes('sms')) {
    return 'sms';
  }

  // Priority 6: Refcode patterns
  if (refcode) {
    const code = refcode.toLowerCase();
    // SMS refcode patterns
    if (code.startsWith('txt') || code.startsWith('sms')) {
      return 'sms';
    }
    // Email refcode patterns
    if (code.startsWith('em') || code.startsWith('email')) {
      return 'email';
    }
    // Has a refcode but no platform match = other attributed
    return 'other';
  }

  // No attribution signals at all
  return 'unattributed';
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
