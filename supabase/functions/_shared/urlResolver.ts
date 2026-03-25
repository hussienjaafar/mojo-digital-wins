/**
 * URL Resolver Utility
 * 
 * Follows HTTP redirects from vanity URLs to discover final ActBlue destinations.
 * Used to resolve the actual actblue_refcode for SMS attribution.
 */

export interface ResolvedUrl {
  /** The final URL after following all redirects */
  finalUrl: string | null;
  /** The refcode extracted from the final ActBlue URL */
  actblueRefcode: string | null;
  /** The form name from the ActBlue URL path */
  actblueForm: string | null;
  /** The chain of URLs followed during resolution */
  redirectChain: string[];
  /** Whether resolution was successful */
  success: boolean;
  /** Error message if resolution failed */
  error: string | null;
}

const MAX_REDIRECTS = 10;
const FETCH_TIMEOUT_MS = 5000;

/**
 * Create a fetch with timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      method: 'HEAD', // Use HEAD to avoid downloading full response
      redirect: 'manual', // Handle redirects manually to track the chain
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MojoBot/1.0)',
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extract ActBlue refcode and form name from a URL
 */
export function extractActBlueInfo(url: string): { refcode: string | null; form: string | null } {
  try {
    const parsed = new URL(url);
    
    // Check if this is an ActBlue URL
    if (!parsed.hostname.includes('actblue.com') && !parsed.hostname.includes('actblue.co')) {
      return { refcode: null, form: null };
    }
    
    // Extract refcode from query parameter
    const refcode = parsed.searchParams.get('refcode');
    
    // Extract form name from path (e.g., /donate/formname)
    const pathMatch = parsed.pathname.match(/\/donate\/([a-zA-Z0-9_-]+)/i);
    const form = pathMatch ? pathMatch[1] : null;
    
    return { refcode, form };
  } catch {
    return { refcode: null, form: null };
  }
}

/**
 * Resolve a vanity URL by following redirects to find the final destination.
 * Returns the ActBlue refcode if the final URL is an ActBlue donation page.
 * 
 * @param vanityUrl - The vanity URL to resolve (e.g., https://hamawyfornj.org/aama0115)
 * @returns ResolvedUrl with the final URL and extracted refcode
 */
export async function resolveVanityUrl(vanityUrl: string): Promise<ResolvedUrl> {
  const result: ResolvedUrl = {
    finalUrl: null,
    actblueRefcode: null,
    actblueForm: null,
    redirectChain: [vanityUrl],
    success: false,
    error: null,
  };

  if (!vanityUrl) {
    result.error = 'No URL provided';
    return result;
  }

  let currentUrl = vanityUrl;
  let redirectCount = 0;

  try {
    while (redirectCount < MAX_REDIRECTS) {
      const response = await fetchWithTimeout(currentUrl, FETCH_TIMEOUT_MS);
      
      // Check if this is a redirect
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) {
          result.error = `Redirect without location header at ${currentUrl}`;
          break;
        }
        
        // Handle relative URLs
        let nextUrl: string;
        try {
          nextUrl = new URL(location, currentUrl).toString();
        } catch {
          nextUrl = location;
        }
        
        result.redirectChain.push(nextUrl);
        currentUrl = nextUrl;
        redirectCount++;
        
        // Check if we've reached ActBlue
        const actblueInfo = extractActBlueInfo(currentUrl);
        if (actblueInfo.refcode || actblueInfo.form) {
          result.finalUrl = currentUrl;
          result.actblueRefcode = actblueInfo.refcode;
          result.actblueForm = actblueInfo.form;
          result.success = true;
          return result;
        }
      } else if (response.status >= 200 && response.status < 300) {
        // Successful response - this is the final URL
        result.finalUrl = currentUrl;
        
        // Check if it's an ActBlue URL
        const actblueInfo = extractActBlueInfo(currentUrl);
        result.actblueRefcode = actblueInfo.refcode;
        result.actblueForm = actblueInfo.form;
        result.success = true;
        return result;
      } else {
        result.error = `HTTP ${response.status} at ${currentUrl}`;
        break;
      }
    }

    if (redirectCount >= MAX_REDIRECTS) {
      result.error = 'Too many redirects';
    }
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        result.error = `Timeout after ${FETCH_TIMEOUT_MS}ms`;
      } else {
        result.error = error.message;
      }
    } else {
      result.error = 'Unknown error during URL resolution';
    }
  }

  return result;
}

/**
 * Batch resolve multiple vanity URLs with rate limiting.
 * 
 * @param urls - Array of vanity URLs to resolve
 * @param delayMs - Delay between requests to avoid rate limiting (default: 100ms)
 * @returns Map of original URL to resolved result
 */
export async function batchResolveUrls(
  urls: string[],
  delayMs: number = 100
): Promise<Map<string, ResolvedUrl>> {
  const results = new Map<string, ResolvedUrl>();
  
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    
    // Skip if already processed (deduplication)
    if (results.has(url)) continue;
    
    const resolved = await resolveVanityUrl(url);
    results.set(url, resolved);
    
    // Rate limiting delay (skip on last item)
    if (i < urls.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
}
