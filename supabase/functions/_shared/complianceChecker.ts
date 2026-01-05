/**
 * SMS Compliance Checker for Suggested Actions
 * 
 * Validates SMS messages against TCPA/carrier compliance requirements:
 * - Sender identification
 * - Opt-out language (STOP)
 * - Character limits
 * - Prohibited content detection
 */

// ============================================================================
// Types
// ============================================================================

export interface ComplianceCheckResult {
  status: 'pass' | 'review' | 'blocked';
  checks: {
    has_sender_id: boolean;
    has_stop_language: boolean;
    within_char_limit: boolean;
    stop_keywords_present: string[];
    sensitive_claims_detected: string[];
    risk_flags: string[];
    character_count: number;
    character_limit: number;
  };
  issues: string[];
  warnings: string[];
}

export interface ComplianceOptions {
  orgName?: string;
  maxCharacters?: number;
  includeOptOutInLimit?: boolean;
  strictMode?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_SMS_LENGTH = 160;
const OPT_OUT_TEXT = 'Reply STOP to opt out.';
const OPT_OUT_LENGTH = OPT_OUT_TEXT.length + 1; // +1 for space

// Required opt-out keywords (at least one must be mentioned)
const STOP_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];

// Patterns that suggest unverified claims
const CLAIM_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\b(guarantee|guaranteed|100%|certain|definitely)\b/i, description: 'Absolute guarantee claim' },
  { pattern: /\b(proven|scientifically|studies show|research proves)\b/i, description: 'Unverified scientific claim' },
  { pattern: /\b(breaking|exclusive|just in|urgent|emergency)\b/i, description: 'Urgency/breaking news claim' },
  { pattern: /\b(save lives?|stop .+ now|last chance|final)\b/i, description: 'High-pressure language' },
  { pattern: /\b(donate now or|if you don't|without your help)\b/i, description: 'Guilt/pressure tactics' },
];

// Sensitive topics that may require review
const SENSITIVE_TOPICS: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['abortion', 'pro-life', 'pro-choice', 'roe'], category: 'Reproductive rights' },
  { keywords: ['gun', 'firearms', 'second amendment', '2a', 'nra'], category: 'Gun policy' },
  { keywords: ['lgbtq', 'transgender', 'gay rights', 'same-sex'], category: 'LGBTQ+ issues' },
  { keywords: ['immigration', 'border', 'migrant', 'deportation', 'asylum'], category: 'Immigration' },
  { keywords: ['race', 'racism', 'racist', 'white supremacy', 'blm'], category: 'Race relations' },
  { keywords: ['death', 'killed', 'died', 'murder', 'violence'], category: 'Violence/death' },
  { keywords: ['fraud', 'corrupt', 'scandal', 'lawsuit', 'indictment'], category: 'Legal/scandal' },
];

// Prohibited content that should block the message
const PROHIBITED_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\b(f+u+c+k|s+h+i+t|a+s+s+h+o+l+e|b+i+t+c+h)\b/i, description: 'Profanity detected' },
  { pattern: /\b(kill|attack|destroy|eliminate)\s+(them|him|her|people)\b/i, description: 'Violent language' },
  { pattern: /\b(hate|despise)\s+(them|those people|immigrants|gays)\b/i, description: 'Hate speech' },
];

// ============================================================================
// Main Compliance Check Function
// ============================================================================

export function runComplianceChecks(
  message: string,
  options: ComplianceOptions = {}
): ComplianceCheckResult {
  const {
    orgName,
    maxCharacters = DEFAULT_MAX_SMS_LENGTH,
    includeOptOutInLimit = true,
    strictMode = false
  } = options;

  const issues: string[] = [];
  const warnings: string[] = [];
  const riskFlags: string[] = [];
  const sensitiveClaims: string[] = [];
  
  // Calculate effective character limit
  const effectiveLimit = includeOptOutInLimit ? maxCharacters : maxCharacters + OPT_OUT_LENGTH;
  const messageWithOptOut = message + ' ' + OPT_OUT_TEXT;
  const charCount = messageWithOptOut.length;

  // 1. Check character limit
  const withinCharLimit = charCount <= effectiveLimit;
  if (!withinCharLimit) {
    issues.push(`Message exceeds ${effectiveLimit} character limit (${charCount} chars)`);
  }

  // 2. Check for sender identification
  let hasSenderId = false;
  if (orgName) {
    const orgNameLower = orgName.toLowerCase();
    const messageLower = message.toLowerCase();
    
    // Check if org name or abbreviation appears in message
    hasSenderId = messageLower.includes(orgNameLower) ||
      orgNameLower.split(' ').some(word => 
        word.length > 2 && messageLower.includes(word)
      );
  } else {
    // Without org name, look for common sender patterns
    hasSenderId = /\b(from|team|campaign|org|committee)\b/i.test(message);
  }
  
  if (!hasSenderId) {
    warnings.push('Message may lack clear sender identification');
  }

  // 3. Check for opt-out language
  const stopKeywordsFound = STOP_KEYWORDS.filter(kw => 
    message.toUpperCase().includes(kw)
  );
  
  // Opt-out will be appended, so we check if it's already there
  const hasStopLanguage = stopKeywordsFound.length > 0 || 
    message.toLowerCase().includes('opt out') ||
    message.toLowerCase().includes('unsubscribe');
  
  // Note: We append opt-out automatically, so this is informational
  if (!hasStopLanguage) {
    // Not an issue since we append it, but note it
  }

  // 4. Check for prohibited content (blockers)
  for (const { pattern, description } of PROHIBITED_PATTERNS) {
    if (pattern.test(message)) {
      issues.push(`Blocked: ${description}`);
    }
  }

  // 5. Check for unverified claims (warnings in normal mode, issues in strict)
  for (const { pattern, description } of CLAIM_PATTERNS) {
    if (pattern.test(message)) {
      sensitiveClaims.push(description);
      if (strictMode) {
        issues.push(`Review required: ${description}`);
      } else {
        warnings.push(`Potential claim: ${description}`);
      }
    }
  }

  // 6. Check for sensitive topics (risk flags)
  const messageLower = message.toLowerCase();
  for (const { keywords, category } of SENSITIVE_TOPICS) {
    const found = keywords.some(kw => messageLower.includes(kw));
    if (found) {
      riskFlags.push(category);
      warnings.push(`Sensitive topic detected: ${category}`);
    }
  }

  // 7. Determine overall status
  let status: ComplianceCheckResult['status'];
  
  if (issues.some(i => i.startsWith('Blocked:'))) {
    status = 'blocked';
  } else if (issues.length > 0 || (strictMode && warnings.length > 0)) {
    status = 'review';
  } else if (warnings.length > 0 || riskFlags.length > 0) {
    status = 'review';
  } else {
    status = 'pass';
  }

  return {
    status,
    checks: {
      has_sender_id: hasSenderId,
      has_stop_language: hasStopLanguage,
      within_char_limit: withinCharLimit,
      stop_keywords_present: stopKeywordsFound,
      sensitive_claims_detected: sensitiveClaims,
      risk_flags: riskFlags,
      character_count: charCount,
      character_limit: effectiveLimit
    },
    issues,
    warnings
  };
}

// ============================================================================
// Helper: Clean message for compliance
// ============================================================================

export function cleanMessageForCompliance(
  message: string,
  maxLength: number = DEFAULT_MAX_SMS_LENGTH
): string {
  // Remove any existing opt-out text to avoid duplication
  let cleaned = message
    .replace(/Reply STOP to opt out\.?/gi, '')
    .replace(/Text STOP to stop\.?/gi, '')
    .replace(/STOP to opt out\.?/gi, '')
    .trim();
  
  // Truncate if needed (leaving room for opt-out)
  const maxContentLength = maxLength - OPT_OUT_LENGTH - 1;
  if (cleaned.length > maxContentLength) {
    cleaned = cleaned.substring(0, maxContentLength - 3) + '...';
  }
  
  return cleaned;
}

// ============================================================================
// Helper: Append opt-out text
// ============================================================================

export function appendOptOut(message: string): string {
  const cleaned = cleanMessageForCompliance(message);
  return `${cleaned} ${OPT_OUT_TEXT}`;
}
