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

## UI Design System

The Ad Copy Studio follows the design patterns established in the Voter Impact Map for visual consistency across admin tools.

### Color Palette

| Purpose | Color | Hex |
|---------|-------|-----|
| Background (darkest) | Dark navy | `#0a0f1a` |
| Background (cards) | Navy | `#141b2d` |
| Borders/dividers | Slate | `#1e2a45` |
| Text (primary) | Light gray | `#e2e8f0` |
| Text (secondary) | Gray | `#94a3b8` |
| Text (muted) | Dark gray | `#64748b` |
| Accent (primary) | Blue | `#3b82f6` |
| Accent (success) | Green | `#22c55e` |
| Accent (warning) | Orange | `#f97316` |
| Accent (info) | Purple | `#a855f7` |
| Accent (error) | Red | `#ef4444` |

### Component Patterns

**Glass-morphism containers:**
```tsx
className="bg-[#0a0f1a]/95 backdrop-blur-md border border-[#1e2a45] rounded-xl"
```

**Cards:**
```tsx
className="bg-[#0a0f1a] border border-[#1e2a45] rounded-lg p-4"
```

**Section labels:**
```tsx
className="text-xs text-[#64748b] uppercase tracking-wider"
```

**Active filter/selection states:**
```tsx
// Blue accent for primary actions
className="bg-blue-500/10 border-blue-500/30 text-blue-400"

// Purple accent for secondary features
className="bg-[#a855f7]/10 border-[#a855f7]/30 text-[#a855f7]"

// Green accent for success/positive
className="bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]"
```

**Buttons:**
```tsx
// Primary action
className="bg-blue-600 hover:bg-blue-500 text-white"

// Secondary/outline
className="bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]"

// Destructive
className="text-red-400/80 hover:text-red-400 hover:bg-red-500/10"
```

**Progress indicators:**
```tsx
className="h-2 bg-[#1e2a45]"
indicatorClassName="bg-blue-500"
```

### Layout Patterns

**Wizard layout:**
- Full-width content area with max-width constraint (`max-w-4xl mx-auto`)
- Step indicator bar at top with numbered circles
- Card-based step content
- Fixed footer with Back/Next buttons

**Sidebar panels (for advanced mode):**
- Width: `w-80`
- Background: `bg-[#141b2d]`
- Border: `border-l border-[#1e2a45]`
- Scrollable content area

### Accessibility

- All interactive elements have `aria-label`
- Form sections use `role="group"` with `aria-labelledby`
- Status changes announced via `aria-live="polite"`
- Focus management between wizard steps
- Keyboard navigation support (Tab, Enter, Escape)

### Responsive Behavior

- Wizard collapses to single column on mobile
- Step indicator becomes horizontal scrollable on small screens
- Copy cards stack vertically on mobile
- Touch-friendly tap targets (min 44px)

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

#### Step Indicator Design

```
┌─────────────────────────────────────────────────────────────────────┐
│  ①──────②──────③──────④──────⑤                                      │
│  Upload  Review  Configure  Generate  Export                        │
│    ●       ○        ○          ○        ○                           │
└─────────────────────────────────────────────────────────────────────┘
```

- Completed steps: filled circle with checkmark
- Current step: filled circle with number, label highlighted
- Future steps: outline circle, muted label
- Progress line connects steps, fills as user advances

---

**Step 1: Upload Video**

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Upload Your Video Ad                         │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │              ┌──────────────────────┐                       │   │
│  │              │      📹 icon         │                       │   │
│  │              └──────────────────────┘                       │   │
│  │                                                             │   │
│  │         Drag and drop your video here                       │   │
│  │              or click to browse                             │   │
│  │                                                             │   │
│  │         Supports MP4, MOV, WebM • Max 500MB                 │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ────────────────────────────────────────────────────────────────   │
│                                                                     │
│                                              [Cancel]  [Next →]     │
└─────────────────────────────────────────────────────────────────────┘
```

**After upload (processing state):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🎬 campaign-video-v2.mp4                          ✓ Uploaded│   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━          100%     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⏳ Transcribing audio...                                    │   │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░░          65%     │   │
│  │                                                             │   │
│  │  This may take 1-2 minutes depending on video length        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Step 2: Review Transcript & Analysis**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Review Transcript & Analysis                     │
│                                                                     │
│  ┌──────────────────────────────────┬──────────────────────────┐   │
│  │ TRANSCRIPT                       │ ANALYSIS                 │   │
│  │                                  │                          │   │
│  │ "We're facing a crisis at our    │ PRIMARY ISSUE            │   │
│  │ border. Families are being       │ ┌────────────────────┐   │   │
│  │ torn apart, children in cages.   │ │ pro-immigrant       │   │   │
│  │ We need leaders who will stand   │ │ anti-persecution    │   │   │
│  │ up for humanity, not hatred.     │ └────────────────────┘   │   │
│  │                                  │                          │   │
│  │ That's why I'm running. Will     │ TONE                     │   │
│  │ you chip in $25 today to help    │ ┌────────────────────┐   │   │
│  │ us fight back?"                  │ │ 😤 Urgent  😢 Comp- │   │   │
│  │                                  │ │           assionate │   │   │
│  │ [Edit transcript]               │ └────────────────────┘   │   │
│  │                                  │                          │   │
│  │                                  │ TARGETS ATTACKED         │   │
│  │                                  │ • Trump administration   │   │
│  │                                  │ • Border policies        │   │
│  │                                  │                          │   │
│  │                                  │ PAIN POINTS              │   │
│  │                                  │ • Family separation fear │   │
│  │                                  │ • Moral outrage          │   │
│  │                                  │                          │   │
│  │                                  │ KEY PHRASES              │   │
│  │                                  │ "stand up for humanity"  │   │
│  │                                  │ "fight back"             │   │
│  └──────────────────────────────────┴──────────────────────────┘   │
│                                                                     │
│  [← Back]                                          [Next →]         │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Step 3: Configure Campaign**

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Configure Campaign                            │
│                                                                     │
│  ACTBLUE FORM                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ february-immigration-push                              ▼    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  REFCODE                                        [🔄 Regenerate]     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ pro-immigrant-urgent-0204-a3f9                              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  Auto-generated from video analysis • Edit if needed                │
│                                                                     │
│  ┌─────────────────────────────────┬───────────────────────────┐   │
│  │ AMOUNT PRESET (optional)       │ RECURRING DEFAULT         │   │
│  │ ┌─────────────────────────┐    │ ┌─────────────────────┐   │   │
│  │ │ $25                     │    │ │ ☑ Monthly recurring │   │   │
│  │ └─────────────────────────┘    │ └─────────────────────┘   │   │
│  └─────────────────────────────────┴───────────────────────────┘   │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  TARGET AUDIENCES                                   [+ Add Segment] │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ First-Time Donors                                    [✏️][🗑️]│   │
│  │ People who haven't donated before and need to be              │   │
│  │ convinced this campaign matters                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Immigration Advocates                                [✏️][🗑️]│   │
│  │ Donors who care deeply about immigrant rights and            │   │
│  │ have donated to similar causes                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [← Back]                                          [Next →]         │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Step 4: Generate Copy**

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Generate Ad Copy                             │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                                                             │   │
│  │  📊 GENERATION SUMMARY                                      │   │
│  │                                                             │   │
│  │  Audiences:        2 segments                               │   │
│  │  Variations:       5 per element                            │   │
│  │  Elements:         Primary Text, Headline, Description      │   │
│  │                                                             │   │
│  │  Total outputs:    30 copy variations                       │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│                    ┌──────────────────────────┐                     │
│                    │   ⚡ Generate Copy        │                     │
│                    └──────────────────────────┘                     │
│                                                                     │
│  [← Back]                                                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Generating state:**
```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                         ⏳ Generating...                            │
│                                                                     │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░   65%        │
│                                                                     │
│              Generating copy for: Immigration Advocates             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Step 5: Review & Export**

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Review & Export Copy                           │
│                                                                     │
│  ┌────────────────────┬────────────────────┐                        │
│  │ First-Time Donors  │ Immigration Advoc. │  ← Audience tabs       │
│  └────────────────────┴────────────────────┘                        │
│                                                                     │
│  PRIMARY TEXT (125 chars max)                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Families are being torn apart at the border.      [📋]   │   │
│  │    Will you chip in $25 to help us fight back?               │   │
│  │                                            98 chars  [🔄]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 2. Children in cages. We can stop this—but only      [📋]   │   │
│  │    with your help. Donate $25 now.                           │   │
│  │                                            89 chars  [🔄]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│  ... (3 more variations)                                           │
│                                                                     │
│  HEADLINES (40 chars max)                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Stand Up for Humanity                     28 chars [📋]   │   │
│  │ 2. Fight Back Against Hatred                 31 chars [📋]   │   │
│  │ 3. $25 Can Change Everything                 29 chars [📋]   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  DESCRIPTIONS (30 chars max)                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 1. Donate now to help families    26 chars [📋]              │   │
│  │ 2. Your $25 matters today         22 chars [📋]              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  TRACKING URL                                                       │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ https://molitico.com/r/blue-wave/february-push?refcode=...  │📋│   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [📋 Copy All]  [⬇️ Download CSV]  [🔄 Start New]                   │
└─────────────────────────────────────────────────────────────────────┘
```

Legend: 📋 = Copy to clipboard, 🔄 = Regenerate this variation

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

## Extensibility: Meta Marketing API (v2 Architecture)

The v1 architecture is designed to seamlessly extend to programmatic ad creation via the Meta Marketing API. Key design decisions that enable this:

### Database Schema Ready for v2

The `ad_copy_generations` table includes fields that will map directly to Meta API:

```sql
-- Add these columns in v2 migration
ALTER TABLE ad_copy_generations ADD COLUMN meta_campaign_id TEXT;
ALTER TABLE ad_copy_generations ADD COLUMN meta_adset_id TEXT;
ALTER TABLE ad_copy_generations ADD COLUMN meta_ad_ids JSONB;  -- Array of created ad IDs
ALTER TABLE ad_copy_generations ADD COLUMN meta_creative_id TEXT;
ALTER TABLE ad_copy_generations ADD COLUMN publish_status TEXT CHECK (publish_status IN (
  'draft',           -- Copy generated, not published
  'ready',           -- User approved, ready to publish
  'publishing',      -- API call in progress
  'published',       -- Successfully created in Meta
  'failed',          -- API error
  'paused',          -- User paused the ad
  'archived'         -- Ad removed from Meta
));
ALTER TABLE ad_copy_generations ADD COLUMN publish_error TEXT;
ALTER TABLE ad_copy_generations ADD COLUMN published_at TIMESTAMPTZ;
```

### Component Architecture for v2

The wizard step structure allows inserting new steps without breaking existing flow:

```
v1 Flow:
Upload → Review → Configure → Generate → Export

v2 Flow (extended):
Upload → Review → Configure → Generate → [Campaign Setup] → [Publish] → Export
                                              ↓
                                    - Select/create campaign
                                    - Select/create ad set
                                    - Set budget & schedule
                                    - Preview ad
```

**New v2 components (drop-in):**
```
src/components/ad-copy-studio/steps/
├── CampaignSetupStep.tsx      # NEW: Select campaign/adset or create new
├── AdPreviewStep.tsx          # NEW: Preview as it will appear in Meta
└── PublishStep.tsx            # NEW: Confirm and publish to Meta
```

### Edge Function Architecture for v2

**New functions:**
```
supabase/functions/
├── create-meta-campaign/index.ts    # Create campaign via Marketing API
├── create-meta-adset/index.ts       # Create ad set with targeting
├── create-meta-ad/index.ts          # Create ad with creative + copy
├── upload-meta-video/index.ts       # Upload video as creative asset
└── get-meta-campaigns/index.ts      # List existing campaigns for selection
```

**Meta Marketing API integration pattern:**
```typescript
// Example: create-meta-ad/index.ts
interface CreateMetaAdRequest {
  organization_id: string
  generation_id: string           // Reference to ad_copy_generations
  campaign_id: string             // Existing or newly created
  adset_id: string                // Existing or newly created
  selected_copy: {
    primary_text_index: number    // Which variation (0-4)
    headline_index: number
    description_index: number
  }
}

// Uses existing Meta OAuth tokens from integration_credentials
const credentials = await getMetaCredentials(organizationId)
const response = await fetch(
  `https://graph.facebook.com/v19.0/act_${credentials.ad_account_id}/ads`,
  {
    method: 'POST',
    headers: { Authorization: `Bearer ${credentials.access_token}` },
    body: JSON.stringify({
      name: `${refcode} - ${segment_name}`,
      adset_id: adsetId,
      creative: { creative_id: creativeId },
      status: 'PAUSED',  // Start paused for review
    })
  }
)
```

### UI Extension Points

**Step 5 (CopyExportStep) includes v2 hooks:**
```tsx
// v1: Just copy buttons
<Button onClick={copyToClipboard}>Copy All</Button>
<Button onClick={downloadCSV}>Download CSV</Button>

// v2: Add publish flow (feature-flagged)
{features.metaPublish && (
  <Button onClick={() => setStep('campaign-setup')}>
    Publish to Meta →
  </Button>
)}
```

**Advanced mode toggle (future):**
```tsx
// Wizard header
<div className="flex items-center justify-between">
  <WizardSteps current={step} />
  <Toggle
    label="Advanced Mode"
    checked={advancedMode}
    onChange={setAdvancedMode}
  />
</div>

// Advanced mode reveals:
// - Campaign/adset selection inline
// - A/B test setup
// - Budget allocation
// - Schedule controls
```

### Required Meta API Permissions (v2)

Current OAuth scope: `ads_read`

Additional scopes needed for v2:
- `ads_management` - Create and manage ads
- `business_management` - Access business manager assets

Re-OAuth flow will be required when v2 launches. The existing `MetaCredentialAuth.tsx` component supports scope extension.

### Migration Path

1. **v1 ships** with copy-paste workflow
2. **User feedback** validates the copy generation quality
3. **v2 development** adds Meta API integration behind feature flag
4. **Beta rollout** to select organizations
5. **Full release** with re-OAuth for expanded permissions

---

## Research Sources

- [LeadsBridge - Meta Ads Best Practices 2026](https://leadsbridge.com/blog/meta-ads-best-practices/)
- [The Brief AI - Meta Ad Specs](https://www.thebrief.ai/blog/meta-ad-specs/)
- [Jon Loomer - Recommended Ad Copy Length](https://www.jonloomer.com/qvt/recommended-ad-copy-length/)
- [Deepgram - Speech-to-Text APIs 2026](https://deepgram.com/learn/best-speech-to-text-apis-2026)
- [AssemblyAI - Real-time Speech Recognition](https://www.assemblyai.com/blog/best-api-models-for-real-time-speech-recognition-and-transcription)
