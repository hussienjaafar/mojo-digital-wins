/**
 * URL Normalization and Deduplication Utilities
 * Provides canonical URL generation and robust dedup key creation
 */

// Tracking parameters to strip from URLs
const TRACKING_PARAMS = [
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'fbclid', 'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid',
  'msclkid', 'twclid', 'ttclid', 'li_fat_id',
  'mc_cid', 'mc_eid', 'mkt_tok',
  'ref', 'source', 'src', 'via', 'referrer',
  '_ga', '_gl', '_hsenc', '_hsmi',
  'trk', 'trkCampaign', 'trkInfo',
  'si', 'share', 'amp',
  'ncid', 'ocid', 'ns_mchannel', 'ns_source', 'ns_campaign',
];

/**
 * Normalize a URL by removing tracking parameters and standardizing format
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Remove tracking parameters
    for (const param of TRACKING_PARAMS) {
      parsed.searchParams.delete(param);
    }
    
    // Normalize hostname (lowercase)
    parsed.hostname = parsed.hostname.toLowerCase();
    
    // Remove www. prefix for consistency
    if (parsed.hostname.startsWith('www.')) {
      parsed.hostname = parsed.hostname.substring(4);
    }
    
    // Remove trailing slashes from pathname
    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    
    // Remove fragment/hash
    parsed.hash = '';
    
    // Sort remaining query params for consistency
    const sortedParams = new URLSearchParams();
    const keys = Array.from(parsed.searchParams.keys()).sort();
    for (const key of keys) {
      sortedParams.set(key, parsed.searchParams.get(key) || '');
    }
    parsed.search = sortedParams.toString() ? `?${sortedParams.toString()}` : '';
    
    return parsed.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * Normalize text for comparison (lowercase, collapse whitespace, remove punctuation)
 */
export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .trim();
}

/**
 * Simple hash function for dedup key generation
 */
export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Generate a robust dedup key for an article
 * Combines: canonical URL hash + normalized title hash + date bucket + source
 */
export function generateDedupeKey(
  url: string,
  title: string,
  publishedDate: string | Date,
  sourceId?: string
): string {
  const normalizedUrl = normalizeUrl(url);
  const normalizedTitle = normalizeText(title);
  
  // Create date bucket (day granularity to allow for timezone differences)
  const date = typeof publishedDate === 'string' ? new Date(publishedDate) : publishedDate;
  const dateBucket = isNaN(date.getTime()) 
    ? 'unknown' 
    : date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Combine components
  const components = [
    simpleHash(normalizedUrl),
    simpleHash(normalizedTitle.substring(0, 100)), // First 100 chars of title
    dateBucket,
    sourceId || 'unknown'
  ];
  
  return components.join('-');
}

/**
 * Extract domain from URL for source identification
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    let domain = parsed.hostname.toLowerCase();
    if (domain.startsWith('www.')) {
      domain = domain.substring(4);
    }
    return domain;
  } catch {
    return '';
  }
}

/**
 * Check if two URLs likely point to the same article
 */
export function areUrlsSimilar(url1: string, url2: string): boolean {
  const norm1 = normalizeUrl(url1);
  const norm2 = normalizeUrl(url2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // Same domain and similar path
  try {
    const parsed1 = new URL(norm1);
    const parsed2 = new URL(norm2);
    
    if (parsed1.hostname !== parsed2.hostname) return false;
    
    // Check if paths are similar (ignoring minor differences)
    const path1 = parsed1.pathname.replace(/\d+/g, '#');
    const path2 = parsed2.pathname.replace(/\d+/g, '#');
    
    return path1 === path2;
  } catch {
    return false;
  }
}
