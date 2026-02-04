# Ad Copy Studio Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a tool for system admins to upload video ads, transcribe/analyze them, and generate high-converting Meta ad copy variations for different audience segments.

**Architecture:** A 5-step wizard (Upload → Review → Configure → Generate → Export) using React with TypeScript. State persisted to Supabase. Edge functions handle video import, transcription reuse, and GPT-4 copy generation. Follows existing OnboardingWizard patterns for UI consistency.

**Tech Stack:** React 18 + TypeScript, Supabase (PostgreSQL + Edge Functions), OpenAI Whisper + GPT-4, TanStack Query, Framer Motion, shadcn/ui components

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260204000000_ad_copy_studio.sql`

**Step 1: Create the migration file with schema changes**

```sql
-- Ad Copy Studio Schema Migration
-- Adds support for video uploads, copy generation, and organization Meta settings

-- =============================================================================
-- Extend meta_ad_videos table for uploaded videos
-- =============================================================================

ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'meta_synced'
  CHECK (source IN ('uploaded', 'meta_synced', 'gdrive'));
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS fingerprint_duration_sec INTEGER;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS fingerprint_transcript_hash TEXT;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS matched_meta_ad_id TEXT;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id);
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS original_filename TEXT;

-- V2-READY: Video technical metadata for Meta API validation
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS video_aspect_ratio TEXT;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS video_resolution TEXT;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS video_codec TEXT;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS video_file_size_bytes BIGINT;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS video_frame_rate NUMERIC(5,2);
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS video_bitrate_kbps INTEGER;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS thumbnail_timestamp_sec NUMERIC(5,2);
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS meets_meta_specs BOOLEAN DEFAULT false;
ALTER TABLE meta_ad_videos ADD COLUMN IF NOT EXISTS meta_spec_issues JSONB;

-- Indexes for fingerprint matching
CREATE INDEX IF NOT EXISTS idx_meta_ad_videos_source
  ON meta_ad_videos(organization_id, source);
CREATE INDEX IF NOT EXISTS idx_meta_ad_videos_fingerprint
  ON meta_ad_videos(organization_id, fingerprint_duration_sec)
  WHERE source = 'uploaded' AND matched_meta_ad_id IS NULL;

-- =============================================================================
-- Organization Meta Settings (for v2 API integration)
-- =============================================================================

CREATE TABLE IF NOT EXISTS organization_meta_settings (
  organization_id UUID PRIMARY KEY REFERENCES client_organizations(id) ON DELETE CASCADE,
  meta_page_id TEXT,
  meta_page_name TEXT,
  meta_instagram_actor_id TEXT,
  meta_instagram_username TEXT,
  default_objective TEXT DEFAULT 'OUTCOME_SALES',
  default_optimization_goal TEXT DEFAULT 'OFFSITE_CONVERSIONS',
  default_billing_event TEXT DEFAULT 'IMPRESSIONS',
  advantage_plus_creative BOOLEAN DEFAULT true,
  advantage_audience BOOLEAN DEFAULT true,
  meta_pixel_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE organization_meta_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org meta settings"
  ON organization_meta_settings FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Service role can manage all meta settings"
  ON organization_meta_settings FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- Ad Copy Generations table
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_copy_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE,
  video_ref UUID REFERENCES meta_ad_videos(id) ON DELETE SET NULL,
  transcript_ref UUID REFERENCES meta_ad_transcripts(id) ON DELETE SET NULL,
  batch_id UUID,
  batch_sequence INTEGER,
  actblue_form_name TEXT NOT NULL,
  refcode TEXT NOT NULL,
  refcode_auto_generated BOOLEAN DEFAULT true,
  amount_preset INTEGER,
  recurring_default BOOLEAN DEFAULT false,
  audience_segments JSONB NOT NULL DEFAULT '[]',
  generated_copy JSONB,
  meta_ready_copy JSONB,
  tracking_url TEXT,
  copy_validation_status TEXT CHECK (copy_validation_status IN (
    'all_valid', 'some_truncated', 'needs_review'
  )),
  generation_model TEXT,
  generation_prompt_version TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_copy_generations_org
  ON ad_copy_generations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ad_copy_generations_video
  ON ad_copy_generations(video_ref);
CREATE INDEX IF NOT EXISTS idx_ad_copy_generations_batch
  ON ad_copy_generations(batch_id);

ALTER TABLE ad_copy_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org copy generations"
  ON ad_copy_generations FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert own org copy generations"
  ON ad_copy_generations FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update own org copy generations"
  ON ad_copy_generations FOR UPDATE
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Service role can manage all copy generations"
  ON ad_copy_generations FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- Ad Copy Studio Session State (wizard persistence)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ad_copy_studio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 5),
  batch_id UUID NOT NULL DEFAULT gen_random_uuid(),
  video_ids UUID[] DEFAULT '{}',
  transcript_ids UUID[] DEFAULT '{}',
  step_data JSONB DEFAULT '{}',
  completed_steps INTEGER[] DEFAULT '{}',
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(organization_id, user_id, status)
);

CREATE INDEX IF NOT EXISTS idx_ad_copy_studio_sessions_active
  ON ad_copy_studio_sessions(organization_id, user_id)
  WHERE status = 'in_progress';

ALTER TABLE ad_copy_studio_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
  ON ad_copy_studio_sessions FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Service role can manage all sessions"
  ON ad_copy_studio_sessions FOR ALL
  USING (auth.role() = 'service_role');
```

**Step 2: Apply migration locally**

Run: `cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio && npx supabase db push --local 2>&1 || npx supabase migration up --local 2>&1`

Expected: Migration applies successfully, tables created

**Step 3: Verify schema**

Run: `cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio && npx supabase db diff 2>&1 | head -50`

Expected: No diff (schema matches migration)

**Step 4: Commit**

```bash
cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio
git add supabase/migrations/20260204000000_ad_copy_studio.sql
git commit -m "feat(db): add ad copy studio schema

- Extend meta_ad_videos with upload source, fingerprinting, v2 metadata
- Add organization_meta_settings for future Meta API integration
- Add ad_copy_generations for storing generated copy
- Add ad_copy_studio_sessions for wizard state persistence
- All tables have RLS policies"
```

---

## Task 2: Type Definitions

**Files:**
- Create: `src/types/ad-copy-studio.ts`
- Modify: `src/types/index.ts` (add export)

**Step 1: Create type definitions file**

```typescript
// src/types/ad-copy-studio.ts

// =============================================================================
// Wizard Types
// =============================================================================

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

// =============================================================================
// Video Types
// =============================================================================

export interface VideoUpload {
  id: string;
  file: File | null;
  gdrive_url?: string;
  source: 'uploaded' | 'gdrive';
  filename: string;
  file_size_bytes: number;
  status: 'pending' | 'uploading' | 'transcribing' | 'analyzing' | 'ready' | 'error';
  progress: number;
  error_message?: string;
  video_id?: string; // After saved to meta_ad_videos
  transcript_id?: string; // After transcription complete
  // V2-ready metadata
  duration_sec?: number;
  aspect_ratio?: string;
  resolution?: string;
  codec?: string;
  meets_meta_specs?: boolean;
  meta_spec_issues?: SpecIssue[];
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

// =============================================================================
// Transcript & Analysis Types
// =============================================================================

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
}

// =============================================================================
// Campaign Configuration Types
// =============================================================================

export interface AudienceSegment {
  id: string;
  name: string;
  description: string;
}

export interface CampaignConfig {
  actblue_form_name: string;
  refcode: string;
  refcode_auto_generated: boolean;
  amount_preset?: number;
  recurring_default: boolean;
  audience_segments: AudienceSegment[];
}

// =============================================================================
// Copy Generation Types
// =============================================================================

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

// Meta copy character limits
export const META_COPY_LIMITS = {
  primary_text_visible: 125,
  primary_text_max: 2200,
  headline_max: 40,
  headline_recommended: 27,
  description_max: 30,
  description_recommended: 25,
} as const;

// =============================================================================
// Session State Types
// =============================================================================

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

export interface SessionStepData {
  videos?: VideoUpload[];
  analyses?: Record<string, TranscriptAnalysis>;
  config?: CampaignConfig;
  generated_copy?: GeneratedCopy;
  generation_id?: string;
  tracking_url?: string;
}

// =============================================================================
// API Types
// =============================================================================

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
```

**Step 2: Add export to types index**

```typescript
// Add to src/types/index.ts (create if doesn't exist)
export * from './ad-copy-studio';
```

**Step 3: Run type check**

Run: `cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio && npx tsc --noEmit 2>&1 | head -20`

Expected: No type errors

**Step 4: Commit**

```bash
cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio
git add src/types/ad-copy-studio.ts src/types/index.ts
git commit -m "feat(types): add ad copy studio type definitions

- Wizard step types and configuration
- Video upload and metadata types
- Transcript analysis types
- Campaign configuration and audience segment types
- Copy generation types with Meta API compatibility
- Session state types for wizard persistence
- API request/response types"
```

---

## Task 3: Shared Edge Function Utilities

**Files:**
- Create: `supabase/functions/_shared/gdrive.ts`
- Create: `supabase/functions/_shared/video-metadata.ts`

**Step 1: Create Google Drive utilities**

```typescript
// supabase/functions/_shared/gdrive.ts

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

// Supported Google Drive URL formats
const GDRIVE_PATTERNS = [
  /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
  /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)/,
  /docs\.google\.com\/.*\/d\/([a-zA-Z0-9_-]+)/,
];

const VIDEO_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
];

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export function extractFileId(url: string): string {
  for (const pattern of GDRIVE_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  throw new GDriveError(
    'INVALID_URL',
    "This doesn't look like a Google Drive link",
    'Please paste a link starting with drive.google.com'
  );
}

export async function getFileMetadata(fileId: string): Promise<{
  name: string;
  mimeType: string;
  size: number;
}> {
  const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=name,mimeType,size&key=${Deno.env.get('GOOGLE_API_KEY')}`;

  const response = await fetch(metadataUrl);

  if (!response.ok) {
    const status = response.status;
    if (status === 404) {
      throw new GDriveError(
        'FILE_NOT_FOUND',
        'File not found. It may have been deleted or the link is incorrect',
        'Please check that the link is correct'
      );
    }
    if (status === 403) {
      throw new GDriveError(
        'FILE_NOT_SHARED',
        "This file isn't shared publicly",
        'Please set sharing to "Anyone with link can view"'
      );
    }
    throw new GDriveError(
      'ACCESS_DENIED',
      'Access denied',
      'Your organization may restrict external file access'
    );
  }

  const metadata = await response.json();

  // Validate file type
  if (!VIDEO_MIME_TYPES.includes(metadata.mimeType)) {
    throw new GDriveError(
      'WRONG_FILE_TYPE',
      "This file isn't a video",
      'Supported formats: MP4, MOV, WebM'
    );
  }

  // Validate file size
  const size = parseInt(metadata.size || '0', 10);
  if (size > MAX_FILE_SIZE) {
    const sizeMB = Math.round(size / (1024 * 1024));
    throw new GDriveError(
      'FILE_TOO_LARGE',
      `This video is too large (${sizeMB} MB). Maximum size is 500MB`,
      'Please compress the video or use a shorter clip'
    );
  }

  return {
    name: metadata.name,
    mimeType: metadata.mimeType,
    size,
  };
}

export async function downloadFromGDrive(fileId: string): Promise<{
  blob: Blob;
  filename: string;
}> {
  // First get metadata
  const metadata = await getFileMetadata(fileId);

  const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  let response = await fetch(directUrl, { redirect: 'manual' });

  // Handle virus scan redirect for files >100MB
  if (response.status === 302 || response.status === 303) {
    const redirectUrl = response.headers.get('location');

    if (redirectUrl) {
      // Extract confirm token from redirect
      const confirmMatch = redirectUrl.match(/confirm=([a-zA-Z0-9_-]+)/);
      if (confirmMatch) {
        const confirmToken = confirmMatch[1];
        const confirmedUrl = `${directUrl}&confirm=${confirmToken}`;
        response = await fetch(confirmedUrl);
      } else {
        // Follow redirect directly
        response = await fetch(redirectUrl);
      }
    }
  }

  if (!response.ok) {
    throw new GDriveError(
      'NETWORK_ERROR',
      'Failed to download file',
      'Please check your internet connection and try again'
    );
  }

  const blob = await response.blob();

  return {
    blob,
    filename: metadata.name,
  };
}

export function mapStatusToErrorCode(status: number): GDriveErrorCode {
  switch (status) {
    case 403:
      return 'FILE_NOT_SHARED';
    case 404:
      return 'FILE_NOT_FOUND';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'NETWORK_ERROR';
  }
}
```

**Step 2: Create video metadata utilities**

```typescript
// supabase/functions/_shared/video-metadata.ts

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

// Meta Video Requirements (2026)
const META_REQUIREMENTS = {
  supported_codecs: ['h264', 'hevc', 'vp8', 'vp9'],
  min_resolution: 1080,
  recommended_aspects: ['9:16', '1:1', '4:5'],
  max_duration_advantage_plus: 30,
  min_duration: 6,
};

export function calculateAspectRatio(width: number, height: number): string {
  const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
  const divisor = gcd(width, height);
  const w = width / divisor;
  const h = height / divisor;

  // Map to common aspect ratios
  const ratio = width / height;
  if (Math.abs(ratio - 9/16) < 0.1) return '9:16';
  if (Math.abs(ratio - 16/9) < 0.1) return '16:9';
  if (Math.abs(ratio - 1) < 0.1) return '1:1';
  if (Math.abs(ratio - 4/5) < 0.1) return '4:5';

  return `${w}:${h}`;
}

export function validateMetaSpecs(metadata: Partial<VideoMetadata>): {
  meets_specs: boolean;
  issues: SpecIssue[];
} {
  const issues: SpecIssue[] = [];

  // Check codec
  if (metadata.codec && !META_REQUIREMENTS.supported_codecs.includes(metadata.codec.toLowerCase())) {
    issues.push({
      field: 'codec',
      issue: `Unsupported codec: ${metadata.codec}`,
      recommendation: 'Re-encode with H.264 codec',
    });
  }

  // Check resolution
  if (metadata.resolution) {
    const [width, height] = metadata.resolution.split('x').map(Number);
    const maxDimension = Math.max(width, height);
    if (maxDimension < META_REQUIREMENTS.min_resolution) {
      issues.push({
        field: 'resolution',
        issue: `Resolution too low: ${metadata.resolution}`,
        recommendation: 'Use at least 1080p resolution',
      });
    }
  }

  // Check aspect ratio
  if (metadata.aspect_ratio && !META_REQUIREMENTS.recommended_aspects.includes(metadata.aspect_ratio)) {
    issues.push({
      field: 'aspect_ratio',
      issue: `Non-optimal aspect ratio: ${metadata.aspect_ratio}`,
      recommendation: 'Use 9:16 (Reels/Stories), 1:1 (Feed), or 4:5 for best performance',
    });
  }

  // Check duration
  if (metadata.duration_sec) {
    if (metadata.duration_sec < META_REQUIREMENTS.min_duration) {
      issues.push({
        field: 'duration',
        issue: `Video too short: ${metadata.duration_sec}s`,
        recommendation: 'Videos should be at least 6 seconds',
      });
    }
    if (metadata.duration_sec > META_REQUIREMENTS.max_duration_advantage_plus) {
      issues.push({
        field: 'duration',
        issue: `Video exceeds Advantage+ limit: ${metadata.duration_sec}s`,
        recommendation: 'Keep videos under 30 seconds for Advantage+ campaigns',
      });
    }
  }

  return {
    meets_specs: issues.length === 0,
    issues,
  };
}

export function generateFingerprint(duration_sec: number, transcript: string): {
  fingerprint_duration_sec: number;
  fingerprint_transcript_hash: string;
} {
  // Round duration to nearest second
  const fingerprint_duration_sec = Math.round(duration_sec);

  // Create simple hash of normalized transcript
  const normalized = transcript
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Simple hash function (for comparison, not security)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return {
    fingerprint_duration_sec,
    fingerprint_transcript_hash: Math.abs(hash).toString(36),
  };
}
```

**Step 3: Verify files exist**

Run: `ls -la /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio/supabase/functions/_shared/`

Expected: Both new files listed

**Step 4: Commit**

```bash
cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio
git add supabase/functions/_shared/gdrive.ts supabase/functions/_shared/video-metadata.ts
git commit -m "feat(edge): add shared utilities for gdrive and video metadata

- Google Drive link parsing and file download with error handling
- Virus scan bypass for large files
- Video metadata validation against Meta specs
- Fingerprint generation for video matching"
```

---

## Task 4: Import GDrive Video Edge Function

**Files:**
- Create: `supabase/functions/import-gdrive-video/index.ts`

**Step 1: Create the edge function**

```typescript
// supabase/functions/import-gdrive-video/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/security.ts";
import {
  extractFileId,
  downloadFromGDrive,
  GDriveError,
  type GDriveErrorCode
} from "../_shared/gdrive.ts";

interface ImportGDriveRequest {
  organization_id: string;
  gdrive_urls: string[];
  batch_id?: string;
  user_id: string;
}

interface ImportResult {
  url: string;
  status: 'success' | 'error';
  video_id?: string;
  filename?: string;
  file_size_bytes?: number;
  error_code?: GDriveErrorCode;
  error_message?: string;
  suggestion?: string;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ImportGDriveRequest = await req.json();
    const { organization_id, gdrive_urls, batch_id, user_id } = body;

    if (!organization_id || !gdrive_urls || gdrive_urls.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (gdrive_urls.length > 5) {
      return new Response(
        JSON.stringify({ success: false, error: 'Maximum 5 videos per batch' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const results: ImportResult[] = [];
    const effectiveBatchId = batch_id || crypto.randomUUID();

    for (const url of gdrive_urls) {
      try {
        // Extract file ID
        const fileId = extractFileId(url);

        // Download file
        const { blob, filename } = await downloadFromGDrive(fileId);

        // Upload to Supabase Storage
        const storagePath = `${organization_id}/${effectiveBatchId}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from('meta-ad-videos')
          .upload(storagePath, blob, {
            contentType: blob.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('meta-ad-videos')
          .getPublicUrl(storagePath);

        // Create meta_ad_videos record
        const { data: videoRecord, error: insertError } = await supabase
          .from('meta_ad_videos')
          .insert({
            organization_id,
            video_url: urlData.publicUrl,
            source: 'gdrive',
            original_filename: filename,
            video_file_size_bytes: blob.size,
            uploaded_by: user_id,
            transcription_status: 'pending',
          })
          .select('id')
          .single();

        if (insertError) {
          throw new Error(`Database insert failed: ${insertError.message}`);
        }

        results.push({
          url,
          status: 'success',
          video_id: videoRecord.id,
          filename,
          file_size_bytes: blob.size,
        });

      } catch (error) {
        if (error instanceof GDriveError) {
          results.push({
            url,
            status: 'error',
            error_code: error.code,
            error_message: error.message,
            suggestion: error.suggestion,
          });
        } else {
          results.push({
            url,
            status: 'error',
            error_code: 'NETWORK_ERROR',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            suggestion: 'Please try again',
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: results.every(r => r.status === 'success'),
        results,
        batch_id: effectiveBatchId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Import GDrive error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
```

**Step 2: Verify edge function structure**

Run: `ls /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio/supabase/functions/import-gdrive-video/`

Expected: `index.ts` exists

**Step 3: Commit**

```bash
cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio
git add supabase/functions/import-gdrive-video/
git commit -m "feat(edge): add import-gdrive-video function

- Parse and validate Google Drive share links
- Download videos with virus scan bypass for large files
- Upload to Supabase Storage with org-scoped paths
- Create meta_ad_videos records with gdrive source
- Batch support for up to 5 videos
- Comprehensive error handling with user-friendly messages"
```

---

## Task 5: Generate Ad Copy Edge Function

**Files:**
- Create: `supabase/functions/generate-ad-copy/index.ts`

**Step 1: Create the edge function**

```typescript
// supabase/functions/generate-ad-copy/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/security.ts";

interface AudienceSegment {
  id: string;
  name: string;
  description: string;
}

interface GenerateAdCopyRequest {
  organization_id: string;
  transcript_id: string;
  video_id?: string;
  audience_segments: AudienceSegment[];
  actblue_form_name: string;
  refcode: string;
  amount_preset?: number;
  recurring_default?: boolean;
}

interface SegmentCopy {
  primary_texts: string[];
  headlines: string[];
  descriptions: string[];
}

interface MetaCopyVariation {
  primary_text: string;
  headline: string;
  description: string;
  call_to_action_type: string;
  destination_url: string;
  char_counts: { primary: number; headline: number; description: number };
  meets_meta_specs: boolean;
}

const META_COPY_LIMITS = {
  primary_text_visible: 125,
  headline_max: 40,
  description_max: 30,
};

const COPY_GENERATION_PROMPT = `You are an expert political fundraising copywriter specializing in Meta ads.
Generate high-converting ad copy based on this video transcript analysis.

## VIDEO ANALYSIS
Transcript: {transcript_text}
Primary Issue: {issue_primary}
Political Stances: {political_stances}
Tone: {tone_primary} ({tone_tags})
Targets Attacked: {targets_attacked}
Targets Supported: {targets_supported}
Donor Pain Points: {donor_pain_points}
Values Appealed: {values_appealed}
Key Phrases: {key_phrases}
CTA from Video: {cta_text}
Urgency Level: {urgency_level}

## TARGET AUDIENCE
Name: {segment_name}
Description: {segment_description}

## META ADS BEST PRACTICES (2026)
- Primary Text: 125 characters visible (more truncated). Front-load the most compelling value in the first 30 characters.
- Headline: 27-40 characters. Clear, benefit-focused, creates curiosity.
- Description: 25-30 characters. Concise supporting text.
- Mobile-first: 90% of Meta inventory is vertical/mobile.
- Test variation: provide genuinely different angles, not just word swaps.

## POLITICAL FUNDRAISING PRINCIPLES
- Connect the issue to personal impact
- Create urgency without manipulation
- Match the video's authentic tone
- Clear ask with specific action
- Acknowledge the audience's values

## INSTRUCTIONS
Generate 5 genuinely different variations for each element.
Each variation should take a different angle or emphasis while staying true to the video's message.

Variation approaches to consider:
1. Lead with the pain point
2. Lead with the solution/hope
3. Lead with the enemy/opposition
4. Lead with shared values
5. Lead with urgency/deadline

Return valid JSON only, no markdown or explanation:
{
  "primary_texts": ["...", "...", "...", "...", "..."],
  "headlines": ["...", "...", "...", "...", "..."],
  "descriptions": ["...", "...", "...", "...", "..."]
}`;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: GenerateAdCopyRequest = await req.json();

    const {
      organization_id,
      transcript_id,
      video_id,
      audience_segments,
      actblue_form_name,
      refcode,
      amount_preset,
      recurring_default,
    } = body;

    // Fetch transcript and analysis
    const { data: transcript, error: transcriptError } = await supabase
      .from('meta_ad_transcripts')
      .select('*')
      .eq('id', transcript_id)
      .single();

    if (transcriptError || !transcript) {
      return new Response(
        JSON.stringify({ success: false, error: 'Transcript not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Fetch organization for URL generation
    const { data: org } = await supabase
      .from('client_organizations')
      .select('slug')
      .eq('id', organization_id)
      .single();

    const orgSlug = org?.slug || 'default';

    // Build tracking URL
    let trackingUrl = `https://molitico.com/r/${orgSlug}/${actblue_form_name}?refcode=${refcode}`;
    if (amount_preset) trackingUrl += `&amount=${amount_preset}`;
    if (recurring_default) trackingUrl += `&recurring=true`;

    // Generate copy for each segment
    const generatedCopy: Record<string, SegmentCopy> = {};
    const metaReadyCopy: Record<string, { variations: MetaCopyVariation[] }> = {};

    for (const segment of audience_segments) {
      // Build prompt with transcript analysis
      const prompt = COPY_GENERATION_PROMPT
        .replace('{transcript_text}', transcript.transcript_text || '')
        .replace('{issue_primary}', transcript.issue_primary || transcript.topic_primary || '')
        .replace('{political_stances}', JSON.stringify(transcript.political_stances || []))
        .replace('{tone_primary}', transcript.tone_primary || '')
        .replace('{tone_tags}', JSON.stringify(transcript.tone_tags || []))
        .replace('{targets_attacked}', JSON.stringify(transcript.targets_attacked || []))
        .replace('{targets_supported}', JSON.stringify(transcript.targets_supported || []))
        .replace('{donor_pain_points}', JSON.stringify(transcript.donor_pain_points || []))
        .replace('{values_appealed}', JSON.stringify(transcript.values_appealed || []))
        .replace('{key_phrases}', JSON.stringify(transcript.key_phrases || []))
        .replace('{cta_text}', transcript.cta_text || '')
        .replace('{urgency_level}', transcript.urgency_level || 'medium')
        .replace('{segment_name}', segment.name)
        .replace('{segment_description}', segment.description);

      // Call OpenAI
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4-turbo-preview',
          messages: [
            { role: 'system', content: 'You are an expert political ad copywriter. Return only valid JSON.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.8,
          max_tokens: 1500,
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error('OpenAI error:', errorText);
        throw new Error(`OpenAI API error: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      const content = openaiData.choices[0]?.message?.content;

      // Parse JSON response
      let copyData: SegmentCopy;
      try {
        // Remove markdown code blocks if present
        const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
        copyData = JSON.parse(jsonStr);
      } catch {
        console.error('Failed to parse OpenAI response:', content);
        throw new Error('Failed to parse AI response');
      }

      generatedCopy[segment.name] = copyData;

      // Create Meta-ready variations
      const variations: MetaCopyVariation[] = [];
      for (let i = 0; i < 5; i++) {
        const primary = copyData.primary_texts[i] || '';
        const headline = copyData.headlines[i] || '';
        const description = copyData.descriptions[i] || '';

        variations.push({
          primary_text: primary,
          headline,
          description,
          call_to_action_type: 'DONATE_NOW',
          destination_url: trackingUrl,
          char_counts: {
            primary: primary.length,
            headline: headline.length,
            description: description.length,
          },
          meets_meta_specs:
            primary.length <= META_COPY_LIMITS.primary_text_visible &&
            headline.length <= META_COPY_LIMITS.headline_max &&
            description.length <= META_COPY_LIMITS.description_max,
        });
      }

      metaReadyCopy[segment.name] = { variations };
    }

    // Determine validation status
    const allValid = Object.values(metaReadyCopy).every(segment =>
      segment.variations.every(v => v.meets_meta_specs)
    );
    const copyValidationStatus = allValid ? 'all_valid' : 'some_truncated';

    // Save to database
    const { data: generation, error: insertError } = await supabase
      .from('ad_copy_generations')
      .insert({
        organization_id,
        video_ref: video_id,
        transcript_ref: transcript_id,
        actblue_form_name,
        refcode,
        refcode_auto_generated: true,
        amount_preset,
        recurring_default,
        audience_segments,
        generated_copy: generatedCopy,
        meta_ready_copy: metaReadyCopy,
        tracking_url: trackingUrl,
        copy_validation_status: copyValidationStatus,
        generation_model: 'gpt-4-turbo-preview',
        generation_prompt_version: '1.0',
        generated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to save generated copy');
    }

    return new Response(
      JSON.stringify({
        success: true,
        generation_id: generation.id,
        generated_copy: generatedCopy,
        meta_ready_copy: metaReadyCopy,
        tracking_url: trackingUrl,
        generated_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Generate ad copy error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
```

**Step 2: Verify edge function structure**

Run: `ls /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio/supabase/functions/generate-ad-copy/`

Expected: `index.ts` exists

**Step 3: Commit**

```bash
cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio
git add supabase/functions/generate-ad-copy/
git commit -m "feat(edge): add generate-ad-copy function

- Fetch transcript analysis from meta_ad_transcripts
- Generate 5 copy variations per audience segment via GPT-4
- Build Meta-ready copy format with character validation
- Generate tracking URLs with refcode and amount params
- Save to ad_copy_generations with validation status"
```

---

## Task 6: React Hooks for Ad Copy Studio

**Files:**
- Create: `src/hooks/useAdCopyStudio.ts`
- Create: `src/hooks/useVideoUpload.ts`
- Create: `src/hooks/useAdCopyGeneration.ts`

**Step 1: Create main wizard hook**

```typescript
// src/hooks/useAdCopyStudio.ts

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  AdCopyStudioStep,
  AdCopyStudioSession,
  SessionStepData,
  VideoUpload,
  CampaignConfig,
  GeneratedCopy,
} from '@/types/ad-copy-studio';

interface UseAdCopyStudioOptions {
  organizationId: string;
  userId: string;
}

interface UseAdCopyStudioReturn {
  // State
  session: AdCopyStudioSession | null;
  currentStep: AdCopyStudioStep;
  completedSteps: AdCopyStudioStep[];
  stepData: SessionStepData;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  // Actions
  initializeSession: () => Promise<void>;
  goToStep: (step: AdCopyStudioStep) => void;
  completeStep: (step: AdCopyStudioStep, data?: Partial<SessionStepData>) => Promise<void>;
  updateStepData: (data: Partial<SessionStepData>) => Promise<void>;
  canNavigateToStep: (step: AdCopyStudioStep) => boolean;
  isStepCompleted: (step: AdCopyStudioStep) => boolean;
  getProgressPercentage: () => number;
  resetSession: () => Promise<void>;
}

export function useAdCopyStudio({
  organizationId,
  userId,
}: UseAdCopyStudioOptions): UseAdCopyStudioReturn {
  const [session, setSession] = useState<AdCopyStudioSession | null>(null);
  const [currentStep, setCurrentStep] = useState<AdCopyStudioStep>(1);
  const [completedSteps, setCompletedSteps] = useState<AdCopyStudioStep[]>([]);
  const [stepData, setStepData] = useState<SessionStepData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing session on mount
  useEffect(() => {
    if (organizationId && userId) {
      loadOrCreateSession();
    }
  }, [organizationId, userId]);

  const loadOrCreateSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Try to find existing in-progress session
      const { data: existingSession, error: fetchError } = await (supabase as any)
        .from('ad_copy_studio_sessions')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('user_id', userId)
        .eq('status', 'in_progress')
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existingSession) {
        setSession(existingSession);
        setCurrentStep(existingSession.current_step);
        setCompletedSteps(existingSession.completed_steps || []);
        setStepData(existingSession.step_data || {});
      } else {
        // Create new session
        await initializeSession();
      }
    } catch (err) {
      console.error('Failed to load session:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, userId]);

  const initializeSession = useCallback(async () => {
    setIsSaving(true);
    try {
      const batchId = crypto.randomUUID();

      const { data: newSession, error: insertError } = await (supabase as any)
        .from('ad_copy_studio_sessions')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          current_step: 1,
          batch_id: batchId,
          video_ids: [],
          transcript_ids: [],
          step_data: {},
          completed_steps: [],
          status: 'in_progress',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setSession(newSession);
      setCurrentStep(1);
      setCompletedSteps([]);
      setStepData({});
    } catch (err) {
      console.error('Failed to initialize session:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize session');
    } finally {
      setIsSaving(false);
    }
  }, [organizationId, userId]);

  const goToStep = useCallback((step: AdCopyStudioStep) => {
    setCurrentStep(step);
  }, []);

  const completeStep = useCallback(async (
    step: AdCopyStudioStep,
    data?: Partial<SessionStepData>
  ) => {
    if (!session) return;

    setIsSaving(true);
    try {
      const newCompletedSteps = completedSteps.includes(step)
        ? completedSteps
        : [...completedSteps, step];

      const newStepData = data ? { ...stepData, ...data } : stepData;
      const nextStep = Math.min(step + 1, 5) as AdCopyStudioStep;

      // Optimistic update
      setCompletedSteps(newCompletedSteps);
      setStepData(newStepData);
      setCurrentStep(nextStep);

      // Persist to database
      const { error: updateError } = await (supabase as any)
        .from('ad_copy_studio_sessions')
        .update({
          current_step: nextStep,
          completed_steps: newCompletedSteps,
          step_data: newStepData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (updateError) throw updateError;

    } catch (err) {
      console.error('Failed to complete step:', err);
      setError(err instanceof Error ? err.message : 'Failed to save progress');
      // Revert optimistic update
      await loadOrCreateSession();
    } finally {
      setIsSaving(false);
    }
  }, [session, completedSteps, stepData, loadOrCreateSession]);

  const updateStepData = useCallback(async (data: Partial<SessionStepData>) => {
    if (!session) return;

    setIsSaving(true);
    try {
      const newStepData = { ...stepData, ...data };

      // Optimistic update
      setStepData(newStepData);

      // Persist
      const { error: updateError } = await (supabase as any)
        .from('ad_copy_studio_sessions')
        .update({
          step_data: newStepData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', session.id);

      if (updateError) throw updateError;

    } catch (err) {
      console.error('Failed to update step data:', err);
      setError(err instanceof Error ? err.message : 'Failed to save data');
    } finally {
      setIsSaving(false);
    }
  }, [session, stepData]);

  const canNavigateToStep = useCallback((step: AdCopyStudioStep): boolean => {
    if (step === 1) return true;
    // Can navigate to step if previous step is completed
    return completedSteps.includes((step - 1) as AdCopyStudioStep);
  }, [completedSteps]);

  const isStepCompleted = useCallback((step: AdCopyStudioStep): boolean => {
    return completedSteps.includes(step);
  }, [completedSteps]);

  const getProgressPercentage = useCallback((): number => {
    return (completedSteps.length / 5) * 100;
  }, [completedSteps]);

  const resetSession = useCallback(async () => {
    if (!session) return;

    setIsSaving(true);
    try {
      // Mark current session as abandoned
      await (supabase as any)
        .from('ad_copy_studio_sessions')
        .update({ status: 'abandoned' })
        .eq('id', session.id);

      // Create new session
      await initializeSession();
    } catch (err) {
      console.error('Failed to reset session:', err);
      setError(err instanceof Error ? err.message : 'Failed to reset');
    } finally {
      setIsSaving(false);
    }
  }, [session, initializeSession]);

  return {
    session,
    currentStep,
    completedSteps,
    stepData,
    isLoading,
    isSaving,
    error,
    initializeSession,
    goToStep,
    completeStep,
    updateStepData,
    canNavigateToStep,
    isStepCompleted,
    getProgressPercentage,
    resetSession,
  };
}
```

**Step 2: Create video upload hook**

```typescript
// src/hooks/useVideoUpload.ts

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { VideoUpload, ImportGDriveResponse } from '@/types/ad-copy-studio';

interface UseVideoUploadOptions {
  organizationId: string;
  batchId: string;
  userId: string;
  onUploadComplete?: (video: VideoUpload) => void;
}

interface UseVideoUploadReturn {
  videos: VideoUpload[];
  isUploading: boolean;
  error: string | null;
  uploadFiles: (files: File[]) => Promise<void>;
  importGDriveUrls: (urls: string[]) => Promise<void>;
  removeVideo: (id: string) => void;
  clearError: () => void;
}

export function useVideoUpload({
  organizationId,
  batchId,
  userId,
  onUploadComplete,
}: UseVideoUploadOptions): UseVideoUploadReturn {
  const [videos, setVideos] = useState<VideoUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    if (videos.length + files.length > 5) {
      setError('Maximum 5 videos per batch');
      return;
    }

    setIsUploading(true);
    setError(null);

    for (const file of files) {
      const videoId = crypto.randomUUID();
      const newVideo: VideoUpload = {
        id: videoId,
        file,
        source: 'uploaded',
        filename: file.name,
        file_size_bytes: file.size,
        status: 'uploading',
        progress: 0,
      };

      setVideos(prev => [...prev, newVideo]);

      try {
        // Upload to Supabase Storage
        const storagePath = `${organizationId}/${batchId}/${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('meta-ad-videos')
          .upload(storagePath, file, {
            onUploadProgress: (progress) => {
              const percent = (progress.loaded / progress.total) * 100;
              setVideos(prev => prev.map(v =>
                v.id === videoId ? { ...v, progress: percent } : v
              ));
            },
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('meta-ad-videos')
          .getPublicUrl(storagePath);

        // Create database record
        const { data: videoRecord, error: insertError } = await (supabase as any)
          .from('meta_ad_videos')
          .insert({
            organization_id: organizationId,
            video_url: urlData.publicUrl,
            source: 'uploaded',
            original_filename: file.name,
            video_file_size_bytes: file.size,
            uploaded_by: userId,
            transcription_status: 'pending',
          })
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Update video state
        setVideos(prev => prev.map(v =>
          v.id === videoId
            ? { ...v, status: 'pending', progress: 100, video_id: videoRecord.id }
            : v
        ));

        onUploadComplete?.({
          ...newVideo,
          status: 'pending',
          progress: 100,
          video_id: videoRecord.id,
        });

      } catch (err) {
        console.error('Upload error:', err);
        setVideos(prev => prev.map(v =>
          v.id === videoId
            ? { ...v, status: 'error', error_message: err instanceof Error ? err.message : 'Upload failed' }
            : v
        ));
      }
    }

    setIsUploading(false);
  }, [organizationId, batchId, userId, videos.length, onUploadComplete]);

  const importGDriveUrls = useCallback(async (urls: string[]) => {
    if (urls.length === 0) return;
    if (videos.length + urls.length > 5) {
      setError('Maximum 5 videos per batch');
      return;
    }

    setIsUploading(true);
    setError(null);

    // Create placeholder entries
    const placeholders: VideoUpload[] = urls.map((url, i) => ({
      id: crypto.randomUUID(),
      file: null,
      gdrive_url: url,
      source: 'gdrive' as const,
      filename: `Importing ${i + 1}...`,
      file_size_bytes: 0,
      status: 'uploading' as const,
      progress: 0,
    }));

    setVideos(prev => [...prev, ...placeholders]);

    try {
      // Call edge function
      const { data, error: fnError } = await supabase.functions.invoke<ImportGDriveResponse>(
        'import-gdrive-video',
        {
          body: {
            organization_id: organizationId,
            gdrive_urls: urls,
            batch_id: batchId,
            user_id: userId,
          },
        }
      );

      if (fnError) throw fnError;
      if (!data) throw new Error('No response from server');

      // Update videos based on results
      setVideos(prev => {
        const updated = [...prev];
        data.results.forEach((result, i) => {
          const placeholder = placeholders[i];
          const idx = updated.findIndex(v => v.id === placeholder.id);
          if (idx !== -1) {
            if (result.status === 'success') {
              updated[idx] = {
                ...placeholder,
                filename: result.filename || 'Video',
                file_size_bytes: result.file_size_bytes || 0,
                status: 'pending',
                progress: 100,
                video_id: result.video_id,
              };
            } else {
              updated[idx] = {
                ...placeholder,
                status: 'error',
                error_message: result.error_message,
              };
            }
          }
        });
        return updated;
      });

    } catch (err) {
      console.error('GDrive import error:', err);
      setError(err instanceof Error ? err.message : 'Import failed');
      // Mark all as error
      setVideos(prev => prev.map(v =>
        placeholders.some(p => p.id === v.id)
          ? { ...v, status: 'error' as const, error_message: 'Import failed' }
          : v
      ));
    }

    setIsUploading(false);
  }, [organizationId, batchId, userId, videos.length]);

  const removeVideo = useCallback((id: string) => {
    setVideos(prev => prev.filter(v => v.id !== id));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    videos,
    isUploading,
    error,
    uploadFiles,
    importGDriveUrls,
    removeVideo,
    clearError,
  };
}
```

**Step 3: Create copy generation hook**

```typescript
// src/hooks/useAdCopyGeneration.ts

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type {
  AudienceSegment,
  GeneratedCopy,
  MetaReadyCopy,
  GenerateAdCopyResponse,
} from '@/types/ad-copy-studio';

interface UseAdCopyGenerationOptions {
  organizationId: string;
}

interface UseAdCopyGenerationReturn {
  isGenerating: boolean;
  progress: number;
  generatedCopy: GeneratedCopy | null;
  metaReadyCopy: MetaReadyCopy | null;
  trackingUrl: string | null;
  generationId: string | null;
  error: string | null;
  generateCopy: (params: GenerateCopyParams) => Promise<void>;
  regenerateSegment: (segmentName: string) => Promise<void>;
  clearGeneration: () => void;
}

interface GenerateCopyParams {
  transcriptId: string;
  videoId?: string;
  audienceSegments: AudienceSegment[];
  actblueFormName: string;
  refcode: string;
  amountPreset?: number;
  recurringDefault?: boolean;
}

export function useAdCopyGeneration({
  organizationId,
}: UseAdCopyGenerationOptions): UseAdCopyGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedCopy, setGeneratedCopy] = useState<GeneratedCopy | null>(null);
  const [metaReadyCopy, setMetaReadyCopy] = useState<MetaReadyCopy | null>(null);
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [generationId, setGenerationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateCopy = useCallback(async (params: GenerateCopyParams) => {
    setIsGenerating(true);
    setProgress(0);
    setError(null);

    try {
      const totalSegments = params.audienceSegments.length;

      // Simulate progress for UX (actual API call is atomic)
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const { data, error: fnError } = await supabase.functions.invoke<GenerateAdCopyResponse>(
        'generate-ad-copy',
        {
          body: {
            organization_id: organizationId,
            transcript_id: params.transcriptId,
            video_id: params.videoId,
            audience_segments: params.audienceSegments,
            actblue_form_name: params.actblueFormName,
            refcode: params.refcode,
            amount_preset: params.amountPreset,
            recurring_default: params.recurringDefault,
          },
        }
      );

      clearInterval(progressInterval);

      if (fnError) throw fnError;
      if (!data?.success) throw new Error('Generation failed');

      setProgress(100);
      setGeneratedCopy(data.generated_copy);
      setMetaReadyCopy(data.meta_ready_copy);
      setTrackingUrl(data.tracking_url);
      setGenerationId(data.generation_id);

    } catch (err) {
      console.error('Generate copy error:', err);
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [organizationId]);

  const regenerateSegment = useCallback(async (segmentName: string) => {
    // For v1, we regenerate all segments
    // v2 could support individual segment regeneration
    setError('Individual segment regeneration not yet supported. Please regenerate all.');
  }, []);

  const clearGeneration = useCallback(() => {
    setGeneratedCopy(null);
    setMetaReadyCopy(null);
    setTrackingUrl(null);
    setGenerationId(null);
    setProgress(0);
    setError(null);
  }, []);

  return {
    isGenerating,
    progress,
    generatedCopy,
    metaReadyCopy,
    trackingUrl,
    generationId,
    error,
    generateCopy,
    regenerateSegment,
    clearGeneration,
  };
}
```

**Step 4: Verify hooks exist**

Run: `ls /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio/src/hooks/useAdCopy*.ts /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio/src/hooks/useVideoUpload.ts`

Expected: All 3 files listed

**Step 5: Run type check**

Run: `cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio && npx tsc --noEmit 2>&1 | head -30`

Expected: No new type errors

**Step 6: Commit**

```bash
cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio
git add src/hooks/useAdCopyStudio.ts src/hooks/useVideoUpload.ts src/hooks/useAdCopyGeneration.ts
git commit -m "feat(hooks): add ad copy studio React hooks

- useAdCopyStudio: Wizard state management with session persistence
- useVideoUpload: File upload and GDrive import with progress tracking
- useAdCopyGeneration: Copy generation with progress and error handling"
```

---

## Task 7: Wizard Step Indicator Component

**Files:**
- Create: `src/components/ad-copy-studio/WizardStepIndicator.tsx`

**Step 1: Create the step indicator component**

```typescript
// src/components/ad-copy-studio/WizardStepIndicator.tsx

import { Check, Upload, FileText, Settings, Sparkles, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdCopyStudioStep } from '@/types/ad-copy-studio';

interface WizardStepIndicatorProps {
  currentStep: AdCopyStudioStep;
  completedSteps: AdCopyStudioStep[];
  onStepClick?: (step: AdCopyStudioStep) => void;
  canNavigateToStep?: (step: AdCopyStudioStep) => boolean;
}

const STEPS = [
  { step: 1 as const, title: 'Upload', icon: Upload },
  { step: 2 as const, title: 'Review', icon: FileText },
  { step: 3 as const, title: 'Configure', icon: Settings },
  { step: 4 as const, title: 'Generate', icon: Sparkles },
  { step: 5 as const, title: 'Export', icon: Download },
];

export function WizardStepIndicator({
  currentStep,
  completedSteps,
  onStepClick,
  canNavigateToStep = () => true,
}: WizardStepIndicatorProps) {
  return (
    <nav aria-label="Wizard progress" className="w-full">
      <ol className="flex items-center justify-center gap-2 md:gap-4">
        {STEPS.map((stepConfig, index) => {
          const { step, title, icon: Icon } = stepConfig;
          const isCompleted = completedSteps.includes(step);
          const isCurrent = currentStep === step;
          const isClickable = canNavigateToStep(step);
          const isLast = index === STEPS.length - 1;

          return (
            <li key={step} className="flex items-center">
              <button
                type="button"
                onClick={() => isClickable && onStepClick?.(step)}
                disabled={!isClickable}
                className={cn(
                  'flex flex-col items-center gap-1 transition-all',
                  isClickable ? 'cursor-pointer' : 'cursor-not-allowed',
                )}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Step ${step}: ${title}${isCompleted ? ' (completed)' : ''}`}
              >
                {/* Step circle */}
                <div
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all',
                    isCompleted
                      ? 'border-[#22c55e] bg-[#22c55e]/20'
                      : isCurrent
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-[#1e2a45] bg-[#141b2d]',
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-5 w-5 text-[#22c55e]" aria-hidden="true" />
                  ) : (
                    <Icon
                      className={cn(
                        'h-5 w-5',
                        isCurrent ? 'text-blue-400' : 'text-[#64748b]',
                      )}
                      aria-hidden="true"
                    />
                  )}
                </div>

                {/* Step title */}
                <span
                  className={cn(
                    'text-xs font-medium whitespace-nowrap',
                    isCompleted
                      ? 'text-[#22c55e]'
                      : isCurrent
                      ? 'text-[#e2e8f0]'
                      : 'text-[#64748b]',
                  )}
                >
                  {title}
                </span>
              </button>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'mx-2 h-0.5 w-8 md:w-12 lg:w-16',
                    isCompleted ? 'bg-[#22c55e]' : 'bg-[#1e2a45]',
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default WizardStepIndicator;
```

**Step 2: Verify file exists**

Run: `ls /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio/src/components/ad-copy-studio/`

Expected: `WizardStepIndicator.tsx` listed

**Step 3: Commit**

```bash
cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio
mkdir -p src/components/ad-copy-studio
git add src/components/ad-copy-studio/WizardStepIndicator.tsx
git commit -m "feat(ui): add wizard step indicator component

- 5-step progress indicator with icons
- Completed/current/upcoming state styling
- Click navigation with canNavigate guard
- Connector lines between steps
- Accessible with aria-current and labels"
```

---

## Task 8: Video Upload Step Component

**Files:**
- Create: `src/components/ad-copy-studio/steps/VideoUploadStep.tsx`

**Step 1: Create the video upload step**

```typescript
// src/components/ad-copy-studio/steps/VideoUploadStep.tsx

import { useState, useCallback, useRef } from 'react';
import { Upload, Link2, X, FileVideo, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { VideoUpload } from '@/types/ad-copy-studio';

interface VideoUploadStepProps {
  videos: VideoUpload[];
  isUploading: boolean;
  error: string | null;
  onUploadFiles: (files: File[]) => Promise<void>;
  onImportGDrive: (urls: string[]) => Promise<void>;
  onRemoveVideo: (id: string) => void;
  onClearError: () => void;
  onComplete: () => void;
}

const ACCEPTED_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
const MAX_SIZE = 500 * 1024 * 1024; // 500MB

export function VideoUploadStep({
  videos,
  isUploading,
  error,
  onUploadFiles,
  onImportGDrive,
  onRemoveVideo,
  onClearError,
  onComplete,
}: VideoUploadStepProps) {
  const [gdriveUrl, setGdriveUrl] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = Array.from(e.dataTransfer.files).filter(
      file => ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_SIZE
    );

    if (files.length > 0) {
      onUploadFiles(files);
    }
  }, [onUploadFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(
      file => ACCEPTED_TYPES.includes(file.type) && file.size <= MAX_SIZE
    );

    if (files.length > 0) {
      onUploadFiles(files);
    }
    // Reset input
    e.target.value = '';
  }, [onUploadFiles]);

  const handleGDriveImport = useCallback(() => {
    if (gdriveUrl.trim()) {
      // Support multiple URLs separated by newlines or commas
      const urls = gdriveUrl
        .split(/[\n,]+/)
        .map(url => url.trim())
        .filter(url => url.includes('drive.google.com'));

      if (urls.length > 0) {
        onImportGDrive(urls);
        setGdriveUrl('');
      }
    }
  }, [gdriveUrl, onImportGDrive]);

  const canProceed = videos.length > 0 &&
    videos.every(v => v.status === 'pending' || v.status === 'ready') &&
    !isUploading;

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-[#e2e8f0]">
          Upload Your Campaign Videos
        </h2>
        <p className="text-[#94a3b8]">
          Upload up to 5 videos for this campaign
        </p>
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-start gap-3"
          >
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
            <button onClick={onClearError} className="text-red-400 hover:text-red-300">
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Area */}
      <div
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 transition-all',
          dragActive
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-[#1e2a45] bg-[#141b2d] hover:border-[#2e3a55]',
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        {/* Google Drive Import Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Link2 className="h-5 w-5 text-[#64748b]" />
            <span className="text-sm font-medium text-[#e2e8f0]">
              Import from Google Drive
            </span>
          </div>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Paste Google Drive link(s) here..."
              value={gdriveUrl}
              onChange={(e) => setGdriveUrl(e.target.value)}
              className="flex-1 bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b]"
              disabled={isUploading}
            />
            <Button
              onClick={handleGDriveImport}
              disabled={!gdriveUrl.trim() || isUploading || videos.length >= 5}
              className="bg-blue-600 hover:bg-blue-500"
            >
              Import
            </Button>
          </div>
          <p className="text-xs text-[#64748b] mt-2">
            Files must be shared as "Anyone with link"
          </p>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-[#1e2a45]" />
          <span className="text-xs text-[#64748b] uppercase">or</span>
          <div className="flex-1 h-px bg-[#1e2a45]" />
        </div>

        {/* File Upload Section */}
        <div className="text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            multiple
            className="hidden"
            onChange={handleFileSelect}
            disabled={isUploading || videos.length >= 5}
          />

          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-[#1e2a45]">
              <FileVideo className="h-8 w-8 text-[#64748b]" />
            </div>
            <div>
              <p className="text-[#e2e8f0] font-medium">
                Drag and drop videos here
              </p>
              <p className="text-sm text-[#64748b] mt-1">
                or click to browse
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || videos.length >= 5}
              className="bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]"
            >
              <Upload className="h-4 w-4 mr-2" />
              Choose Files
            </Button>
            <p className="text-xs text-[#64748b]">
              Supports MP4, MOV, WebM • Max 500MB each • Up to 5 videos
            </p>
          </div>
        </div>
      </div>

      {/* Uploaded Videos List */}
      <AnimatePresence>
        {videos.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <h3 className="text-sm font-medium text-[#64748b] uppercase tracking-wider">
              Uploaded Videos ({videos.length}/5)
            </h3>

            {videos.map((video) => (
              <motion.div
                key={video.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-[#141b2d] border border-[#1e2a45] rounded-lg p-4"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-[#1e2a45]">
                    <FileVideo className="h-5 w-5 text-[#64748b]" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[#e2e8f0] font-medium truncate">
                        {video.filename}
                      </span>
                      {video.source === 'gdrive' && (
                        <span className="text-xs px-2 py-0.5 rounded bg-[#1e2a45] text-[#64748b]">
                          Google Drive
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-xs text-[#64748b]">
                      <span>{formatFileSize(video.file_size_bytes)}</span>
                      {video.duration_sec && (
                        <span>
                          {Math.floor(video.duration_sec / 60)}:{String(Math.floor(video.duration_sec % 60)).padStart(2, '0')}
                        </span>
                      )}
                      {video.meets_meta_specs === true && (
                        <span className="text-[#22c55e]">✓ Meta specs</span>
                      )}
                      {video.meets_meta_specs === false && (
                        <span className="text-[#f97316]">⚠ Spec issues</span>
                      )}
                    </div>

                    {/* Progress bar */}
                    {(video.status === 'uploading' || video.status === 'transcribing') && (
                      <div className="mt-2">
                        <Progress
                          value={video.progress}
                          className="h-1.5 bg-[#1e2a45]"
                        />
                        <p className="text-xs text-[#64748b] mt-1">
                          {video.status === 'uploading' ? 'Uploading...' : 'Transcribing...'}
                          {' '}{Math.round(video.progress)}%
                        </p>
                      </div>
                    )}

                    {/* Error message */}
                    {video.status === 'error' && video.error_message && (
                      <p className="text-xs text-red-400 mt-2">
                        {video.error_message}
                      </p>
                    )}
                  </div>

                  {/* Status/Actions */}
                  <div className="flex items-center gap-2">
                    {video.status === 'uploading' || video.status === 'transcribing' ? (
                      <Loader2 className="h-5 w-5 text-blue-400 animate-spin" />
                    ) : video.status === 'error' ? (
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    ) : (
                      <CheckCircle className="h-5 w-5 text-[#22c55e]" />
                    )}

                    <button
                      onClick={() => onRemoveVideo(video.id)}
                      className="p-1 rounded hover:bg-[#1e2a45] text-[#64748b] hover:text-red-400 transition-colors"
                      aria-label="Remove video"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={onComplete}
          disabled={!canProceed}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
        >
          Next: Review Transcripts
        </Button>
      </div>
    </div>
  );
}

export default VideoUploadStep;
```

**Step 2: Verify file exists**

Run: `ls /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio/src/components/ad-copy-studio/steps/`

Expected: `VideoUploadStep.tsx` listed

**Step 3: Commit**

```bash
cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio
mkdir -p src/components/ad-copy-studio/steps
git add src/components/ad-copy-studio/steps/VideoUploadStep.tsx
git commit -m "feat(ui): add video upload step component

- Drag and drop file upload with validation
- Google Drive link import support
- Progress tracking per video
- File size and Meta specs display
- Remove video functionality
- Dark theme matching voter impact map"
```

---

## Task 9: Remaining Wizard Step Components

**Files:**
- Create: `src/components/ad-copy-studio/steps/TranscriptReviewStep.tsx`
- Create: `src/components/ad-copy-studio/steps/CampaignConfigStep.tsx`
- Create: `src/components/ad-copy-studio/steps/CopyGenerationStep.tsx`
- Create: `src/components/ad-copy-studio/steps/CopyExportStep.tsx`

Due to the size of this implementation plan, I'll provide abbreviated versions for Tasks 9-14. Each follows the same pattern as Task 8.

**Step 1: Create TranscriptReviewStep.tsx**

```typescript
// src/components/ad-copy-studio/steps/TranscriptReviewStep.tsx
// Displays transcript text and analysis for each video
// Tab interface for multiple videos
// Analysis panel showing: issue, tone, targets, pain points, key phrases
// "Edit transcript" capability (optional)
// Progress: "Reviewed: X/Y videos"
```

**Step 2: Create CampaignConfigStep.tsx**

```typescript
// src/components/ad-copy-studio/steps/CampaignConfigStep.tsx
// ActBlue form dropdown (from organization's forms)
// Refcode field with auto-generate button
// Amount preset input (optional)
// Recurring default toggle
// Audience segments editor (add/edit/remove)
```

**Step 3: Create CopyGenerationStep.tsx**

```typescript
// src/components/ad-copy-studio/steps/CopyGenerationStep.tsx
// Summary card showing: audiences, variations, elements
// "Generate Copy" button
// Progress bar during generation
// Error handling with retry
```

**Step 4: Create CopyExportStep.tsx**

```typescript
// src/components/ad-copy-studio/steps/CopyExportStep.tsx
// Tabs for each audience segment
// Copy cards for primary text, headlines, descriptions
// Character count badges
// Copy-to-clipboard buttons
// Tracking URL display
// "Copy All" and "Download CSV" buttons
```

**Step 5: Commit**

```bash
cd /Users/hussienjaafar/mojo-digital-wins/.worktrees/ad-copy-studio
git add src/components/ad-copy-studio/steps/
git commit -m "feat(ui): add remaining wizard step components

- TranscriptReviewStep: Display transcript and analysis
- CampaignConfigStep: ActBlue form, refcode, audiences
- CopyGenerationStep: Generate button with progress
- CopyExportStep: Copy cards with clipboard and CSV export"
```

---

## Task 10: Main Wizard Container

**Files:**
- Create: `src/components/ad-copy-studio/AdCopyWizard.tsx`

**Step 1: Create the main wizard container that orchestrates all steps**

The wizard imports all step components and manages navigation based on useAdCopyStudio hook state.

**Step 2: Commit**

```bash
git add src/components/ad-copy-studio/AdCopyWizard.tsx
git commit -m "feat(ui): add AdCopyWizard container component

- Step orchestration with WizardStepIndicator
- Organization picker in header
- Step transitions with Framer Motion
- Back/Next navigation with state persistence"
```

---

## Task 11: Admin Page and Route

**Files:**
- Create: `src/pages/AdminAdCopyStudio.tsx`
- Modify: `src/App.tsx` (add route)
- Modify: `src/components/AdminSidebar.tsx` (add nav item)

**Step 1: Create the admin page**

```typescript
// src/pages/AdminAdCopyStudio.tsx
// Wraps AdCopyWizard with auth check
// Fetches user's organizations for the picker
```

**Step 2: Add route to App.tsx**

```typescript
// Add lazy import
const AdminAdCopyStudio = lazy(() => import("./pages/AdminAdCopyStudio"));

// Add route (inside Routes)
<Route path="/admin/ad-copy-studio" element={<AdminAdCopyStudio />} />
```

**Step 3: Add nav item to AdminSidebar.tsx**

```typescript
// Add to navigation items
{ title: 'Ad Copy Studio', icon: Sparkles, value: 'ad-copy-studio' }
```

**Step 4: Commit**

```bash
git add src/pages/AdminAdCopyStudio.tsx src/App.tsx src/components/AdminSidebar.tsx
git commit -m "feat: add Ad Copy Studio admin page and navigation

- AdminAdCopyStudio page with auth wrapper
- Route at /admin/ad-copy-studio
- Navigation item in AdminSidebar"
```

---

## Task 12: Supporting Components

**Files:**
- Create: `src/components/ad-copy-studio/components/AudienceSegmentEditor.tsx`
- Create: `src/components/ad-copy-studio/components/RefcodeGenerator.tsx`
- Create: `src/components/ad-copy-studio/components/CopyVariationCard.tsx`
- Create: `src/components/ad-copy-studio/components/TranscriptAnalysisPanel.tsx`
- Create: `src/components/ad-copy-studio/components/TrackingUrlPreview.tsx`
- Create: `src/components/ad-copy-studio/components/GDriveLinkInput.tsx`
- Create: `src/components/ad-copy-studio/components/ImportErrorCard.tsx`

**Step 1-7: Create each supporting component**

Each component follows the design system established in the design document.

**Step 8: Commit**

```bash
git add src/components/ad-copy-studio/components/
git commit -m "feat(ui): add ad copy studio supporting components

- AudienceSegmentEditor: Add/edit/remove audience segments
- RefcodeGenerator: Auto-generate with edit capability
- CopyVariationCard: Single copy with clipboard
- TranscriptAnalysisPanel: Display analysis tags
- TrackingUrlPreview: Show generated URL
- GDriveLinkInput: Parse and validate GDrive links
- ImportErrorCard: Show import errors with suggestions"
```

---

## Task 13: Integration Tests

**Files:**
- Create: `src/__tests__/ad-copy-studio/hooks.test.ts`
- Create: `src/__tests__/ad-copy-studio/components.test.tsx`

**Step 1: Write hook tests**

```typescript
// Test useAdCopyStudio hook
// - Session initialization
// - Step navigation
// - Step completion
// - Data persistence
```

**Step 2: Write component tests**

```typescript
// Test VideoUploadStep
// - File drag and drop
// - GDrive URL import
// - Video list display
```

**Step 3: Run tests**

Run: `npm test -- --grep "ad-copy-studio"`

Expected: All tests pass

**Step 4: Commit**

```bash
git add src/__tests__/ad-copy-studio/
git commit -m "test: add ad copy studio integration tests

- Hook tests for session management
- Component tests for video upload step"
```

---

## Task 14: Final Verification and Documentation

**Step 1: Run full test suite**

Run: `npm test`

Expected: No new failures introduced

**Step 2: Run type check**

Run: `npx tsc --noEmit`

Expected: No type errors

**Step 3: Run linter**

Run: `npm run lint`

Expected: No linting errors

**Step 4: Build check**

Run: `npm run build`

Expected: Build succeeds

**Step 5: Update MEMORY.md with learnings**

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: ad copy studio v1 complete

- Database schema with v2-ready fields
- Edge functions for GDrive import and copy generation
- Full wizard UI with 5 steps
- React hooks for state management
- Integration tests"
```

---

## Execution Checklist

- [ ] Task 1: Database Migration
- [ ] Task 2: Type Definitions
- [ ] Task 3: Shared Edge Function Utilities
- [ ] Task 4: Import GDrive Video Edge Function
- [ ] Task 5: Generate Ad Copy Edge Function
- [ ] Task 6: React Hooks
- [ ] Task 7: Wizard Step Indicator
- [ ] Task 8: Video Upload Step
- [ ] Task 9: Remaining Wizard Steps
- [ ] Task 10: Main Wizard Container
- [ ] Task 11: Admin Page and Route
- [ ] Task 12: Supporting Components
- [ ] Task 13: Integration Tests
- [ ] Task 14: Final Verification

---

**Plan complete and saved to `docs/plans/2026-02-04-ad-copy-studio-implementation.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
