/**
 * Google Drive Utilities for Ad Copy Studio
 *
 * Provides functions for parsing Google Drive URLs and downloading video files
 * for the Ad Copy Studio workflow. Works with publicly shared links without
 * requiring a Google API key.
 */

// ============================================================================
// Error Types
// ============================================================================

export type GDriveErrorCode =
  | 'INVALID_URL'
  | 'FILE_NOT_SHARED'
  | 'FILE_NOT_FOUND'
  | 'ACCESS_DENIED'
  | 'WRONG_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'VIRUS_SCAN_TIMEOUT'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR';

export class GDriveError extends Error {
  constructor(
    public code: GDriveErrorCode,
    message: string,
    public suggestion?: string
  ) {
    super(message);
    this.name = 'GDriveError';
  }
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Supported Google Drive URL patterns
 * Matches various forms of Google Drive file links
 */
const GDRIVE_PATTERNS = [
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/,
  /docs\.google\.com\/.*\/d\/([a-zA-Z0-9_-]+)/,
];

/**
 * Video MIME types supported for ad copy generation
 */
const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'video/mpeg',
  'video/x-msvideo',
  'application/octet-stream', // Sometimes returned for video files
];

/**
 * Video file extensions (used when MIME type is generic)
 */
const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.webm', '.m4v', '.mpeg', '.avi'];

/**
 * Maximum file size: 500MB
 * Google Drive has a 5TB limit, but we restrict for practical processing
 */
const MAX_FILE_SIZE = 500 * 1024 * 1024;

// ============================================================================
// File Metadata Interface
// ============================================================================

export interface GDriveFileMetadata {
  name: string;
  mimeType: string;
  size: number;
}

export interface GDriveDownloadResult {
  blob: Blob;
  filename: string;
}

// ============================================================================
// URL Parsing Functions
// ============================================================================

/**
 * Extract file ID from a Google Drive URL
 * Supports multiple URL formats used by Google Drive
 *
 * @param url - Google Drive URL
 * @returns The extracted file ID
 * @throws GDriveError if URL format is not recognized
 *
 * @example
 * extractFileId('https://drive.google.com/file/d/1abc123xyz/view') // returns '1abc123xyz'
 * extractFileId('https://drive.google.com/open?id=1abc123xyz') // returns '1abc123xyz'
 */
export function extractFileId(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new GDriveError(
      'INVALID_URL',
      'URL is required',
      'Please provide a valid Google Drive URL'
    );
  }

  const trimmedUrl = url.trim();

  for (const pattern of GDRIVE_PATTERNS) {
    const match = trimmedUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  throw new GDriveError(
    'INVALID_URL',
    `Could not extract file ID from URL: ${trimmedUrl}`,
    'Please use a standard Google Drive share link (e.g., https://drive.google.com/file/d/FILE_ID/view)'
  );
}

// ============================================================================
// HTTP Status to Error Code Mapping
// ============================================================================

/**
 * Map HTTP status codes to appropriate GDrive error codes
 *
 * @param status - HTTP status code
 * @returns Corresponding GDriveErrorCode
 */
export function mapStatusToErrorCode(status: number): GDriveErrorCode {
  switch (status) {
    case 401:
    case 403:
      return 'ACCESS_DENIED';
    case 404:
      return 'FILE_NOT_FOUND';
    case 429:
      return 'RATE_LIMITED';
    default:
      if (status >= 500) {
        return 'NETWORK_ERROR';
      }
      return 'NETWORK_ERROR';
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract filename from Content-Disposition header
 * @param header - Content-Disposition header value
 * @returns Extracted filename or null
 */
function extractFilenameFromHeader(header: string | null): string | null {
  if (!header) return null;

  // Try filename*= (RFC 5987) first - handles UTF-8 encoded filenames
  const utf8Match = header.match(/filename\*=(?:UTF-8''|utf-8'')([^;]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      // Fall through to other methods
    }
  }

  // Try filename="..."
  const quotedMatch = header.match(/filename="([^"]+)"/);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // Try filename=... (unquoted)
  const unquotedMatch = header.match(/filename=([^;\s]+)/);
  if (unquotedMatch) {
    return unquotedMatch[1];
  }

  return null;
}

/**
 * Check if a file appears to be a video based on MIME type or extension
 */
function isVideoFile(mimeType: string | null, filename: string): boolean {
  // Check MIME type
  if (mimeType && VIDEO_MIME_TYPES.some(t => mimeType.toLowerCase().includes(t.split('/')[1]))) {
    return true;
  }

  // Check file extension
  const lowerFilename = filename.toLowerCase();
  return VIDEO_EXTENSIONS.some(ext => lowerFilename.endsWith(ext));
}

// ============================================================================
// File Download Functions
// ============================================================================

/**
 * Standard headers for Google Drive requests
 */
const GDRIVE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
};

/**
 * Try to download file using a specific URL
 * Returns null if the response is HTML (not the actual file)
 */
async function tryDownload(url: string): Promise<Response | null> {
  try {
    const response = await fetch(url, {
      headers: GDRIVE_HEADERS,
      redirect: 'follow',
    });

    if (!response.ok) {
      console.log(`[gdrive] URL returned ${response.status}: ${url.substring(0, 80)}...`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      // Got HTML instead of file - not successful
      return null;
    }

    return response;
  } catch (error) {
    console.log(`[gdrive] Fetch failed for URL: ${error instanceof Error ? error.message : 'Unknown'}`);
    return null;
  }
}

/**
 * Download a file from Google Drive using public share link
 * Works without requiring a Google API key for publicly shared files.
 * Uses multiple download strategies for reliability.
 *
 * @param fileId - Google Drive file ID
 * @returns The downloaded file as a Blob with filename
 * @throws GDriveError for various failure conditions
 *
 * @example
 * const { blob, filename } = await downloadFromGDrive('1abc123xyz');
 * // blob is the video file content
 * // filename is 'campaign_video.mp4'
 */
export async function downloadFromGDrive(fileId: string): Promise<GDriveDownloadResult> {
  console.log(`[gdrive] Attempting download for file ID: ${fileId}`);

  // Strategy 1: Try direct download with confirm=t (works for many files)
  const directUrls = [
    `https://drive.google.com/uc?id=${fileId}&export=download&confirm=t`,
    `https://drive.google.com/uc?id=${fileId}&export=download&confirm=yes`,
    `https://drive.google.com/uc?id=${fileId}&export=download`,
  ];

  let response: Response | null = null;

  for (const url of directUrls) {
    console.log(`[gdrive] Trying: ${url.substring(0, 70)}...`);
    response = await tryDownload(url);
    if (response) {
      console.log(`[gdrive] Direct download succeeded`);
      break;
    }
  }

  // Strategy 2: If direct download failed, fetch the warning page and extract token
  if (!response) {
    console.log(`[gdrive] Direct downloads failed, trying to extract confirmation token`);

    const warningUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;
    let warningResponse: Response;

    try {
      warningResponse = await fetch(warningUrl, {
        headers: GDRIVE_HEADERS,
        redirect: 'follow',
      });
    } catch (error) {
      throw new GDriveError(
        'NETWORK_ERROR',
        `Failed to connect to Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'Please check your internet connection and try again'
      );
    }

    const html = await warningResponse.text();

    // Check for access denied
    if (html.includes('Access Denied') || html.includes('No permission') ||
        html.includes('Sign in') || html.includes('Request access')) {
      throw new GDriveError(
        'ACCESS_DENIED',
        'Access denied when downloading file',
        'Please ensure the file is shared with "Anyone with the link" permission'
      );
    }

    // Try multiple patterns to extract download link or confirmation
    const patterns = [
      // Direct download link in href
      /href="(\/uc\?export=download[^"]+)"/,
      /href='(\/uc\?export=download[^']+)'/,
      // Download URL with confirm parameter
      /"downloadUrl":"([^"]+)"/,
      // Confirm token patterns
      /confirm=([a-zA-Z0-9_-]{4,})&/,
      /confirm=([a-zA-Z0-9_-]{4,})"/,
      /name="confirm" value="([^"]+)"/,
      /"confirm":"([^"]+)"/,
      /\?confirm=([^&"']+)/,
    ];

    let downloadLink: string | null = null;

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        const captured = match[1];

        if (captured.startsWith('/uc') || captured.startsWith('http')) {
          // It's a full or partial URL
          downloadLink = captured.startsWith('http')
            ? captured
            : `https://drive.google.com${captured}`;
        } else {
          // It's a confirmation token
          downloadLink = `https://drive.google.com/uc?id=${fileId}&export=download&confirm=${captured}`;
        }

        console.log(`[gdrive] Found download link/token with pattern: ${pattern.source.substring(0, 30)}...`);
        break;
      }
    }

    // Also try to find uuid for some versions
    const uuidMatch = html.match(/uuid=([a-zA-Z0-9_-]+)/);

    if (downloadLink) {
      if (uuidMatch && !downloadLink.includes('uuid=')) {
        downloadLink += `&uuid=${uuidMatch[1]}`;
      }

      // Unescape HTML entities
      downloadLink = downloadLink.replace(/&amp;/g, '&');

      console.log(`[gdrive] Trying extracted link: ${downloadLink.substring(0, 80)}...`);
      response = await tryDownload(downloadLink);
    }

    // Strategy 3: Try with a generic confirm token
    if (!response) {
      const genericUrls = [
        `https://drive.google.com/uc?id=${fileId}&export=download&confirm=t&uuid=${uuidMatch?.[1] || ''}`,
        `https://drive.google.com/uc?id=${fileId}&export=download&confirm=download`,
        `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`,
      ];

      for (const url of genericUrls) {
        console.log(`[gdrive] Trying fallback: ${url.substring(0, 70)}...`);
        response = await tryDownload(url);
        if (response) break;
      }
    }
  }

  // If still no response, we couldn't download the file
  if (!response) {
    throw new GDriveError(
      'VIRUS_SCAN_TIMEOUT',
      'Could not download file from Google Drive',
      'The file may be too large for automatic download. Please download it manually and upload directly, or try a smaller file.'
    );
  }

  // Extract filename from Content-Disposition header
  const contentDisposition = response.headers.get('content-disposition');
  let filename = extractFilenameFromHeader(contentDisposition);

  // Fallback filename if not found in header
  if (!filename) {
    filename = `gdrive_${fileId}.mp4`;
    console.log(`[gdrive] No filename in headers, using fallback: ${filename}`);
  }

  // Get content type for validation
  const finalContentType = response.headers.get('content-type') || '';

  // Validate it's a video file
  if (!isVideoFile(finalContentType, filename)) {
    throw new GDriveError(
      'WRONG_FILE_TYPE',
      `File does not appear to be a video: ${filename} (${finalContentType})`,
      'Please upload a video file. Supported formats: MP4, MOV, WebM, M4V'
    );
  }

  // Download the blob
  const blob = await response.blob();

  // Validate file size
  if (blob.size > MAX_FILE_SIZE) {
    const sizeMB = Math.round(blob.size / (1024 * 1024));
    const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
    throw new GDriveError(
      'FILE_TOO_LARGE',
      `File size (${sizeMB}MB) exceeds maximum allowed (${maxMB}MB)`,
      'Please upload a smaller video file or compress the video'
    );
  }

  // Final sanity check - blob shouldn't be tiny (likely an error page)
  if (blob.size < 1000) {
    throw new GDriveError(
      'NETWORK_ERROR',
      'Downloaded file is too small - likely an error occurred',
      'Please verify the file exists and try again'
    );
  }

  console.log(`[gdrive] Successfully downloaded: ${filename} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);

  return { blob, filename };
}
