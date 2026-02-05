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
 * Download a file from Google Drive using public share link
 * Works without requiring a Google API key for publicly shared files.
 * Handles the virus scan confirmation for files >100MB.
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
  // Download URL - use direct download endpoint (works for public files without API key)
  const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;

  console.log(`[gdrive] Attempting download for file ID: ${fileId}`);

  let response: Response;
  try {
    response = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    });
  } catch (error) {
    throw new GDriveError(
      'NETWORK_ERROR',
      `Failed to download file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'Please check your internet connection and try again'
    );
  }

  // For files >100MB, Google shows a virus scan warning page
  // We need to extract the confirmation token and retry
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('text/html')) {
    // This is the virus scan warning page
    const html = await response.text();

    // Check for access denied
    if (html.includes('Access Denied') || html.includes('No permission') || html.includes('Sign in')) {
      throw new GDriveError(
        'ACCESS_DENIED',
        'Access denied when downloading file',
        'Please ensure the file is shared with "Anyone with the link" permission'
      );
    }

    // Extract the confirmation token from the download warning page
    // Google uses different patterns, try multiple
    const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/) ||
                         html.match(/confirm=([^&"]+)/) ||
                         html.match(/"confirm":"([^"]+)"/);
    const uuidMatch = html.match(/uuid=([a-zA-Z0-9_-]+)/);

    if (confirmMatch) {
      // Retry with confirmation token
      const confirmToken = confirmMatch[1];
      const uuid = uuidMatch ? uuidMatch[1] : '';

      console.log(`[gdrive] Large file detected, retrying with confirmation token`);

      const confirmedUrl = `https://drive.google.com/uc?id=${fileId}&export=download&confirm=${confirmToken}${uuid ? `&uuid=${uuid}` : ''}`;

      let retryResponse: Response;
      try {
        retryResponse = await fetch(confirmedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          redirect: 'follow',
        });
      } catch (error) {
        throw new GDriveError(
          'NETWORK_ERROR',
          `Failed to download file after confirmation: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'Please try again later'
        );
      }

      if (!retryResponse.ok) {
        throw new GDriveError(
          mapStatusToErrorCode(retryResponse.status),
          `Failed to download file: HTTP ${retryResponse.status}`,
          'Please try again later'
        );
      }

      // Check if we still got HTML (virus scan timeout or other issue)
      const retryContentType = retryResponse.headers.get('content-type') || '';
      if (retryContentType.includes('text/html')) {
        throw new GDriveError(
          'VIRUS_SCAN_TIMEOUT',
          'Google Drive virus scan is taking too long',
          'Please try again in a few minutes, or download the file manually and upload directly'
        );
      }

      response = retryResponse;
    } else {
      // No confirmation token found - might be a different error
      if (html.includes('too large') || html.includes('virus scan')) {
        throw new GDriveError(
          'VIRUS_SCAN_TIMEOUT',
          'Could not bypass Google Drive virus scan',
          'Please download the file manually and upload directly'
        );
      }

      throw new GDriveError(
        'FILE_NOT_FOUND',
        'File not found or not accessible',
        'Please verify the file exists and is shared with "Anyone with the link" permission'
      );
    }
  }

  if (!response.ok) {
    throw new GDriveError(
      mapStatusToErrorCode(response.status),
      `Failed to download file: HTTP ${response.status}`,
      'Please try again later'
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

  console.log(`[gdrive] Successfully downloaded: ${filename} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);

  return { blob, filename };
}
