

# Per-Video Refcodes with Organization and Filename Context

## Current State

Refcodes are generated as `ad1-0209-x4f2` -- generic with no indication of which organization or video they belong to.

## New Refcode Format

```
{org_slug}-{file_slug}-{MMDD}-{random4}
```

Examples (org: "Mojo Digital", file: "campaign_rally_speech.mp4"):
- `mojo-rally_speech-0209-x4f2`
- `mojo-town_hall-0209-k8m1`

### Slug Logic
- **Org slug**: Take org name, lowercase, strip non-alphanumeric, take first word (max 10 chars). E.g., "Mojo Digital Wins" becomes `mojo`.
- **File slug**: Take filename without extension, lowercase, strip non-alphanumeric (keep underscores/hyphens), truncate to 15 chars. E.g., "Campaign_Rally_Speech.mp4" becomes `campaign_rally_s`.

Total refcode stays under ~35 characters to remain practical for ActBlue tracking.

## Files to Modify

| File | Change |
|------|--------|
| `src/components/ad-copy-studio/steps/CampaignConfigStep.tsx` | Update auto-generation logic and regenerate button to use org name + filename in refcode format |

That's it -- single file change. The `organizationName` prop is already passed to this component, and video filenames are available via the `videos` prop.

## Technical Details

### Helper function (inside CampaignConfigStep)

```typescript
function generateRefcode(orgName: string | undefined, filename: string, index: number): string {
  const orgSlug = (orgName || 'org')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10);

  const fileSlug = filename
    .replace(/\.[^.]+$/, '')       // remove extension
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_') // normalize
    .replace(/_+/g, '_')          // collapse underscores
    .substring(0, 15);

  const date = new Date();
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const shortId = Math.random().toString(36).substring(2, 6);

  return `${orgSlug}-${fileSlug}-${dateStr}-${shortId}`;
}
```

### Update locations

1. **Auto-generation on mount** (the `useEffect` block around line 220-248): Replace the `ad${idx+1}-${dateStr}-${shortId}` pattern with `generateRefcode(organizationName, video.filename, idx)`.

2. **Per-video regenerate button** (around line 513-515): Same replacement.

3. **Legacy single regenerate** (`handleRegenerateRefcode` around line 297-307): Update to use the new format with the first video's filename.

