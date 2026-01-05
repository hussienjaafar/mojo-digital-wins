/**
 * Robust XML/RSS/Atom Parser for Edge Functions
 * Uses regex-based parsing optimized for Deno environment
 */

export interface FeedItem {
  title: string;
  description: string;
  link: string;
  pubDate: string;
  imageUrl: string | null;
  author?: string;
  categories?: string[];
  guid?: string;
}

export interface ParsedFeed {
  title: string;
  description: string;
  link: string;
  items: FeedItem[];
  feedType: 'rss' | 'atom' | 'unknown';
}

/**
 * Sanitize text content - remove HTML, decode entities
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  
  let decoded = text
    // HTML entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&hellip;/g, '\u2026')
    // Numeric entities
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  
  // Strip HTML tags
  decoded = decoded.replace(/<[^>]*>/g, '');
  
  // Remove CDATA wrappers
  decoded = decoded.replace(/<!\[CDATA\[|\]\]>/g, '');
  
  // Remove control characters
  decoded = decoded.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
  
  // Collapse whitespace
  decoded = decoded.replace(/\s+/g, ' ').trim();
  
  return decoded;
}

/**
 * Parse a date string into ISO format
 */
export function parseDate(dateStr: string | null | undefined): string {
  if (!dateStr) return new Date().toISOString();
  
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString();
    }
  } catch {
    // Fall through
  }
  
  return new Date().toISOString();
}

/**
 * Extract text content between XML tags (handles CDATA)
 */
function extractTagContent(xml: string, tagName: string): string {
  // Match tag with possible namespaces and attributes
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xml.match(regex);
  if (!match) return '';
  
  let content = match[1];
  
  // Handle CDATA sections
  const cdataMatch = content.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdataMatch) {
    return cdataMatch[1].trim();
  }
  
  return content.trim();
}

/**
 * Extract attribute value from a tag
 */
function extractAttribute(xml: string, tagName: string, attrName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*${attrName}=["']([^"']+)["']`, 'i');
  const match = xml.match(regex);
  return match ? match[1] : '';
}

/**
 * Extract image URL from various feed formats
 */
function extractImageUrl(itemXml: string): string | null {
  // Try media:thumbnail
  let url = extractAttribute(itemXml, 'media:thumbnail', 'url');
  if (url) return url;
  
  // Try media:content with image type
  const mediaContent = itemXml.match(/<media:content[^>]+url=["']([^"']+)["'][^>]*>/i);
  if (mediaContent && (mediaContent[0].includes('image') || mediaContent[1].match(/\.(jpg|jpeg|png|gif|webp)/i))) {
    return mediaContent[1];
  }
  
  // Try enclosure
  const enclosure = itemXml.match(/<enclosure[^>]+type=["'][^"']*image[^"']*["'][^>]+url=["']([^"']+)["']/i) ||
                    itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]+type=["'][^"']*image/i);
  if (enclosure) return enclosure[1];
  
  // Try og:image or image tag
  const imageTag = extractTagContent(itemXml, 'image');
  if (imageTag && imageTag.startsWith('http')) return imageTag;
  
  // Try to extract from description/content
  const description = extractTagContent(itemXml, 'description') || extractTagContent(itemXml, 'content:encoded');
  const imgMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];
  
  return null;
}

/**
 * Extract all categories from an item
 */
function extractCategories(itemXml: string): string[] {
  const categories: string[] = [];
  const categoryRegex = /<category[^>]*>([^<]+)<\/category>/gi;
  let match;
  
  while ((match = categoryRegex.exec(itemXml)) !== null) {
    const cat = sanitizeText(match[1]);
    if (cat && !categories.includes(cat)) {
      categories.push(cat);
    }
  }
  
  // Also try term attribute (Atom style)
  const termRegex = /<category[^>]+term=["']([^"']+)["']/gi;
  while ((match = termRegex.exec(itemXml)) !== null) {
    const cat = sanitizeText(match[1]);
    if (cat && !categories.includes(cat)) {
      categories.push(cat);
    }
  }
  
  return categories;
}

/**
 * Parse RSS 2.0 feed items
 */
function parseRSSItems(text: string): FeedItem[] {
  const items: FeedItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  
  while ((match = itemRegex.exec(text)) !== null) {
    const itemXml = match[1];
    
    const title = sanitizeText(extractTagContent(itemXml, 'title'));
    const description = sanitizeText(
      extractTagContent(itemXml, 'description') || 
      extractTagContent(itemXml, 'content:encoded')
    );
    const link = extractTagContent(itemXml, 'link') || extractAttribute(itemXml, 'link', 'href');
    const pubDate = parseDate(extractTagContent(itemXml, 'pubDate') || extractTagContent(itemXml, 'dc:date'));
    const imageUrl = extractImageUrl(itemXml);
    const author = sanitizeText(extractTagContent(itemXml, 'author') || extractTagContent(itemXml, 'dc:creator'));
    const guid = extractTagContent(itemXml, 'guid');
    const categories = extractCategories(itemXml);
    
    if (title && link) {
      items.push({
        title,
        description: description.substring(0, 1000),
        link,
        pubDate,
        imageUrl,
        author: author || undefined,
        guid: guid || undefined,
        categories: categories.length > 0 ? categories : undefined,
      });
    }
  }
  
  return items;
}

/**
 * Parse Atom feed entries
 */
function parseAtomEntries(text: string): FeedItem[] {
  const items: FeedItem[] = [];
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/gi;
  let match;
  
  while ((match = entryRegex.exec(text)) !== null) {
    const entryXml = match[1];
    
    const title = sanitizeText(extractTagContent(entryXml, 'title'));
    const description = sanitizeText(
      extractTagContent(entryXml, 'summary') || 
      extractTagContent(entryXml, 'content')
    );
    
    // Atom links use href attribute
    let link = extractAttribute(entryXml, 'link', 'href');
    if (!link) {
      // Try to find alternate link
      const altLinkMatch = entryXml.match(/<link[^>]+rel=["']alternate["'][^>]+href=["']([^"']+)["']/i) ||
                           entryXml.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']alternate["']/i);
      if (altLinkMatch) link = altLinkMatch[1];
    }
    
    const pubDate = parseDate(
      extractTagContent(entryXml, 'published') || 
      extractTagContent(entryXml, 'updated')
    );
    const imageUrl = extractImageUrl(entryXml);
    const author = sanitizeText(extractTagContent(entryXml, 'name')); // Inside <author><name>
    const guid = extractTagContent(entryXml, 'id');
    const categories = extractCategories(entryXml);
    
    if (title && link) {
      items.push({
        title,
        description: description.substring(0, 1000),
        link,
        pubDate,
        imageUrl,
        author: author || undefined,
        guid: guid || undefined,
        categories: categories.length > 0 ? categories : undefined,
      });
    }
  }
  
  return items;
}

/**
 * Parse an RSS or Atom feed from XML text
 */
export function parseFeed(xmlText: string): ParsedFeed {
  // Detect feed type
  const isAtom = xmlText.includes('<feed') && xmlText.includes('xmlns="http://www.w3.org/2005/Atom"');
  const isRSS = xmlText.includes('<rss') || xmlText.includes('<channel>');
  
  if (isAtom) {
    // Parse Atom feed
    const feedTitle = sanitizeText(extractTagContent(xmlText, 'title'));
    const feedDescription = sanitizeText(extractTagContent(xmlText, 'subtitle'));
    const feedLink = extractAttribute(xmlText, 'link', 'href');
    const items = parseAtomEntries(xmlText);
    
    return {
      title: feedTitle,
      description: feedDescription,
      link: feedLink,
      items,
      feedType: 'atom',
    };
  } else if (isRSS) {
    // Parse RSS feed
    const channelMatch = xmlText.match(/<channel>([\s\S]*?)<\/channel>/i);
    const channelXml = channelMatch ? channelMatch[1] : xmlText;
    
    const feedTitle = sanitizeText(extractTagContent(channelXml, 'title'));
    const feedDescription = sanitizeText(extractTagContent(channelXml, 'description'));
    const feedLink = extractTagContent(channelXml, 'link');
    const items = parseRSSItems(xmlText);
    
    return {
      title: feedTitle,
      description: feedDescription,
      link: feedLink,
      items,
      feedType: 'rss',
    };
  }
  
  console.warn('Unknown feed format');
  return {
    title: '',
    description: '',
    link: '',
    items: [],
    feedType: 'unknown',
  };
}

/**
 * Fetch and parse a feed from a URL
 */
export async function fetchAndParseFeed(
  url: string,
  options: { timeout?: number } = {}
): Promise<ParsedFeed> {
  const { timeout = 15000 } = options;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/rss+xml, application/xml, text/xml, application/atom+xml',
        'User-Agent': 'NewsAggregator/1.0',
      },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const text = await response.text();
    return parseFeed(text);
  } finally {
    clearTimeout(timeoutId);
  }
}
