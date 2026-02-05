/**
 * Google Drive Utilities for Ad Copy Studio
 *
 * Provides functions for parsing Google Drive URLs, fetching file metadata,
 * and downloading video files for the Ad Copy Studio workflow.
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
const VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v'];

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
// File Metadata Functions
// ============================================================================

/**
 * Fetch file metadata from Google Drive API
 * Validates that the file is a video and within size limits
 *
 * @param fileId - Google Drive file ID
 * @returns File metadata including name, MIME type, and size
 * @throws GDriveError for various failure conditions
 *
 * @example
 * const metadata = await getFileMetadata('1abc123xyz');
 * console.log(metadata.name); // 'campaign_video.mp4'
 */
export async function getFileMetadata(fileId: string): Promise<GDriveFileMetadata> {
  const apiKey = Deno.env.get('GOOGLE_API_KEY');
  if (!apiKey) {
    throw new GDriveError(
      'NETWORK_ERROR',
      'Google API key not configured',
      'Please contact support to configure Google Drive integration'
    );
  }

  const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?key=${apiKey}&fields=name,mimeType,size`;

  let response: Response;
  try {
    response = await fetch(metadataUrl);
  } catch (error) {
    throw new GDriveError(
      'NETWORK_ERROR',
      `Failed to connect to Google Drive: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'Please check your internet connection and try again'
    );
  }

  if (!response.ok) {
    const errorCode = mapStatusToErrorCode(response.status);

    let suggestion: string;
    switch (errorCode) {
      case 'FILE_NOT_FOUND':
        suggestion = 'Please verify the file exists and the URL is correct';
        break;
      case 'ACCESS_DENIED':
        suggestion = 'Please ensure the file is shared with "Anyone with the link" permission';
        break;
      case 'RATE_LIMITED':
        suggestion = 'Too many requests. Please wait a moment and try again';
        break;
      default:
        suggestion = 'Please try again later';
    }

    throw new GDriveError(
      errorCode,
      `Failed to fetch file metadata: HTTP ${response.status}`,
      suggestion
    );
  }

  let data: { name?: string; mimeType?: string; size?: string };
  try {
    data = await response.json();
  } catch {
    throw new GDriveError(
      'NETWORK_ERROR',
      'Invalid response from Google Drive API',
      'Please try again later'
    );
  }

  const { name, mimeType, size } = data;

  if (!name || !mimeType || !size) {
    throw new GDriveError(
      'FILE_NOT_SHARED',
      'Could not retrieve file information',
      'Please ensure the file is shared with "Anyone with the link" permission'
    );
  }

  // Validate MIME type
  if (!VIDEO_MIME_TYPES.includes(mimeType)) {
    throw new GDriveError(
      'WRONG_FILE_TYPE',
      `Unsupported file type: ${mimeType}`,
      `Please upload a video file. Supported formats: MP4, QuickTime (MOV), WebM, M4V`
    );
  }

  // Validate file size
  const fileSizeBytes = parseInt(size, 10);
  if (fileSizeBytes > MAX_FILE_SIZE) {
    const sizeMB = Math.round(fileSizeBytes / (1024 * 1024));
    const maxMB = Math.round(MAX_FILE_SIZE / (1024 * 1024));
    throw new GDriveError(
      'FILE_TOO_LARGE',
      `File size (${sizeMB}MB) exceeds maximum allowed (${maxMB}MB)`,
      'Please upload a smaller video file or compress the video'
    );
  }

  return {
    name,
    mimeType,
    size: fileSizeBytes,
  };
}

// ============================================================================
// File Download Functions
// ============================================================================

/**
 * Download a file from Google Drive
 * Handles the virus scan confirmation for files >100MB
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
  // First get metadata to verify file and get filename
  const metadata = await getFileMetadata(fileId);

  // Download URL - use direct download endpoint
  const downloadUrl = `https://drive.google.com/uc?id=${fileId}&export=download`;

  let response: Response;
  try {
    response = await fetch(downloadUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AdCopyStudio/1.0)',
      },
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

    // Extract the confirmation token from the download warning page
    const confirmMatch = html.match(/confirm=([a-zA-Z0-9_-]+)/);
    const uuidMatch = html.match(/uuid=([a-zA-Z0-9_-]+)/);

    if (confirmMatch) {
      // Retry with confirmation token
      const confirmToken = confirmMatch[1];
      const uuid = uuidMatch ? uuidMatch[1] : '';

      const confirmedUrl = `https://drive.google.com/uc?id=${fileId}&export=download&confirm=${confirmToken}${uuid ? `&uuid=${uuid}` : ''}`;

      let retryResponse: Response;
      try {
        retryResponse = await fetch(confirmedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AdCopyStudio/1.0)',
          },
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

      const blob = await retryResponse.blob();
      return { blob, filename: metadata.name };
    }

    // Could not find confirmation token - likely access denied
    if (html.includes('Access Denied') || html.includes('No permission')) {
      throw new GDriveError(
        'ACCESS_DENIED',
        'Access denied when downloading file',
        'Please ensure the file is shared with "Anyone with the link" permission'
      );
    }

    throw new GDriveError(
      'VIRUS_SCAN_TIMEOUT',
      'Could not bypass Google Drive virus scan',
      'Please download the file manually and upload directly'
    );
  }

  if (!response.ok) {
    throw new GDriveError(
      mapStatusToErrorCode(response.status),
      `Failed to download file: HTTP ${response.status}`,
      'Please try again later'
    );
  }

  const blob = await response.blob();
  return { blob, filename: metadata.name };
}
