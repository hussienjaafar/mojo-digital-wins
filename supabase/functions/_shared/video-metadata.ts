/**
 * Video Metadata Utilities for Ad Copy Studio
 *
 * Provides functions for video metadata validation, aspect ratio calculation,
 * and fingerprinting for duplicate detection in the Ad Copy Studio workflow.
 */

// ============================================================================
// Types
// ============================================================================

export interface VideoMetadata {
  duration_sec: number;
  aspect_ratio: string;
  resolution: string;
  codec: string;
  file_size_bytes: number;
  frame_rate?: number;
  bitrate_kbps?: number;
  meets_meta_specs: boolean;
  spec_issues: SpecIssue[];
}

export interface SpecIssue {
  field: string;
  issue: string;
  recommendation: string;
}

export interface VideoFingerprint {
  fingerprint_duration_sec: number;
  fingerprint_transcript_hash: string;
}

// ============================================================================
// Meta Platform Video Requirements (2026)
// ============================================================================

/**
 * Meta Advantage+ and standard video ad requirements
 * Reference: https://www.facebook.com/business/help/103816146375741
 */
const META_REQUIREMENTS = {
  /** Supported video codecs */
  supported_codecs: ['h264', 'hevc', 'vp8', 'vp9'],

  /** Minimum resolution (pixels on shorter side) */
  min_resolution: 1080,

  /** Recommended aspect ratios for different placements */
  recommended_aspects: ['9:16', '1:1', '4:5'],

  /** Maximum duration for Advantage+ catalog ads (seconds) */
  max_duration_advantage_plus: 30,

  /** Minimum video duration (seconds) */
  min_duration: 6,

  /** Maximum file size (4GB) */
  max_file_size_bytes: 4 * 1024 * 1024 * 1024,
} as const;

// ============================================================================
// Aspect Ratio Calculation
// ============================================================================

/**
 * Common aspect ratios with their decimal equivalents
 * Used for matching calculated ratios to standard names
 */
const COMMON_ASPECT_RATIOS: { ratio: string; decimal: number }[] = [
  { ratio: '9:16', decimal: 0.5625 },
  { ratio: '1:1', decimal: 1.0 },
  { ratio: '4:5', decimal: 0.8 },
  { ratio: '16:9', decimal: 1.7778 },
  { ratio: '4:3', decimal: 1.3333 },
  { ratio: '3:2', decimal: 1.5 },
  { ratio: '21:9', decimal: 2.3333 },
  { ratio: '2:3', decimal: 0.6667 },
  { ratio: '3:4', decimal: 0.75 },
];

/**
 * Calculate aspect ratio from video dimensions
 * Returns a standard ratio name (e.g., '9:16', '1:1') or calculated ratio
 *
 * @param width - Video width in pixels
 * @param height - Video height in pixels
 * @returns Aspect ratio string (e.g., '9:16', '16:9', '5:3')
 *
 * @example
 * calculateAspectRatio(1080, 1920) // returns '9:16'
 * calculateAspectRatio(1920, 1080) // returns '16:9'
 * calculateAspectRatio(1000, 1000) // returns '1:1'
 */
export function calculateAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) {
    return 'unknown';
  }

  const decimal = width / height;

  // Find matching common aspect ratio (within 1% tolerance)
  for (const { ratio, decimal: targetDecimal } of COMMON_ASPECT_RATIOS) {
    const tolerance = Math.abs(decimal - targetDecimal) / targetDecimal;
    if (tolerance < 0.01) {
      return ratio;
    }
  }

  // Calculate simplified ratio using GCD
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(Math.round(width), Math.round(height));
  const simplifiedWidth = Math.round(width / divisor);
  const simplifiedHeight = Math.round(height / divisor);

  // Keep ratio reasonable (if numbers are large, use approximation)
  if (simplifiedWidth > 100 || simplifiedHeight > 100) {
    // Approximate to nearest common denominator
    const ratioDecimal = width / height;
    const approxWidth = Math.round(ratioDecimal * 10);
    const approxHeight = 10;
    const approxDivisor = gcd(approxWidth, approxHeight);
    return `${approxWidth / approxDivisor}:${approxHeight / approxDivisor}`;
  }

  return `${simplifiedWidth}:${simplifiedHeight}`;
}

// ============================================================================
// Meta Specs Validation
// ============================================================================

/**
 * Parse resolution string to get dimensions
 * @param resolution - Resolution string like '1920x1080'
 * @returns { width, height } or null if parsing fails
 */
function parseResolution(resolution: string): { width: number; height: number } | null {
  const match = resolution.match(/(\d+)\s*[xX×]\s*(\d+)/);
  if (match) {
    return {
      width: parseInt(match[1], 10),
      height: parseInt(match[2], 10),
    };
  }
  return null;
}

/**
 * Validate video metadata against Meta platform specifications
 *
 * @param metadata - Partial video metadata to validate
 * @returns Object with meets_specs boolean and array of issues
 *
 * @example
 * const result = validateMetaSpecs({
 *   codec: 'h264',
 *   resolution: '1920x1080',
 *   aspect_ratio: '16:9',
 *   duration_sec: 45
 * });
 * // result.meets_specs: false
 * // result.issues: [{ field: 'duration_sec', issue: 'Video exceeds 30 second limit', ... }]
 */
export function validateMetaSpecs(
  metadata: Partial<VideoMetadata>
): { meets_specs: boolean; issues: SpecIssue[] } {
  const issues: SpecIssue[] = [];

  // Validate codec
  if (metadata.codec) {
    const normalizedCodec = metadata.codec.toLowerCase().replace(/[^a-z0-9]/g, '');
    const supportedCodecs = META_REQUIREMENTS.supported_codecs.map((c) =>
      c.toLowerCase().replace(/[^a-z0-9]/g, '')
    );

    if (!supportedCodecs.includes(normalizedCodec)) {
      issues.push({
        field: 'codec',
        issue: `Codec '${metadata.codec}' may not be supported`,
        recommendation: `Use H.264 (recommended), HEVC, VP8, or VP9 codec for best compatibility`,
      });
    }
  }

  // Validate resolution
  if (metadata.resolution) {
    const dimensions = parseResolution(metadata.resolution);
    if (dimensions) {
      const shorterSide = Math.min(dimensions.width, dimensions.height);
      if (shorterSide < META_REQUIREMENTS.min_resolution) {
        issues.push({
          field: 'resolution',
          issue: `Resolution ${metadata.resolution} is below minimum (${META_REQUIREMENTS.min_resolution}p)`,
          recommendation: `Use at least 1080p resolution for optimal ad quality`,
        });
      }
    }
  }

  // Validate aspect ratio
  if (metadata.aspect_ratio) {
    if (!META_REQUIREMENTS.recommended_aspects.includes(metadata.aspect_ratio)) {
      const isAcceptable = ['16:9', '4:3'].includes(metadata.aspect_ratio);
      if (!isAcceptable) {
        issues.push({
          field: 'aspect_ratio',
          issue: `Aspect ratio ${metadata.aspect_ratio} is not optimal for Meta placements`,
          recommendation: `Use 9:16 (Stories/Reels), 1:1 (Feed), or 4:5 (Feed) for best results`,
        });
      }
    }
  }

  // Validate duration
  if (metadata.duration_sec !== undefined) {
    if (metadata.duration_sec < META_REQUIREMENTS.min_duration) {
      issues.push({
        field: 'duration_sec',
        issue: `Video is too short (${metadata.duration_sec}s)`,
        recommendation: `Videos should be at least ${META_REQUIREMENTS.min_duration} seconds for engagement`,
      });
    }

    if (metadata.duration_sec > META_REQUIREMENTS.max_duration_advantage_plus) {
      issues.push({
        field: 'duration_sec',
        issue: `Video exceeds ${META_REQUIREMENTS.max_duration_advantage_plus} second limit for Advantage+ catalog`,
        recommendation: `Keep videos under 30 seconds for Advantage+ catalog placements, or use standard ad formats for longer content`,
      });
    }
  }

  // Validate file size
  if (metadata.file_size_bytes !== undefined) {
    if (metadata.file_size_bytes > META_REQUIREMENTS.max_file_size_bytes) {
      const sizeMB = Math.round(metadata.file_size_bytes / (1024 * 1024));
      const maxGB = Math.round(META_REQUIREMENTS.max_file_size_bytes / (1024 * 1024 * 1024));
      issues.push({
        field: 'file_size_bytes',
        issue: `File size (${sizeMB}MB) exceeds Meta's ${maxGB}GB limit`,
        recommendation: `Compress the video or reduce resolution to meet the file size limit`,
      });
    }
  }

  return {
    meets_specs: issues.length === 0,
    issues,
  };
}

// ============================================================================
// Video Fingerprinting
// ============================================================================

/**
 * Simple hash function for creating transcript fingerprints
 * Uses FNV-1a algorithm for good distribution
 *
 * @param str - String to hash
 * @returns Hash as a base36 string
 */
function simpleHash(str: string): string {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0; // FNV prime, keep as 32-bit unsigned
  }
  return hash.toString(36);
}

/**
 * Normalize transcript text for fingerprinting
 * - Convert to lowercase
 * - Remove non-alphanumeric characters except spaces
 * - Collapse multiple spaces
 *
 * @param text - Raw transcript text
 * @returns Normalized text
 */
function normalizeTranscript(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Generate a fingerprint for matching similar videos
 * Used for duplicate detection when the same video is uploaded multiple times
 *
 * @param duration_sec - Video duration in seconds
 * @param transcript - Video transcript text
 * @returns Fingerprint object with rounded duration and transcript hash
 *
 * @example
 * const fp = generateFingerprint(45.7, 'Hello, I am asking for your support...');
 * // fp.fingerprint_duration_sec: 46
 * // fp.fingerprint_transcript_hash: 'abc123xyz'
 */
export function generateFingerprint(
  duration_sec: number,
  transcript: string
): VideoFingerprint {
  // Round duration to nearest second
  const roundedDuration = Math.round(duration_sec);

  // Normalize and hash transcript
  const normalizedTranscript = normalizeTranscript(transcript);
  const transcriptHash = simpleHash(normalizedTranscript);

  return {
    fingerprint_duration_sec: roundedDuration,
    fingerprint_transcript_hash: transcriptHash,
  };
}

/**
 * Check if two fingerprints match (same video)
 *
 * @param fp1 - First fingerprint
 * @param fp2 - Second fingerprint
 * @returns True if fingerprints match
 */
export function fingerprintsMatch(
  fp1: VideoFingerprint,
  fp2: VideoFingerprint
): boolean {
  return (
    fp1.fingerprint_duration_sec === fp2.fingerprint_duration_sec &&
    fp1.fingerprint_transcript_hash === fp2.fingerprint_transcript_hash
  );
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format duration in seconds to human-readable string
 *
 * @param seconds - Duration in seconds
 * @returns Formatted string like '1:30' or '2:05:30'
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format file size to human-readable string
 *
 * @param bytes - Size in bytes
 * @returns Formatted string like '1.5 MB' or '500 KB'
 */
export function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
