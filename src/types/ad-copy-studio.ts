/**
 * Ad Copy Studio Types - Type definitions for the Ad Copy Studio wizard
 *
 * This module provides comprehensive TypeScript types for the multi-step
 * wizard that enables video upload, transcript analysis, campaign configuration,
 * and AI-powered ad copy generation.
 */

// ============================================================================
// 1. Wizard Types
// ============================================================================

export type AdCopyStudioStep = 1 | 2 | 3 | 4 | 5;
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface WizardStepConfig {
  step: AdCopyStudioStep;
  title: string;
  description: string;
  icon: string; // lucide icon name
}

export const WIZARD_STEPS: WizardStepConfig[] = [
  { step: 1, title: 'Upload', description: 'Upload campaign videos', icon: 'Upload' },
  { step: 2, title: 'Review', description: 'Review transcripts & analysis', icon: 'FileText' },
  { step: 3, title: 'Configure', description: 'Configure campaign settings', icon: 'Settings' },
  { step: 4, title: 'Generate', description: 'Generate ad copy', icon: 'Sparkles' },
  { step: 5, title: 'Export', description: 'Review & export copy', icon: 'Download' },
];

// ============================================================================
// 2. Video Types
// ============================================================================

export interface VideoUpload {
  id: string;
  file: File | null;
  gdrive_url?: string;
  source: 'uploaded' | 'gdrive';
  filename: string;
  file_size_bytes: number;
  status: 'pending' | 'uploading' | 'extracting' | 'transcribing' | 'analyzing' | 'ready' | 'error';
  progress: number;
  error_message?: string;
  video_id?: string;
  transcript_id?: string;
  duration_sec?: number;
  aspect_ratio?: string;
  resolution?: string;
  codec?: string;
  meets_meta_specs?: boolean;
  meta_spec_issues?: SpecIssue[];
  // Audio extraction diagnostics
  extractionStage?: 'loading' | 'reading' | 'writing' | 'copy-attempt' | 'reencode' | 'finalizing';
  extractionStartTime?: number;
  extractionElapsedMs?: number;
  extractionMode?: 'copy' | 'reencode';
  extractionDiagnostics?: any; // DiagnosticsReport from audio-extractor
  // Real-time extraction message (from progress callback)
  extractionMessage?: string;
  // Transcription timing (for stuck detection - works even after refresh)
  transcriptionStartTime?: number;
  // Backend updated_at timestamp (ISO string from DB, used to restore transcriptionStartTime after refresh)
  backendUpdatedAt?: string;
}

export interface SpecIssue {
  field: string;
  issue: string;
  recommendation: string;
}

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

// ============================================================================
// 3. Transcript & Analysis Types
// ============================================================================

export interface TranscriptAnalysis {
  transcript_text: string;
  issue_primary: string;
  issue_tags: string[];
  political_stances: string[];
  targets_attacked: string[];
  targets_supported: string[];
  policy_positions: string[];
  donor_pain_points: string[];
  values_appealed: string[];
  urgency_drivers: string[];
  topic_primary: string;
  topic_tags: string[];
  tone_primary: string;
  tone_tags: string[];
  sentiment_score: number;
  urgency_level: string;
  key_phrases: string[];
  cta_text?: string;
  // Context and reanalysis tracking
  user_context_pre?: string;
  user_context_post?: string;
  analysis_count?: number;
  last_analyzed_at?: string;
  // Hallucination detection
  hallucination_risk?: number;
  transcription_confidence?: number;
}

// ============================================================================
// 4. Campaign Configuration Types
// ============================================================================

export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
}

export interface CampaignConfig {
  actblue_form_name: string;
  refcode: string;
  refcode_auto_generated: boolean;
  refcodes: Record<string, string>; // videoId -> per-video refcode
  amount_preset?: number;
  recurring_default: boolean;
  audience_segments: AudienceSegment[];
}

// ============================================================================
// 5. Copy Generation Types
// ============================================================================

export interface GeneratedCopy {
  [segmentName: string]: SegmentCopy;
}

export interface SegmentCopy {
  primary_texts: string[];
  headlines: string[];
  descriptions: string[];
  validation?: CopyValidation;
}

export interface CopyValidation {
  primary_texts_valid: boolean[];
  headlines_valid: boolean[];
  descriptions_valid: boolean[];
}

export interface MetaReadyCopy {
  [segmentName: string]: {
    variations: MetaCopyVariation[];
  };
}

export interface MetaCopyVariation {
  primary_text: string;
  headline: string;
  description: string;
  call_to_action_type: 'DONATE_NOW' | 'LEARN_MORE' | 'SIGN_UP';
  destination_url: string;
  char_counts: {
    primary: number;
    headline: number;
    description: number;
  };
  meets_meta_specs: boolean;
}

export const META_COPY_LIMITS = {
  primary_text_visible: 125,
  primary_text_max: 2200,
  headline_max: 40,
  headline_recommended: 27,
  description_max: 30,
  description_recommended: 25,
} as const;

// ============================================================================
// 6. Session State Types
// ============================================================================

export interface AdCopyStudioSession {
  id: string;
  organization_id: string;
  user_id: string;
  current_step: AdCopyStudioStep;
  batch_id: string;
  video_ids: string[];
  transcript_ids: string[];
  step_data: SessionStepData;
  completed_steps: AdCopyStudioStep[];
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

// Per-video generation results (keyed by video_id)
export type PerVideoGeneratedCopy = Record<string, GeneratedCopy>;
export type PerVideoMetaReadyCopy = Record<string, MetaReadyCopy>;

// ============================================================================
// 6b. Feedback Types
// ============================================================================

export type CopyElementType = 'primary_text' | 'headline' | 'description';

export interface VariationFeedback {
  feedback: string;
  timestamp: string;
  previous_text: string;
  new_text: string;
}

/** Keyed by "videoId-segmentName-elementType-variationIndex" */
export type FeedbackHistory = Record<string, VariationFeedback[]>;

export interface SessionStepData {
  videos?: VideoUpload[];
  analyses?: Record<string, TranscriptAnalysis>;
  transcriptIds?: Record<string, string>;
  config?: CampaignConfig;
  generated_copy?: GeneratedCopy;
  per_video_generated_copy?: PerVideoGeneratedCopy;
  per_video_meta_ready_copy?: PerVideoMetaReadyCopy;
  generation_id?: string;
  tracking_url?: string;
  per_video_tracking_urls?: Record<string, string>;
  feedback_history?: FeedbackHistory;
}

// ============================================================================
// 7. API Types
// ============================================================================

export interface ImportGDriveRequest {
  organization_id: string;
  gdrive_urls: string[];
  batch_id?: string;
}

export interface ImportGDriveResponse {
  success: boolean;
  results: GDriveImportResult[];
}

export interface GDriveImportResult {
  url: string;
  status: 'success' | 'error';
  video_id?: string;
  filename?: string;
  file_size_bytes?: number;
  error_code?: GDriveErrorCode;
  error_message?: string;
  suggestion?: string;
}

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

export interface GenerateAdCopyRequest {
  organization_id: string;
  transcript_id: string;
  video_id?: string;
  audience_segments: AudienceSegment[];
  actblue_form_name: string;
  refcode: string;
  amount_preset?: number;
  recurring_default?: boolean;
}

export interface GenerateAdCopyResponse {
  success: boolean;
  generation_id: string;
  generated_copy: GeneratedCopy;
  meta_ready_copy: MetaReadyCopy;
  tracking_url: string;
  generated_at: string;
}
