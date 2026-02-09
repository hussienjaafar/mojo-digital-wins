

# Topic-Based Refcodes from Video Analysis

## What Changes

Instead of using the raw filename in refcodes, extract a short topic slug from the AI-analyzed transcript data (`issue_primary` or `topic_primary` fields). This produces cleaner, more meaningful refcodes like:

```
mojo-aice-0209-x4f2      (Anti-ICE ad, org "Mojo Digital")
mojo-gunreform-0209-k8m1  (Gun reform ad)
mojo-climate-0209-p3q7    (Climate ad)
```

### Slug Logic

1. **Topic source**: Use `issue_primary` from the transcript analysis (falls back to `topic_primary`, then filename if no analysis exists yet)
2. **Topic slug**: Lowercase, strip non-alphanumeric, truncate to 12 chars
3. **Org slug**: Same as current (first word of org name, max 10 chars)
4. **Format**: `{org_slug}-{topic_slug}-{MMDD}-{random4}`

## Files to Modify

| File | Change |
|------|--------|
| `src/components/ad-copy-studio/steps/CampaignConfigStep.tsx` | Accept `analyses` prop; update `generateRefcode` to use topic from analysis instead of filename |
| `src/components/ad-copy-studio/AdCopyWizard.tsx` | Pass `analyses` state to `CampaignConfigStep` |

## Technical Details

### Updated generateRefcode helper

```typescript
function generateRefcode(
  orgName: string | undefined,
  filename: string,
  analysis?: TranscriptAnalysis
): string {
  const orgSlug = (orgName || 'org')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10);

  // Prefer AI-extracted topic, fall back to filename
  const topicSource = analysis?.issue_primary
    || analysis?.topic_primary
    || filename.replace(/\.[^.]+$/, '');

  const topicSlug = topicSource
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 12);

  const date = new Date();
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const shortId = Math.random().toString(36).substring(2, 6);

  return `${orgSlug}-${topicSlug}-${dateStr}-${shortId}`;
}
```

### Props update

Add `analyses?: Record<string, TranscriptAnalysis>` to `CampaignConfigStepProps`. The key is the `video_id`, matching what's already stored in the wizard state.

### Auto-generation update

In the `useEffect` that generates refcodes on mount, pass the matching analysis for each video:

```typescript
newRefcodes[v.video_id!] = generateRefcode(
  organizationName,
  v.filename,
  analyses?.[v.video_id!]
);
```

Same change for the per-video "Regenerate" button.

### Dependency note

The `analyses` dependency is added to the `useEffect` so that if a video's analysis completes after the config step loads, refcodes that were generated with filename-only fallback get upgraded to use the topic automatically (only for videos that don't already have a user-edited refcode).
