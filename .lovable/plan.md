

# Per-Variation Feedback and Regeneration

## Overview

Add the ability to give text feedback on any individual copy variation (primary text, headline, or description) and regenerate just that one piece using AI. Feedback history accumulates per variation, creating a learning loop where each regeneration incorporates all prior feedback.

## How It Works (User Perspective)

1. On each variation card in the export step, a new "Feedback" button appears next to Copy
2. Clicking it expands a small text input below the variation
3. The user types feedback like "Make the hook more urgent" or "Remove the mention of taxes"
4. Clicking "Regenerate" sends the feedback + current text + transcript context to the AI
5. The variation is replaced inline with the improved version
6. Previous feedback is retained -- if the user gives feedback again, all prior notes are included so the AI learns from the full history

## Technical Changes

### 1. New Edge Function: `regenerate-variation`

A lightweight edge function that regenerates a single copy element (primary text, headline, or description) given:
- The current text
- User feedback (string)
- Feedback history (array of previous feedback strings)
- The element type (primary_text | headline | description)
- Transcript context (transcript_id to fetch analysis)
- Segment name and description (for tone guidance)
- Organization ID (for org profile context)

The function will use a focused prompt that includes the original text, all accumulated feedback, and instructs the AI to produce one improved version respecting the same character limits and style rules.

**File:** `supabase/functions/regenerate-variation/index.ts`

### 2. New Hook: `useVariationFeedback`

Manages the feedback state and API calls:
- Tracks feedback history per variation (keyed by `videoId-segmentName-elementType-index`)
- `submitFeedback(key, feedback)` -- calls the edge function, returns new text
- `getFeedbackHistory(key)` -- returns all prior feedback for a variation
- Loading state per variation

**File:** `src/hooks/useVariationFeedback.ts`

### 3. Updated UI: Inline Feedback in Variation Cards

Modify the variation view in `CopyExportStep.tsx` to add per-element feedback controls:
- Each element (Primary Text, Headline, Description) gets a small "Refine" icon button
- Clicking it toggles a compact input row below that element
- Input + "Regenerate" button + feedback count badge
- While regenerating, the element shows a subtle loading shimmer
- After regeneration, the new text replaces the old one in the per-video copy state

### 4. State Integration in `AdCopyWizard.tsx`

- Wire the new hook into the wizard
- When a variation is regenerated, update the `perVideoGeneratedCopy` and `perVideoMetaReadyCopy` maps
- Persist feedback history in `sessionStepData` for session recovery

### 5. Types Update

Add to `src/types/ad-copy-studio.ts`:
```
type CopyElementType = 'primary_text' | 'headline' | 'description';

interface VariationFeedback {
  feedback: string;
  timestamp: string;
  previous_text: string;
  new_text: string;
}

// Keyed by "videoId-segmentName-elementType-variationIndex"
type FeedbackHistory = Record<string, VariationFeedback[]>;
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `supabase/functions/regenerate-variation/index.ts` | Create -- new edge function |
| `src/hooks/useVariationFeedback.ts` | Create -- feedback state + API hook |
| `src/types/ad-copy-studio.ts` | Modify -- add feedback types |
| `src/components/ad-copy-studio/steps/CopyExportStep.tsx` | Modify -- add inline feedback UI per element |
| `src/components/ad-copy-studio/AdCopyWizard.tsx` | Modify -- wire hook, update copy state on regeneration |

## Edge Function Prompt Strategy

The regeneration prompt will be concise and targeted:

```
You are refining a single ad copy element based on user feedback.

ELEMENT TYPE: {primary_text|headline|description}
CHARACTER LIMIT: {limit}
SEGMENT: {name} - {description}

CURRENT TEXT:
{current_text}

FEEDBACK HISTORY:
1. "Make the hook more urgent" -> produced: "..."
2. "Less aggressive tone" -> produced: "..."

LATEST FEEDBACK:
"Add a specific policy reference from the transcript"

TRANSCRIPT CONTEXT:
{key analysis fields}

Produce exactly ONE improved version that addresses the feedback while maintaining character limits and the established tone.
```

This ensures each iteration builds on the last, creating a genuine feedback loop.

## Edge Cases

- Feedback on a headline (27 chars max) -- the AI is constrained to very short output
- Empty feedback text -- button is disabled
- Multiple rapid feedback submissions -- loading state prevents double-submit
- Session recovery -- feedback history is persisted in step_data

