
# Plan: Transcript Context and Reanalysis Feature

## Overview

Enable users to:
1. Add context to a video/transcript **before** the initial analysis runs
2. Edit the transcript and **reanalyze** it after viewing the initial analysis
3. Add additional context **after** analysis to refine results

This requires database schema changes, a new backend endpoint, and UI updates to the TranscriptReviewStep component.

---

## Current State Analysis

### What Exists
- **TranscriptReviewStep.tsx**: Has edit mode for transcripts but "Save" does nothing (line 195-199 says "just close the editor")
- **transcribe-meta-ad-video edge function**: Runs Whisper transcription + GPT-4 analysis in a single flow
- **meta_ad_transcripts table**: Stores transcript and analysis fields, no context columns exist
- **useVideoTranscriptionFlow hook**: Has `triggerTranscription` but no standalone "reanalyze" function

### What's Missing
- No `user_context` or `additional_context` column in database
- No endpoint to re-run analysis only (without re-transcribing)
- No UI for adding context before/after analysis
- Save button doesn't persist transcript edits

---

## Implementation Plan

### Phase 1: Database Schema

Add new columns to `meta_ad_transcripts`:

```sql
ALTER TABLE public.meta_ad_transcripts
ADD COLUMN user_context_pre text,      -- Context added BEFORE initial analysis
ADD COLUMN user_context_post text,     -- Context added AFTER analysis (refinement notes)
ADD COLUMN analysis_count integer DEFAULT 1,  -- Track how many times analyzed
ADD COLUMN last_analyzed_at timestamp with time zone;
```

### Phase 2: New Edge Function - `reanalyze-transcript`

Create a lightweight edge function that:
1. Accepts `transcript_id`, `transcript_text` (optional - for edits), `user_context_pre`, `user_context_post`
2. Re-runs ONLY the GPT-4 analysis (no Whisper call)
3. Includes user context in the GPT-4 prompt
4. Updates `meta_ad_transcripts` with new analysis fields

**Key: Include context in the analysis prompt**
```typescript
const systemPrompt = `You are an expert political ad analyst...

${userContextPre ? `\n## CONTEXT FROM USER (provided before analysis):\n${userContextPre}\n` : ''}
${userContextPost ? `\n## ADDITIONAL CONTEXT (refinement notes):\n${userContextPost}\n` : ''}

Analyze this video transcript...`;
```

### Phase 3: Frontend Hook Updates

Extend `useVideoTranscriptionFlow` with:

```typescript
interface ReanalyzeOptions {
  transcriptId: string;
  transcriptText?: string;        // If edited
  userContextPre?: string;        // Context from before
  userContextPost?: string;       // Refinement context
}

const reanalyzeTranscript = async (options: ReanalyzeOptions): Promise<FetchAnalysisResult | null>
```

### Phase 4: UI Components

#### 4.1 Pre-Analysis Context (VideoUploadStep or new modal)
- Show context input field when video enters "transcribing" status
- Placeholder: "Add context about this video (optional)"
- Examples: "This is a 30-second spot about immigration featuring the candidate"
- Store in session stepData until analysis runs

#### 4.2 TranscriptReviewStep Enhancements

**Left Panel (Transcript)**:
- Make transcript editing actually save to database
- Add "Reanalyze" button next to Save

**Right Panel (Analysis)**:
- Add collapsible "Context" section at top:
  - Show existing `user_context_pre` if present
  - Editable `user_context_post` textarea for refinement notes
  - Placeholder: "Add context to refine the analysis..."
- Add "Reanalyze with Context" button
- Show analysis version/count indicator

**UI Layout Mockup**:
```
+---------------------------------------+
| Context (collapsible)                 |
| +-----------------------------------+ |
| | Pre-analysis: "30sec immigration" | |
| +-----------------------------------+ |
| | Add refinement notes...           | |
| | [textarea]                        | |
| +-----------------------------------+ |
| [Reanalyze] button                    |
+---------------------------------------+
| Primary Issue        | Tone          |
| ...                  | ...           |
+---------------------------------------+
```

### Phase 5: Type Updates

Update `src/types/ad-copy-studio.ts`:

```typescript
export interface TranscriptAnalysis {
  // ... existing fields
  user_context_pre?: string;
  user_context_post?: string;
  analysis_count?: number;
  last_analyzed_at?: string;
}
```

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `supabase/functions/reanalyze-transcript/index.ts` | Edge function for re-running GPT-4 analysis |
| `supabase/migrations/[timestamp]_add_context_columns.sql` | Database migration |

### Modified Files
| File | Changes |
|------|---------|
| `src/types/ad-copy-studio.ts` | Add context fields to TranscriptAnalysis |
| `src/hooks/useVideoTranscriptionFlow.ts` | Add `reanalyzeTranscript` function |
| `src/components/ad-copy-studio/steps/TranscriptReviewStep.tsx` | Full UI overhaul: context section, save functionality, reanalyze button |
| `src/components/ad-copy-studio/AdCopyWizard.tsx` | Pass reanalyze handler to TranscriptReviewStep, handle context persistence |

---

## Technical Details

### Reanalyze Edge Function Request/Response

**Request:**
```typescript
{
  organization_id: string;
  transcript_id: string;
  transcript_text?: string;       // Updated text if edited
  user_context_pre?: string;
  user_context_post?: string;
}
```

**Response:**
```typescript
{
  success: boolean;
  analysis: AnalysisResult;
  analysis_count: number;
  analyzed_at: string;
}
```

### GPT-4 Prompt Enhancement

The existing prompt in `transcribe-meta-ad-video` will be extracted to a shared utility. The reanalyze function will use the same prompt but prepend user context sections when provided.

### Loading States

- While reanalyzing: Show spinner on "Reanalyze" button, disable editing
- After reanalyze: Toast notification "Analysis updated", refresh analysis cards

---

## User Flow

### Flow A: Add Context Before Initial Analysis
1. User uploads video in Step 1
2. While status = "transcribing", optional context input appears
3. User enters: "This is an attack ad against the incumbent"
4. Context is stored in session
5. When transcription completes, backend includes context in analysis prompt
6. Analysis reflects user context

### Flow B: Edit Transcript and Reanalyze
1. User views transcript in Step 2
2. Clicks "Edit transcript"
3. Makes corrections (e.g., fixes proper nouns)
4. Clicks "Save & Reanalyze"
5. Backend runs GPT-4 analysis on corrected text
6. Analysis cards update with new results

### Flow C: Add Refinement Context After Analysis
1. User reviews initial analysis in Step 2
2. Notices analysis missed the opponent's name
3. Expands "Context" section
4. Types: "The opponent mentioned is Senator John Smith"
5. Clicks "Reanalyze with Context"
6. New analysis correctly identifies targets

---

## Edge Cases Handled

1. **Empty context**: Skip context sections in prompt if not provided
2. **Very long context**: Truncate to 500 chars to avoid token bloat
3. **Concurrent reanalyze**: Disable button during operation
4. **Failed reanalyze**: Show error toast, keep existing analysis visible
5. **Session persistence**: Store context in stepData so it survives refresh

---

## Testing Checklist

1. Upload video with pre-analysis context → verify context appears in transcript record
2. Edit transcript text → save → verify database updated
3. Click Reanalyze after edit → verify new analysis reflects changes
4. Add refinement context → Reanalyze → verify context influenced results
5. Refresh page mid-flow → verify context persists
6. Multiple reanalyze cycles → verify analysis_count increments
