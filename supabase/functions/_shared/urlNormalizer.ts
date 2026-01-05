/**
 * URL Normalization, Canonicalization, and Deduplication Utilities
 * Provides robust dedupe key generation and cross-source duplicate detection
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
  // Google News specific
  'oc', 'hl', 'gl', 'ceid',
];

// AMP URL patterns to strip
const AMP_PATTERNS = [
  /\/amp\/?$/i,
  /\.amp$/i,
  /\/amp\//i,
  /[?&]amp=1/i,
  /[?&]outputType=amp/i,
];

// Known redirect domains to resolve
const REDIRECT_DOMAINS = [
  'news.google.com',
  't.co',
  'bit.ly',
  'tinyurl.com',
  'ow.ly',
  'buff.ly',
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
    
    // Remove AMP suffixes from path
    for (const pattern of AMP_PATTERNS) {
      parsed.pathname = parsed.pathname.replace(pattern, '');
    }
    
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
 * Extract the likely canonical URL from a Google News or redirect URL
 */
export function extractCanonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    
    // Google News articles have the real URL encoded in the path or query
    if (parsed.hostname === 'news.google.com') {
      // Try to extract from article path (format: /articles/...)
      const articleMatch = url.match(/articles\/([^?]+)/);
      if (articleMatch) {
        // The article ID doesn't give us the URL, but we can normalize consistently
        return normalizeUrl(url);
      }
      
      // Check for url parameter
      const urlParam = parsed.searchParams.get('url');
      if (urlParam) {
        return normalizeUrl(urlParam);
      }
    }
    
    // For other redirect domains, we can't resolve without fetching
    // Just normalize what we have
    return normalizeUrl(url);
  } catch {
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
 * Generate a stable hash for string content
 * Uses FNV-1a algorithm for better distribution
 */
export function generateHash(str: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as 32-bit unsigned
  }
  return hash.toString(36);
}

/**
 * Simple hash function (legacy, kept for compatibility)
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
 * Generate a content hash for deduplication
 * Combines normalized title + canonical URL + date bucket
 * This helps detect the same article from different syndication sources
 */
export function generateContentHash(
  title: string,
  url: string,
  publishedDate: string | Date,
  sourceName?: string
): string {
  const normalizedTitle = normalizeText(title).substring(0, 100);
  const canonicalUrl = extractCanonicalUrl(url);
  const domain = extractDomain(canonicalUrl);
  
  // Create date bucket (day granularity)
  const date = typeof publishedDate === 'string' ? new Date(publishedDate) : publishedDate;
  const dateBucket = isNaN(date.getTime()) 
    ? 'unknown' 
    : date.toISOString().split('T')[0];
  
  // Combine: normalized title + domain + date
  // This catches same article republished across syndication
  const hashInput = `${normalizedTitle}|${domain}|${dateBucket}`;
  
  return generateHash(hashInput);
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
  const canonicalUrl = extractCanonicalUrl(url);
  const normalizedUrl = normalizeUrl(canonicalUrl);
  const normalizedTitle = normalizeText(title);
  
  // Create date bucket (day granularity to allow for timezone differences)
  const date = typeof publishedDate === 'string' ? new Date(publishedDate) : publishedDate;
  const dateBucket = isNaN(date.getTime()) 
    ? 'unknown' 
    : date.toISOString().split('T')[0]; // YYYY-MM-DD
  
  // Combine components
  const components = [
    generateHash(normalizedUrl),
    generateHash(normalizedTitle.substring(0, 100)), // First 100 chars of title
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

/**
 * Check if a URL is from a known redirect/aggregator domain
 */
export function isRedirectUrl(url: string): boolean {
  try {
    const domain = extractDomain(url);
    return REDIRECT_DOMAINS.some(rd => domain === rd || domain.endsWith(`.${rd}`));
  } catch {
    return false;
  }
}

/**
 * Generate a title-based similarity hash for fuzzy matching
 * Useful for detecting same story with slightly different titles
 */
export function generateTitleHash(title: string): string {
  // Extract key words (skip common words)
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'as', 'from', 'into', 'about', 'says', 'said', 'new', 'news']);
  
  const words = normalizeText(title)
    .split(' ')
    .filter(w => w.length > 2 && !stopWords.has(w))
    .slice(0, 5) // Take first 5 significant words
    .sort();
  
  return generateHash(words.join(''));
}
