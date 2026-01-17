/**
 * Meta Conversions API Utilities
 *
 * Provides hashing, normalization, and payload building for Meta CAPI.
 * Follows Meta's data processing requirements:
 * https://developers.facebook.com/docs/marketing-api/conversions-api/parameters/customer-information-parameters
 */

// Privacy mode field mappings
// conservative: Minimum viable matching (email OR phone + location + identifiers)
// balanced: + name + full location
// aggressive: + IP + User Agent (for better match rate)
export const PRIVACY_MODE_FIELDS: Record<string, Set<string>> = {
  conservative: new Set(['em', 'ph', 'zp', 'country', 'external_id', 'fbp', 'fbc']),
  balanced: new Set(['em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country', 'external_id', 'fbp', 'fbc']),
  aggressive: new Set(['em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country', 'external_id', 'fbp', 'fbc', 'client_ip_address', 'client_user_agent']),
};

// Fields that are NEVER sent regardless of privacy mode
const BLOCKED_FIELDS = new Set(['employer', 'occupation', 'addr1', 'address', 'street']);

/**
 * SHA-256 hash a string value
 * Meta requires all PII fields to be SHA-256 hashed (lowercase hex)
 */
export async function hashSHA256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Normalize and hash email per Meta spec
 * - Trim whitespace
 * - Lowercase
 * - Remove periods from Gmail local part (optional, not done here)
 */
export async function normalizeAndHashEmail(email: string): Promise<string | null> {
  if (!email || typeof email !== 'string') return null;
  const normalized = email.toLowerCase().trim();
  if (!normalized || !normalized.includes('@')) return null;
  return hashSHA256(normalized);
}

/**
 * Normalize and hash phone per Meta spec
 * - Remove all non-digit characters
 * - Must include country code (we assume US +1 if 10 digits)
 * - No spaces, hyphens, parentheses, or plus sign in final value
 */
export async function normalizeAndHashPhone(phone: string): Promise<string | null> {
  if (!phone || typeof phone !== 'string') return null;

  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');

  // Skip if too short
  if (digits.length < 10) return null;

  // Add US country code if looks like 10-digit US number
  if (digits.length === 10) {
    digits = '1' + digits;
  }

  // Remove leading zeros that aren't country codes
  if (digits.startsWith('00')) {
    digits = digits.substring(2);
  }

  return hashSHA256(digits);
}

/**
 * Normalize and hash name (first or last) per Meta spec
 * - Lowercase
 * - Collapse multiple whitespace to single space (preserves compound names)
 * - Examples: "De La Cruz" → "de la cruz", "Mary Ann" → "mary ann"
 */
export async function normalizeAndHashName(name: string): Promise<string | null> {
  if (!name || typeof name !== 'string') return null;
  const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');
  if (!normalized) return null;
  return hashSHA256(normalized);
}

/**
 * Normalize and hash city per Meta spec
 * - Lowercase
 * - Remove special characters but preserve spaces
 * - Collapse multiple spaces to single space
 * - Examples: "St. Louis" → "st louis", "Winston-Salem" → "winston salem"
 */
export async function normalizeAndHashCity(city: string): Promise<string | null> {
  if (!city || typeof city !== 'string') return null;
  const normalized = city
    .toLowerCase()
    .trim()
    .replace(/[^a-z\s]/g, '')  // Remove non-letters except spaces
    .replace(/\s+/g, ' ')       // Collapse multiple spaces
    .trim();                    // Final trim
  if (!normalized) return null;
  return hashSHA256(normalized);
}

// US State name to 2-letter code mapping
const STATE_MAP: Record<string, string> = {
  'alabama': 'al', 'alaska': 'ak', 'arizona': 'az', 'arkansas': 'ar',
  'california': 'ca', 'colorado': 'co', 'connecticut': 'ct', 'delaware': 'de',
  'florida': 'fl', 'georgia': 'ga', 'hawaii': 'hi', 'idaho': 'id',
  'illinois': 'il', 'indiana': 'in', 'iowa': 'ia', 'kansas': 'ks',
  'kentucky': 'ky', 'louisiana': 'la', 'maine': 'me', 'maryland': 'md',
  'massachusetts': 'ma', 'michigan': 'mi', 'minnesota': 'mn', 'mississippi': 'ms',
  'missouri': 'mo', 'montana': 'mt', 'nebraska': 'ne', 'nevada': 'nv',
  'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny',
  'north carolina': 'nc', 'north dakota': 'nd', 'ohio': 'oh', 'oklahoma': 'ok',
  'oregon': 'or', 'pennsylvania': 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
  'south dakota': 'sd', 'tennessee': 'tn', 'texas': 'tx', 'utah': 'ut',
  'vermont': 'vt', 'virginia': 'va', 'washington': 'wa', 'west virginia': 'wv',
  'wisconsin': 'wi', 'wyoming': 'wy', 'district of columbia': 'dc',
  // Territories
  'puerto rico': 'pr', 'guam': 'gu', 'virgin islands': 'vi',
  'american samoa': 'as', 'northern mariana islands': 'mp',
};

/**
 * Normalize and hash state per Meta spec
 * - Use 2-letter state code
 * - Lowercase
 * - Map full US state names to 2-letter codes
 * - Returns null for unrecognized states (prevents bad data from polluting match)
 */
export async function normalizeAndHashState(state: string): Promise<string | null> {
  if (!state || typeof state !== 'string') return null;

  const trimmed = state.toLowerCase().trim();

  // If exactly 2 chars, assume it's already a valid state code
  if (trimmed.length === 2 && /^[a-z]{2}$/.test(trimmed)) {
    return hashSHA256(trimmed);
  }

  // Look up full state name in mapping
  const mapped = STATE_MAP[trimmed];
  if (mapped) {
    return hashSHA256(mapped);
  }

  // No fallback - return null for unrecognized states
  // This prevents garbage data from being sent to Meta
  return null;
}

/**
 * Normalize and hash zip per Meta spec
 * - US: Use first 5 digits only
 * - Remove spaces
 */
export async function normalizeAndHashZip(zip: string): Promise<string | null> {
  if (!zip || typeof zip !== 'string') return null;
  const normalized = zip.replace(/\s/g, '').substring(0, 5);
  if (normalized.length < 5) return null;
  return hashSHA256(normalized);
}

/**
 * Normalize and hash country per Meta spec
 * - Use 2-letter ISO country code
 * - Lowercase
 */
export async function normalizeAndHashCountry(country: string): Promise<string | null> {
  if (!country || typeof country !== 'string') return null;

  // Common mappings
  const countryMap: Record<string, string> = {
    'united states': 'us',
    'usa': 'us',
    'u.s.a.': 'us',
    'u.s.': 'us',
    'america': 'us',
    'canada': 'ca',
    'united kingdom': 'gb',
    'uk': 'gb',
    'australia': 'au',
  };

  let normalized = country.toLowerCase().trim();
  normalized = countryMap[normalized] || normalized.substring(0, 2);

  if (normalized.length !== 2) return null;
  return hashSHA256(normalized);
}

/**
 * Build user_data object for Meta CAPI based on privacy mode
 *
 * @param rawData - Raw user data (email, phone, fn, ln, city, state, zip, country)
 * @param privacyMode - 'conservative', 'balanced', or 'aggressive'
 * @param extras - Additional non-hashed fields (fbp, fbc, external_id, client_ip, user_agent)
 */
export async function buildUserData(
  rawData: Record<string, any>,
  privacyMode: string,
  extras: {
    fbp?: string | null;
    fbc?: string | null;
    external_id?: string | null;
    client_ip_address?: string | null;
    client_user_agent?: string | null;
  } = {}
): Promise<Record<string, any>> {
  const allowedFields = PRIVACY_MODE_FIELDS[privacyMode] || PRIVACY_MODE_FIELDS.conservative;
  const userData: Record<string, any> = {};

  // Hash PII fields if allowed by privacy mode
  if (allowedFields.has('em') && rawData.email) {
    const hashed = await normalizeAndHashEmail(rawData.email);
    if (hashed) userData.em = hashed;
  }

  if (allowedFields.has('ph') && rawData.phone) {
    const hashed = await normalizeAndHashPhone(rawData.phone);
    if (hashed) userData.ph = hashed;
  }

  if (allowedFields.has('fn') && rawData.fn) {
    const hashed = await normalizeAndHashName(rawData.fn);
    if (hashed) userData.fn = hashed;
  }

  if (allowedFields.has('ln') && rawData.ln) {
    const hashed = await normalizeAndHashName(rawData.ln);
    if (hashed) userData.ln = hashed;
  }

  if (allowedFields.has('ct') && rawData.city) {
    const hashed = await normalizeAndHashCity(rawData.city);
    if (hashed) userData.ct = hashed;
  }

  if (allowedFields.has('st') && rawData.state) {
    const hashed = await normalizeAndHashState(rawData.state);
    if (hashed) userData.st = hashed;
  }

  if (allowedFields.has('zp') && rawData.zip) {
    const hashed = await normalizeAndHashZip(rawData.zip);
    if (hashed) userData.zp = hashed;
  }

  if (allowedFields.has('country') && rawData.country) {
    const hashed = await normalizeAndHashCountry(rawData.country);
    if (hashed) userData.country = hashed;
  }

  // Add non-hashed identifiers if allowed
  if (allowedFields.has('external_id') && extras.external_id) {
    userData.external_id = extras.external_id;
  }

  if (allowedFields.has('fbp') && extras.fbp) {
    userData.fbp = extras.fbp;
  }

  if (allowedFields.has('fbc') && extras.fbc) {
    userData.fbc = extras.fbc;
  }

  if (allowedFields.has('client_ip_address') && extras.client_ip_address) {
    userData.client_ip_address = extras.client_ip_address;
  }

  if (allowedFields.has('client_user_agent') && extras.client_user_agent) {
    userData.client_user_agent = extras.client_user_agent;
  }

  return userData;
}

/**
 * Generate a deterministic dedupe key for CAPI outbox
 */
export function generateDedupeKey(eventName: string, orgId: string, sourceId: string): string {
  return `${eventName}:${orgId}:${sourceId}`;
}

/**
 * Build the full Meta CAPI event payload
 */
export interface CAPIEventInput {
  eventName: string;
  eventTime: Date | string;
  eventId: string;
  eventSourceUrl?: string;
  userData: Record<string, any>;
  customData?: Record<string, any>;
  actionSource?: string;
  testEventCode?: string;
}

export function buildCAPIEvent(input: CAPIEventInput): Record<string, any> {
  const event: Record<string, any> = {
    event_name: input.eventName,
    event_time: Math.floor(new Date(input.eventTime).getTime() / 1000),
    event_id: input.eventId,
    action_source: input.actionSource || 'website',
    user_data: input.userData,
  };

  if (input.eventSourceUrl) {
    event.event_source_url = input.eventSourceUrl;
  }

  if (input.customData && Object.keys(input.customData).length > 0) {
    event.custom_data = input.customData;
  }

  return event;
}

/**
 * Calculate exponential backoff for retry
 * @param attempts - Number of attempts so far
 * @returns ISO timestamp for next retry
 */
export function computeNextRetryAt(attempts: number): string {
  // Exponential backoff: 5min, 10min, 20min, 40min, 60min (max)
  const delayMinutes = Math.min(60, 5 * Math.pow(2, Math.max(0, attempts - 1)));
  return new Date(Date.now() + delayMinutes * 60 * 1000).toISOString();
}

/**
 * SECURITY: Pre-hash all user data fields BEFORE storing in database.
 * This ensures NO plaintext PII is stored in meta_conversion_events.
 *
 * Returns an object with Meta CAPI field names (em, ph, fn, etc.) as keys
 * and their SHA-256 hashed values. Only non-empty fields are included.
 *
 * @param rawData - Raw user data with plaintext values
 * @returns Object with hashed values ready for storage
 */
export async function hashUserDataForStorage(rawData: {
  email?: string;
  phone?: string;
  fn?: string;
  ln?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}): Promise<Record<string, string>> {
  const hashed: Record<string, string> = {};

  // Hash each field using Meta's expected normalization
  if (rawData.email) {
    const h = await normalizeAndHashEmail(rawData.email);
    if (h) hashed.em = h;
  }

  if (rawData.phone) {
    const h = await normalizeAndHashPhone(rawData.phone);
    if (h) hashed.ph = h;
  }

  if (rawData.fn) {
    const h = await normalizeAndHashName(rawData.fn);
    if (h) hashed.fn = h;
  }

  if (rawData.ln) {
    const h = await normalizeAndHashName(rawData.ln);
    if (h) hashed.ln = h;
  }

  if (rawData.city) {
    const h = await normalizeAndHashCity(rawData.city);
    if (h) hashed.ct = h;
  }

  if (rawData.state) {
    const h = await normalizeAndHashState(rawData.state);
    if (h) hashed.st = h;
  }

  if (rawData.zip) {
    const h = await normalizeAndHashZip(rawData.zip);
    if (h) hashed.zp = h;
  }

  if (rawData.country) {
    const h = await normalizeAndHashCountry(rawData.country);
    if (h) hashed.country = h;
  }

  return hashed;
}

/**
 * Build user_data for Meta CAPI from PRE-HASHED storage data.
 * Filters fields based on privacy_mode.
 *
 * @param hashedData - Pre-hashed user data from storage (em, ph, fn, ln, ct, st, zp, country)
 * @param privacyMode - 'conservative', 'balanced', or 'aggressive'
 * @param extras - Non-hashed identifiers (fbp, fbc, external_id, client_ip, user_agent)
 */
export function buildUserDataFromHashed(
  hashedData: Record<string, string>,
  privacyMode: string,
  extras: {
    fbp?: string | null;
    fbc?: string | null;
    external_id?: string | null;
    client_ip_address?: string | null;
    client_user_agent?: string | null;
  } = {}
): Record<string, any> {
  const allowedFields = PRIVACY_MODE_FIELDS[privacyMode] || PRIVACY_MODE_FIELDS.conservative;
  const userData: Record<string, any> = {};

  // Copy pre-hashed PII fields if allowed by privacy mode
  if (allowedFields.has('em') && hashedData.em) {
    userData.em = hashedData.em;
  }
  if (allowedFields.has('ph') && hashedData.ph) {
    userData.ph = hashedData.ph;
  }
  if (allowedFields.has('fn') && hashedData.fn) {
    userData.fn = hashedData.fn;
  }
  if (allowedFields.has('ln') && hashedData.ln) {
    userData.ln = hashedData.ln;
  }
  if (allowedFields.has('ct') && hashedData.ct) {
    userData.ct = hashedData.ct;
  }
  if (allowedFields.has('st') && hashedData.st) {
    userData.st = hashedData.st;
  }
  if (allowedFields.has('zp') && hashedData.zp) {
    userData.zp = hashedData.zp;
  }
  if (allowedFields.has('country') && hashedData.country) {
    userData.country = hashedData.country;
  }

  // Add non-hashed identifiers if allowed
  if (allowedFields.has('external_id') && extras.external_id) {
    userData.external_id = extras.external_id;
  }
  if (allowedFields.has('fbp') && extras.fbp) {
    userData.fbp = extras.fbp;
  }
  if (allowedFields.has('fbc') && extras.fbc) {
    userData.fbc = extras.fbc;
  }
  if (allowedFields.has('client_ip_address') && extras.client_ip_address) {
    userData.client_ip_address = extras.client_ip_address;
  }
  if (allowedFields.has('client_user_agent') && extras.client_user_agent) {
    userData.client_user_agent = extras.client_user_agent;
  }

  return userData;
}

/**
 * Match score weights for debugging.
 * Based on Meta's Event Match Quality scoring guidance.
 * Higher weights for stronger identity signals.
 */
const MATCH_SCORE_WEIGHTS: Record<string, number> = {
  em: 30,           // Email - strongest signal
  ph: 25,           // Phone - very strong
  external_id: 15,  // External ID - good for cross-device
  fbp: 10,          // Facebook pixel cookie
  fbc: 10,          // Facebook click ID
  fn: 3,            // First name - weak alone
  ln: 3,            // Last name - weak alone
  ct: 2,            // City
  st: 2,            // State
  zp: 5,            // Zip - moderate
  country: 2,       // Country
  client_ip_address: 3,    // IP address
  client_user_agent: 2,    // User agent
};

// Safety cap: without email or phone, match quality is limited
const MATCH_SCORE_CAP_NO_PRIMARY_ID = 40;

/**
 * Calculate a numeric match score based on presence of fields.
 * Score is 0-100, with higher scores indicating better match potential.
 *
 * This is for debugging/analytics only - Meta calculates their own match quality.
 *
 * SAFETY CAP: If neither email nor phone is present, score is capped at 40
 * because Meta cannot reliably match without a primary identifier.
 *
 * Scoring guidance:
 * - 0-20: Poor - unlikely to match
 * - 21-40: Fair - may match with luck
 * - 41-60: Good - reasonable match chance
 * - 61-80: Very Good - high match chance
 * - 81-100: Excellent - very likely to match
 *
 * @param hashedData - Pre-hashed user data fields
 * @param extras - Non-hashed identifiers (fbp, fbc, external_id, etc.)
 * @returns Score from 0-100
 */
export function calculateMatchScore(
  hashedData: Record<string, string>,
  extras: {
    fbp?: string | null;
    fbc?: string | null;
    external_id?: string | null;
    client_ip_address?: string | null;
    client_user_agent?: string | null;
  } = {}
): number {
  let score = 0;
  const maxPossible = Object.values(MATCH_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);

  // Score hashed PII fields
  for (const [field, weight] of Object.entries(MATCH_SCORE_WEIGHTS)) {
    if (field in hashedData && hashedData[field]) {
      score += weight;
    } else if (field in extras && extras[field as keyof typeof extras]) {
      score += weight;
    }
  }

  // Normalize to 0-100
  let normalizedScore = Math.round((score / maxPossible) * 100);

  // SAFETY CAP: Without email or phone, cap score at 40 (fair)
  // Meta cannot reliably match without a primary identifier
  const hasEmail = hashedData.em && hashedData.em.length > 0;
  const hasPhone = hashedData.ph && hashedData.ph.length > 0;
  if (!hasEmail && !hasPhone) {
    normalizedScore = Math.min(normalizedScore, MATCH_SCORE_CAP_NO_PRIMARY_ID);
  }

  return normalizedScore;
}

/**
 * Get a human-readable match quality label from score.
 * @param score - Match score (0-100)
 * @param hashedData - Optional: if provided, enforces safety cap for missing email/phone
 */
export function getMatchQualityLabel(
  score: number,
  hashedData?: Record<string, string>
): string {
  // If hashedData provided, enforce safety cap for missing primary identifiers
  if (hashedData) {
    const hasEmail = hashedData.em && hashedData.em.length > 0;
    const hasPhone = hashedData.ph && hashedData.ph.length > 0;
    if (!hasEmail && !hasPhone) {
      // Without email or phone, label cannot exceed 'fair'
      if (score >= 21) return 'fair';
      return 'poor';
    }
  }

  if (score >= 81) return 'excellent';
  if (score >= 61) return 'very_good';
  if (score >= 41) return 'good';
  if (score >= 21) return 'fair';
  return 'poor';
}

/**
 * @deprecated Use hashUserDataForStorage instead.
 * Sanitize raw user data - NO LONGER STORES RAW PII.
 */
export function sanitizeUserDataRaw(data: Record<string, any>): Record<string, any> {
  // SECURITY: This function is deprecated. Callers should use hashUserDataForStorage.
  // Keeping for backwards compatibility but it now returns empty object.
  console.warn('[CAPI] sanitizeUserDataRaw is deprecated - use hashUserDataForStorage');
  return {};
}

/**
 * Meta CAPI API version
 */
export const META_CAPI_VERSION = 'v22.0';

/**
 * Build the Meta CAPI endpoint URL
 */
export function buildCAPIEndpoint(pixelId: string): string {
  return `https://graph.facebook.com/${META_CAPI_VERSION}/${pixelId}/events`;
}
