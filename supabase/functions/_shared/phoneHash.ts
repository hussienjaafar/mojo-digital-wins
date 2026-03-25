/**
 * Standardized Phone Hash Utility
 * 
 * CRITICAL: All functions that hash phone numbers MUST use this utility
 * to ensure consistent hash format across:
 * - sync-switchboard-sms (SMS events)
 * - match-touchpoints-to-donors (identity links)
 * - actblue-webhook (transactions)
 * - reconcile-sms-refcodes (attribution)
 * 
 * Format: Full SHA-256 hash of normalized 10-digit phone
 * Normalization: Strip all non-digits, take last 10 digits
 */

/**
 * Normalize a phone number to last 10 digits only.
 * Returns null if phone has fewer than 10 digits.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Take last 10 digits (handles +1 country code)
  if (digits.length < 10) return null;
  
  return digits.slice(-10);
}

/**
 * Compute SHA-256 hash of a normalized phone number.
 * Returns full 64-character hex hash for maximum collision resistance.
 * Returns null if phone is invalid (fewer than 10 digits).
 * 
 * @example
 * const hash = await computePhoneHash('(720) 737-9967');
 * // Returns: 'a1b2c3d4e5f6...' (64 chars)
 */
export async function computePhoneHash(phone: string | null | undefined): Promise<string | null> {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  // Return full hash (not truncated) for collision resistance
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute SHA-256 hash of an email address.
 * Normalizes by lowercasing and trimming.
 * Returns null if email is invalid.
 */
export async function computeEmailHash(email: string | null | undefined): Promise<string | null> {
  if (!email) return null;
  
  const normalized = email.toLowerCase().trim();
  if (!normalized.includes('@')) return null;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
