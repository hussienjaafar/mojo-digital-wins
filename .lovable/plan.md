

# Fix: Make Refcodes Unique Per Video

## Problem

All videos share the same broad theme ("pro-Palestinian"), so `issue_primary` produces nearly identical 12-char slugs like `propalestini` for every video. The refcodes end up looking the same.

## Actual Data

| Video | `issue_primary` | Current slug (12 chars) |
|-------|-----------------|------------------------|
| Video 1 | pro-Palestinian advocacy and legislative representation | `propalestini` |
| Video 2 | pro-Palestinian free-speech defense | `propalestini` |
| Video 3 | pro-Palestine anti-offensive-weapons-sales | `propalestine` |
| Video 4 | pro-Palestine anti-genocide political-influence | `propalestine` |
| Video 5 | pro-Muslim political-representation anti-genocide | `promuslimpol` |

## Solution

Instead of just grabbing the first 12 characters of `issue_primary`, extract the **most distinctive keyword** by skipping common/generic prefixes and picking the first unique-ish term. Also use `targets_attacked` as a secondary differentiator.

### New slug logic

1. Take `issue_primary`, split into words
2. Skip generic prefixes: "pro", "anti", "palestinian", "palestine", "israel", "muslim" 
3. Take the first remaining meaningful word(s), truncate to 12 chars
4. If nothing remains after filtering, fall back to first `targets_attacked` entry, then `topic_primary`, then filename

### Expected results with new logic

| Video | `issue_primary` | New slug |
|-------|-----------------|----------|
| Video 1 | pro-Palestinian advocacy and legislative representation | `advocacy` |
| Video 2 | pro-Palestinian free-speech defense | `freespeech` |
| Video 3 | pro-Palestine anti-offensive-weapons-sales | `offensiveweap` |
| Video 4 | pro-Palestine anti-genocide political-influence | `genocide` |
| Video 5 | pro-Muslim political-representation anti-genocide | `politicalrep` |

Resulting refcodes: `mojo-advocacy-0209-x4f2`, `mojo-freespeech-0209-k8m1`, etc.

## File to Modify

| File | Change |
|------|--------|
| `src/components/ad-copy-studio/steps/CampaignConfigStep.tsx` | Update `generateRefcode` slug extraction logic |

## Technical Details

### Updated generateRefcode

```typescript
function generateRefcode(orgName: string | undefined, filename: string, analysis?: TranscriptAnalysis): string {
  const orgSlug = (orgName || 'org')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10);

  // Extract a distinctive topic slug from analysis
  let topicSlug = '';
  if (analysis) {
    const skipWords = new Set([
      'pro', 'anti', 'palestinian', 'palestine', 'israel', 'israeli',
      'muslim', 'and', 'the', 'of', 'in', 'for', 'to', 'a', 'an',
    ]);
    
    // Try issue_primary first, extracting meaningful words
    const issueWords = (analysis.issue_primary || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1 && !skipWords.has(w));
    
    if (issueWords.length > 0) {
      // Take up to 2 meaningful words
      topicSlug = issueWords.slice(0, 2).join('');
    }
    
    // Fallback: first target attacked
    if (!topicSlug && analysis.targets_attacked?.length) {
      topicSlug = analysis.targets_attacked[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    }
    
    // Fallback: topic_primary
    if (!topicSlug) {
      topicSlug = (analysis.topic_primary || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    }
  }
  
  // Final fallback: filename
  if (!topicSlug) {
    topicSlug = filename
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }
  
  topicSlug = topicSlug.substring(0, 12);

  const date = new Date();
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const shortId = Math.random().toString(36).substring(2, 6);

  return `${orgSlug}-${topicSlug}-${dateStr}-${shortId}`;
}
```

Single file, single function change. No new props or wiring needed.
