/**
 * SMS Refcode Extractor
 * 
 * Extracts refcodes from SMS campaign message text.
 * Handles multiple URL patterns used in Switchboard campaigns.
 */

export interface ExtractedRefcode {
  refcode: string | null;
  url: string | null;
  pattern: 'actblue_param' | 'sb_link_vanity' | 'actblue_direct' | 'vanity_path' | null;
}

/**
 * Extract refcode and destination URL from SMS message text.
 * Handles multiple URL patterns:
 * 
 * Pattern 1: ActBlue URL with refcode parameter
 *   e.g., https://secure.actblue.com/donate/xyz?refcode=ABC123
 * 
 * Pattern 2: Switchboard sb_link format with vanity URL
 *   e.g., {{ "https://hamawyfornj.org/aama0115" | sb_link }}
 * 
 * Pattern 3: Direct ActBlue URL with refcode in path or query
 *   e.g., https://secure.actblue.com/donate/mltcosms?refcode=intro1217
 * 
 * Pattern 4: Vanity URL path as refcode
 *   e.g., https://example.org/donate-now -> refcode: donate-now
 */
export function extractRefcodeFromMessage(messageText: string | null | undefined): ExtractedRefcode {
  if (!messageText) {
    return { refcode: null, url: null, pattern: null };
  }

  // Pattern 1: ActBlue URL with refcode parameter (highest priority)
  const actblueParamMatch = messageText.match(
    /https?:\/\/secure\.actblue\.com[^\s\"\}\|]+[?&]refcode=([a-zA-Z0-9_-]+)/i
  );
  if (actblueParamMatch) {
    return { 
      refcode: actblueParamMatch[1], 
      url: actblueParamMatch[0].split(/[\"\}\|]/)[0], // Clean trailing chars
      pattern: 'actblue_param' 
    };
  }

  // Pattern 2: Switchboard sb_link format with vanity URL
  // e.g., {{ "https://hamawyfornj.org/aama0115" | sb_link }}
  const sbLinkMatch = messageText.match(
    /\{\{\s*"(https?:\/\/[^"]+)"\s*\|\s*sb_link\s*\}\}/
  );
  if (sbLinkMatch) {
    const vanityUrl = sbLinkMatch[1];
    // Extract path as refcode (e.g., /aama0115 -> aama0115)
    const pathMatch = vanityUrl.match(/\/([a-zA-Z0-9_-]+)$/);
    if (pathMatch) {
      return { 
        refcode: pathMatch[1], 
        url: vanityUrl, 
        pattern: 'sb_link_vanity' 
      };
    }
    // If no path match, return URL with null refcode
    return { refcode: null, url: vanityUrl, pattern: null };
  }

  // Pattern 3: Direct ActBlue URL without sb_link wrapper
  const actblueDirectMatch = messageText.match(
    /(https?:\/\/secure\.actblue\.com\/donate\/[^\s\"\}\|]+)/i
  );
  if (actblueDirectMatch) {
    const url = actblueDirectMatch[1];
    // Check for refcode in query string
    const refcodeParam = url.match(/[?&]refcode=([a-zA-Z0-9_-]+)/i);
    if (refcodeParam) {
      return { 
        refcode: refcodeParam[1], 
        url, 
        pattern: 'actblue_direct' 
      };
    }
    // Use form name as fallback refcode
    const formMatch = url.match(/\/donate\/([a-zA-Z0-9_-]+)/);
    if (formMatch) {
      return { 
        refcode: formMatch[1], 
        url, 
        pattern: 'actblue_direct' 
      };
    }
  }

  // Pattern 4: Any other vanity URL with path
  const anyUrlMatch = messageText.match(
    /(https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\/([a-zA-Z0-9_-]+))/
  );
  if (anyUrlMatch) {
    return { 
      refcode: anyUrlMatch[2], 
      url: anyUrlMatch[1], 
      pattern: 'vanity_path' 
    };
  }

  return { refcode: null, url: null, pattern: null };
}

/**
 * Normalize a refcode for matching.
 * Handles common variations between SMS campaign naming and ActBlue refcodes:
 * - Intro_20250115_AAMA -> 20250115AAMA
 * - aama0115 -> aama0115 (unchanged)
 */
export function normalizeRefcode(refcode: string | null | undefined): string | null {
  if (!refcode) return null;
  
  // Convert to lowercase for consistent matching
  let normalized = refcode.toLowerCase();
  
  // Remove common prefixes
  normalized = normalized.replace(/^(intro_|reminder_|urgent_|final_)/i, '');
  
  // Remove underscores (common in campaign naming)
  normalized = normalized.replace(/_/g, '');
  
  return normalized;
}

/**
 * Check if two refcodes match (with normalization).
 */
export function refcodesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalizedA = normalizeRefcode(a);
  const normalizedB = normalizeRefcode(b);
  
  if (!normalizedA || !normalizedB) return false;
  
  // Exact match after normalization
  if (normalizedA === normalizedB) return true;
  
  // One contains the other (handles partial matches)
  if (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) {
    // Only match if the shorter one is at least 6 chars (avoid false positives)
    const shorter = normalizedA.length < normalizedB.length ? normalizedA : normalizedB;
    return shorter.length >= 6;
  }
  
  return false;
}
