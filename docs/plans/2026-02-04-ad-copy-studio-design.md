# Ad Copy Studio - Design Document

**Date:** 2026-02-04
**Status:** Approved
**Branch:** `docs/dashboard-architecture`

## Overview

A tool for system admins to upload video ads, automatically transcribe and analyze them, then generate high-converting Meta ad copy variations based on target audience segments. Integrates with existing ActBlue URL generation for complete campaign setup.

## Goals

1. Upload videos before they become Meta ads
2. Transcribe and analyze using existing Whisper + GPT-4 pipeline
3. Generate 5 variations of primary text, headline, and description per audience segment
4. Auto-generate refcodes from video analysis (editable)
5. One-click copy for Meta Ads Manager
6. Automatically link uploaded videos to Meta ads when they go live (fingerprinting)

## Non-Goals (v1)

- Direct upload to Meta via Marketing API (future v2)
- Tone-based or structure-based copy variations (audience-based only for v1)
- Video editing or trimming

---

## Data Model

### Schema Changes: `meta_ad_videos`

```sql
ALTER TABLE meta_ad_videos ADD COLUMN source TEXT DEFAULT 'meta_synced'
  CHECK (source IN ('uploaded', 'meta_synced'));
ALTER TABLE meta_ad_videos ADD COLUMN fingerprint_duration_sec INTEGER;
ALTER TABLE meta_ad_videos ADD COLUMN fingerprint_transcript_hash TEXT;
ALTER TABLE meta_ad_videos ADD COLUMN matched_meta_ad_id TEXT;
ALTER TABLE meta_ad_videos ADD COLUMN uploaded_by UUID REFERENCES auth.users(id);
ALTER TABLE meta_ad_videos ADD COLUMN original_filename TEXT;

CREATE INDEX idx_meta_ad_videos_source ON meta_ad_videos(organization_id, source);
CREATE INDEX idx_meta_ad_videos_fingerprint ON meta_ad_videos(organization_id, fingerprint_duration_sec)
  WHERE source = 'uploaded' AND matched_meta_ad_id IS NULL;
```

### New Table: `ad_copy_generations`

```sql
CREATE TABLE ad_copy_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES client_organizations(id) ON DELETE CASCADE,
  video_ref UUID REFERENCES meta_ad_videos(id) ON DELETE SET NULL,
  transcript_ref UUID REFERENCES meta_ad_transcripts(id) ON DELETE SET NULL,

  -- Campaign config
  actblue_form_name TEXT NOT NULL,
  refcode TEXT NOT NULL,
  refcode_auto_generated BOOLEAN DEFAULT true,
  amount_preset INTEGER,
  recurring_default BOOLEAN DEFAULT false,

  -- Custom audience segments
  audience_segments JSONB NOT NULL DEFAULT '[]',
  -- Format: [{name: string, description: string}, ...]

  -- Generated copy
  generated_copy JSONB,
  -- Format: {
  --   "Segment Name": {
  --     primary_texts: string[5],
  --     headlines: string[5],
  --     descriptions: string[5]
  --   }
  -- }

  generation_model TEXT,
  generation_prompt_version TEXT,
  generated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT ad_copy_generations_org_fk FOREIGN KEY (organization_id)
    REFERENCES client_organizations(id) ON DELETE CASCADE
);

CREATE INDEX idx_ad_copy_generations_org ON ad_copy_generations(organization_id);
CREATE INDEX idx_ad_copy_generations_video ON ad_copy_generations(video_ref);

-- RLS
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
```

### Video Matching Logic

When a Meta-synced video is transcribed, check for matching uploaded videos:

```typescript
// Pseudocode for matching
const uploadedCandidates = await supabase
  .from('meta_ad_videos')
  .select('id, video_id, fingerprint_transcript_hash')
  .eq('organization_id', orgId)
  .eq('source', 'uploaded')
  .is('matched_meta_ad_id', null)
  .gte('fingerprint_duration_sec', newDuration - 2)
  .lte('fingerprint_duration_sec', newDuration + 2)

for (const candidate of uploadedCandidates) {
  const similarity = compareTwoStrings(
    normalizeTranscript(candidate.transcript),
    normalizeTranscript(newTranscript)
  )

  if (similarity >= 0.90) {
    await supabase
      .from('meta_ad_videos')
      .update({ matched_meta_ad_id: newMetaAdId })
      .eq('id', candidate.id)
    break
  }
}
```

---

## UI Components

### Page Structure

```
src/
├── pages/
│   └── AdminAdCopyStudio.tsx
└── components/
    └── ad-copy-studio/
        ├── AdCopyWizard.tsx              # Main wizard container
        ├── steps/
        │   ├── VideoUploadStep.tsx       # Drag-drop, progress, preview
        │   ├── TranscriptReviewStep.tsx  # Transcript + analysis display
        │   ├── CampaignConfigStep.tsx    # Audiences, refcode, ActBlue form
        │   ├── CopyGenerationStep.tsx    # Generate button, loading
        │   └── CopyExportStep.tsx        # Copy cards, export options
        └── components/
            ├── AudienceSegmentEditor.tsx # Add/edit/remove segments
            ├── RefcodeGenerator.tsx      # Auto-generate + edit
            ├── CopyVariationCard.tsx     # Single copy with copy button
            ├── TranscriptAnalysisPanel.tsx
            └── TrackingUrlPreview.tsx
```

### Wizard Flow

**Step 1: Upload Video**
- Drag-and-drop zone (reuse pattern from LogoUploadField)
- Supported formats: MP4, MOV, WebM
- Max size: 500MB
- Show upload progress
- Auto-trigger transcription on upload complete

**Step 2: Review Transcript & Analysis**
- Display full transcript (editable for corrections)
- Show extracted analysis:
  - Primary issue & issue tags
  - Tone (primary + tags)
  - Targets attacked/supported
  - Donor pain points
  - Values appealed
  - Key phrases
  - Detected CTA
- "Re-analyze" button if transcript was edited

**Step 3: Configure Campaign**
- ActBlue form name (required, with autocomplete from org's forms)
- Refcode: auto-generated, displayed in editable field
  - Format: `{issue}-{tone}-{MMDD}-{shortId}`
  - Example: `immigration-urgent-0204-a3f9`
- Amount preset (optional)
- Recurring default toggle
- Audience segments:
  - Default empty, user adds their own
  - Each segment: name + description
  - Add/edit/remove UI
  - Minimum 1 segment required

**Step 4: Generate Copy**
- Summary of what will be generated
- "Generate Copy" button
- Loading state with progress indicator
- Estimated time based on segment count

**Step 5: Review & Export**
- Tabbed by audience segment
- For each segment, show:
  - 5 Primary Text variations (with char count)
  - 5 Headline variations (with char count)
  - 5 Description variations (with char count)
- Each variation has:
  - Copy button (individual)
  - Regenerate button (individual)
- Tracking URL display with copy button
- Export options:
  - "Copy All" (formatted text block)
  - "Download CSV"
  - "Start New" (reset wizard)

---

## Edge Function: `generate-ad-copy`

### Endpoint

`POST /functions/v1/generate-ad-copy`

### Request

```typescript
interface GenerateAdCopyRequest {
  organization_id: string
  transcript_id: string
  audience_segments: Array<{
    name: string
    description: string
  }>
  actblue_form_name: string
  refcode: string
  amount_preset?: number
  recurring_default?: boolean
}
```

### Response

```typescript
interface GenerateAdCopyResponse {
  success: boolean
  generation_id: string
  generated_copy: {
    [segmentName: string]: {
      primary_texts: string[]  // 5 variations
      headlines: string[]      // 5 variations
      descriptions: string[]   // 5 variations
    }
  }
  tracking_url: string
  generated_at: string
}
```

### AI Prompt

```
You are an expert political fundraising copywriter specializing in Meta ads.
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
Name: {segment.name}
Description: {segment.description}

## META ADS BEST PRACTICES (2026)
- Primary Text: 125 characters visible (more truncated). Front-load the most
  compelling value in the first 30 characters.
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
Each variation should take a different angle or emphasis while staying true
to the video's message.

Variation approaches to consider:
1. Lead with the pain point
2. Lead with the solution/hope
3. Lead with the enemy/opposition
4. Lead with shared values
5. Lead with urgency/deadline

Return valid JSON:
{
  "primary_texts": ["...", "...", "...", "...", "..."],
  "headlines": ["...", "...", "...", "...", "..."],
  "descriptions": ["...", "...", "...", "...", "..."]
}
```

---

## Refcode Auto-Generation

```typescript
function generateRefcode(
  analysis: TranscriptAnalysis,
  videoId: string
): string {
  const slugify = (str: string) =>
    str.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 20)

  const issue = slugify(
    analysis.issue_primary ||
    analysis.topic_primary ||
    'general'
  )
  const tone = slugify(analysis.tone_primary || 'neutral')
  const date = format(new Date(), 'MMdd')
  const shortId = videoId.slice(0, 4).toLowerCase()

  return `${issue}-${tone}-${date}-${shortId}`
}
```

**Examples:**
- `pro-immigrant-urgent-0204-a3f9`
- `healthcare-hopeful-0204-b7c2`
- `anti-maga-angry-0204-x9k1`

---

## Tracking URL Format

Uses existing CampaignURLGenerator pattern:

```
https://molitico.com/r/{orgSlug}/{actblueFormName}?refcode={refcode}&amount={amount}&recurring={recurring}
```

**Example:**
```
https://molitico.com/r/blue-wave-pac/february-push?refcode=immigration-urgent-0204-a3f9&amount=25&recurring=true
```

---

## Files to Create

| Type | Path |
|------|------|
| Migration | `supabase/migrations/YYYYMMDD_ad_copy_studio.sql` |
| Edge Function | `supabase/functions/generate-ad-copy/index.ts` |
| Page | `src/pages/AdminAdCopyStudio.tsx` |
| Wizard | `src/components/ad-copy-studio/AdCopyWizard.tsx` |
| Step 1 | `src/components/ad-copy-studio/steps/VideoUploadStep.tsx` |
| Step 2 | `src/components/ad-copy-studio/steps/TranscriptReviewStep.tsx` |
| Step 3 | `src/components/ad-copy-studio/steps/CampaignConfigStep.tsx` |
| Step 4 | `src/components/ad-copy-studio/steps/CopyGenerationStep.tsx` |
| Step 5 | `src/components/ad-copy-studio/steps/CopyExportStep.tsx` |
| Component | `src/components/ad-copy-studio/components/AudienceSegmentEditor.tsx` |
| Component | `src/components/ad-copy-studio/components/RefcodeGenerator.tsx` |
| Component | `src/components/ad-copy-studio/components/CopyVariationCard.tsx` |
| Component | `src/components/ad-copy-studio/components/TranscriptAnalysisPanel.tsx` |
| Component | `src/components/ad-copy-studio/components/TrackingUrlPreview.tsx` |
| Hook | `src/hooks/useAdCopyGeneration.ts` |
| Hook | `src/hooks/useVideoUpload.ts` |

## Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/transcribe-meta-ad-video/index.ts` | Add fingerprint computation |
| `supabase/functions/sync-meta-ad-videos/index.ts` | Add matching logic |
| `src/components/admin/AdminSidebar.tsx` | Add "Ad Copy Studio" nav item |
| `src/App.tsx` | Add route for `/admin/ad-copy-studio` |

---

## Security Considerations

- RLS policies ensure org isolation for `ad_copy_generations`
- Video uploads go through Supabase Storage with org-scoped paths
- OpenAI API key stored as environment variable (existing pattern)
- User ID tracked on uploaded videos for audit trail

---

## Future Enhancements (v2+)

1. **Meta Marketing API integration** - Direct ad creation
2. **A/B test tracking** - Link copy variations to performance data
3. **Copy templates** - Save successful copy as reusable templates
4. **Bulk generation** - Process multiple videos at once
5. **Performance feedback loop** - Show which copy variations performed best

---

## Research Sources

- [LeadsBridge - Meta Ads Best Practices 2026](https://leadsbridge.com/blog/meta-ads-best-practices/)
- [The Brief AI - Meta Ad Specs](https://www.thebrief.ai/blog/meta-ad-specs/)
- [Jon Loomer - Recommended Ad Copy Length](https://www.jonloomer.com/qvt/recommended-ad-copy-length/)
- [Deepgram - Speech-to-Text APIs 2026](https://deepgram.com/learn/best-speech-to-text-apis-2026)
- [AssemblyAI - Real-time Speech Recognition](https://www.assemblyai.com/blog/best-api-models-for-real-time-speech-recognition-and-transcription)
