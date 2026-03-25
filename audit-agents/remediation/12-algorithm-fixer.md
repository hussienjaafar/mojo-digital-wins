# Algorithm Fixer Agent

**Role:** ML Engineer / Backend Developer
**Focus:** Fix algorithm bugs and performance issues
**Reference:** Google ML Best Practices, Clean Code

---

## Assigned Issues

| Priority | Issue | File |
|----------|-------|------|
| CRITICAL | Random performance data placeholder | `correlate-trends-campaigns/index.ts:200` |
| HIGH | State abbreviation false positives | `politicalEntities.ts:169` |
| MEDIUM | O(n^2) duplicate detection | `detect-duplicates/index.ts` |
| MEDIUM | Missing retry logic | Ingestion functions |
| MEDIUM | No max batch size validation | Multiple functions |

---

## Task 1: Fix Random Performance Placeholder (CRITICAL)

### Current Broken Code
```typescript
// Line ~200 in correlate-trends-campaigns/index.ts
// BROKEN: Uses random value instead of actual performance
const performance = Math.random(); // PLACEHOLDER - This completely breaks learning
```

### Correct Implementation

```typescript
/**
 * Calculate actual campaign performance from metrics
 */
async function calculateCampaignPerformance(
  campaign: Campaign,
  supabaseClient: SupabaseClient
): Promise<number> {
  // Get campaign metrics
  const { data: metrics, error } = await supabaseClient
    .from('campaign_metrics')
    .select('impressions, clicks, conversions, spend, revenue')
    .eq('campaign_id', campaign.id)
    .single();

  if (error || !metrics) {
    console.log(`No metrics found for campaign ${campaign.id}`);
    return 0.5; // Neutral performance if no data
  }

  // Calculate performance score based on campaign type
  let performanceScore: number;

  switch (campaign.campaign_type) {
    case 'email':
      // Email: Open rate and click rate
      const openRate = metrics.impressions > 0
        ? (metrics.clicks / metrics.impressions)
        : 0;
      performanceScore = Math.min(openRate * 5, 1); // Normalize to 0-1
      break;

    case 'social':
      // Social: Engagement rate
      const engagementRate = metrics.impressions > 0
        ? (metrics.clicks + metrics.conversions) / metrics.impressions
        : 0;
      performanceScore = Math.min(engagementRate * 10, 1);
      break;

    case 'paid':
      // Paid: ROAS (Return on Ad Spend)
      const roas = metrics.spend > 0
        ? metrics.revenue / metrics.spend
        : 0;
      performanceScore = Math.min(roas / 3, 1); // ROAS of 3x = perfect score
      break;

    case 'content':
      // Content: Conversion rate
      const conversionRate = metrics.clicks > 0
        ? metrics.conversions / metrics.clicks
        : 0;
      performanceScore = Math.min(conversionRate * 20, 1);
      break;

    default:
      // Generic: Weighted combination
      const ctr = metrics.impressions > 0 ? metrics.clicks / metrics.impressions : 0;
      const cvr = metrics.clicks > 0 ? metrics.conversions / metrics.clicks : 0;
      performanceScore = (ctr * 0.4) + (cvr * 0.6);
  }

  // Get baseline performance for this campaign type
  const baseline = await getBaselinePerformance(campaign.campaign_type, supabaseClient);

  // Return performance relative to baseline
  // > 1.0 = above average, < 1.0 = below average
  return baseline > 0 ? performanceScore / baseline : performanceScore;
}

/**
 * Get baseline performance for campaign type (rolling 30-day average)
 */
async function getBaselinePerformance(
  campaignType: string,
  supabaseClient: SupabaseClient
): Promise<number> {
  const { data, error } = await supabaseClient
    .from('campaign_metrics')
    .select('impressions, clicks, conversions, spend, revenue')
    .eq('campaign_type', campaignType)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (error || !data || data.length === 0) {
    return 0.5; // Default baseline
  }

  // Calculate average performance across all campaigns
  const totalImpressions = data.reduce((sum, m) => sum + (m.impressions || 0), 0);
  const totalClicks = data.reduce((sum, m) => sum + (m.clicks || 0), 0);

  return totalImpressions > 0 ? totalClicks / totalImpressions : 0.5;
}
```

### Implementation Steps
1. Read `supabase/functions/correlate-trends-campaigns/index.ts`
2. Find the `Math.random()` placeholder
3. Replace with `calculateCampaignPerformance()` function
4. Add `getBaselinePerformance()` helper
5. Update the correlation logic to use actual performance
6. Test with sample campaign data

### Verification
```sql
-- After fix, performance values should vary based on actual metrics
SELECT
  correlation_score,
  performance_vs_baseline,
  CASE
    WHEN performance_vs_baseline BETWEEN 0 AND 2 THEN 'reasonable'
    ELSE 'suspicious'
  END as validity
FROM trend_campaign_correlations
ORDER BY created_at DESC
LIMIT 20;
```

---

## Task 2: Fix State Abbreviation Matching (HIGH)

### Current Broken Code
```typescript
// Line ~169 in politicalEntities.ts
// BROKEN: includes() matches substrings
if (text.includes(abbrev)) {
  return state;
}
```

### False Positive Examples
- "any" matches NY
- "text" matches TX
- "main" matches IN
- "coral" matches OR (Oregon)
- "what" matches AT (if used)

### Correct Implementation
```typescript
/**
 * Check if text contains a state abbreviation as a standalone word
 */
function containsStateAbbreviation(text: string, abbrev: string): boolean {
  // Create regex with word boundaries
  const pattern = new RegExp(`\\b${abbrev}\\b`, 'i');
  return pattern.test(text);
}

// Usage:
if (containsStateAbbreviation(text, abbrev)) {
  return state;
}
```

### Better Implementation with Context
```typescript
/**
 * Smart state detection that checks context
 */
function detectStateFromAbbreviation(text: string, abbrev: string, stateName: string): boolean {
  // First check if full state name is present (higher confidence)
  if (text.toLowerCase().includes(stateName.toLowerCase())) {
    return true;
  }

  // For abbreviations, require word boundary
  const abbrevPattern = new RegExp(`\\b${abbrev}\\b`, 'gi');
  const matches = text.match(abbrevPattern);

  if (!matches) return false;

  // Additional context checks for common false positives
  const falsePositivePatterns: Record<string, RegExp[]> = {
    'NY': [/\bany\b/i, /\bmany\b/i],
    'TX': [/\btext\b/i, /\bnext\b/i],
    'IN': [/\bin\s+(the|a|an|this|that)\b/i], // "in the", not Indiana
    'OR': [/\bor\s+(a|an|the|not)\b/i], // "or the", not Oregon
    'ME': [/\bme\s+(too|a|the|to)\b/i, /\bgive me\b/i], // "give me", not Maine
  };

  // Check if any false positive pattern matches
  const fpPatterns = falsePositivePatterns[abbrev.toUpperCase()];
  if (fpPatterns) {
    for (const fp of fpPatterns) {
      if (fp.test(text)) {
        return false; // Likely false positive
      }
    }
  }

  return true;
}
```

---

## Task 3: Improve Duplicate Detection (MEDIUM)

### Current O(n^2) Problem
```typescript
// SLOW: Compares every pair
for (let i = 0; i < items.length; i++) {
  for (let j = i + 1; j < items.length; j++) {
    if (isSimilar(items[i], items[j])) {
      // Mark as duplicate
    }
  }
}
```

### Optimized Solution using LSH (Locality Sensitive Hashing)
```typescript
import { MinHash, LshIndex } from 'minhash-lsh'; // Or implement simple version

/**
 * Efficient duplicate detection using MinHash LSH
 */
class DuplicateDetector {
  private lshIndex: LshIndex;

  constructor(numBands: number = 20, rowsPerBand: number = 5) {
    this.lshIndex = new LshIndex(numBands, rowsPerBand);
  }

  /**
   * Find near-duplicates in O(n) average case
   */
  findDuplicates(items: TrendItem[]): Map<string, string[]> {
    const duplicateGroups = new Map<string, string[]>();

    // Index all items
    for (const item of items) {
      const shingles = this.createShingles(item.title + ' ' + item.summary);
      const signature = new MinHash(shingles);

      // Find candidates (items that hash to same bucket)
      const candidates = this.lshIndex.query(signature);

      for (const candidateId of candidates) {
        // Only do expensive similarity check on candidates
        const candidate = items.find(i => i.id === candidateId);
        if (candidate && this.isTrueDuplicate(item, candidate)) {
          // Group duplicates
          const group = duplicateGroups.get(candidateId) || [candidateId];
          group.push(item.id);
          duplicateGroups.set(candidateId, group);
        }
      }

      // Add to index
      this.lshIndex.insert(item.id, signature);
    }

    return duplicateGroups;
  }

  private createShingles(text: string, k: number = 3): Set<string> {
    const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, '');
    const words = normalized.split(/\s+/);
    const shingles = new Set<string>();

    for (let i = 0; i <= words.length - k; i++) {
      shingles.add(words.slice(i, i + k).join(' '));
    }

    return shingles;
  }

  private isTrueDuplicate(a: TrendItem, b: TrendItem): boolean {
    // Jaccard similarity on normalized text
    const setA = this.createShingles(a.title + ' ' + a.summary);
    const setB = this.createShingles(b.title + ' ' + b.summary);

    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const union = new Set([...setA, ...setB]);

    return intersection.size / union.size > 0.7; // 70% similarity threshold
  }
}
```

---

## Task 4: Add Retry Logic (MEDIUM)

### Retry Wrapper Function
```typescript
/**
 * Exponential backoff retry wrapper
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    retryOn?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    retryOn = (e) => e.message.includes('timeout') || e.message.includes('ECONNRESET')
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries || !retryOn(lastError)) {
        throw lastError;
      }

      console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));

      // Exponential backoff with jitter
      delay = Math.min(delay * 2 + Math.random() * 1000, maxDelay);
    }
  }

  throw lastError!;
}

// Usage in ingestion functions:
const response = await withRetry(
  () => fetch(rssUrl, { signal: AbortSignal.timeout(30000) }),
  { maxRetries: 3, initialDelay: 2000 }
);
```

---

## Task 5: Add Batch Size Validation (MEDIUM)

```typescript
const MAX_BATCH_SIZE = 1000;
const MIN_BATCH_SIZE = 1;

function validateBatchSize(items: unknown[], context: string): void {
  if (!Array.isArray(items)) {
    throw new Error(`${context}: Expected array, got ${typeof items}`);
  }

  if (items.length === 0) {
    console.warn(`${context}: Empty batch, nothing to process`);
    return;
  }

  if (items.length > MAX_BATCH_SIZE) {
    throw new Error(
      `${context}: Batch size ${items.length} exceeds max ${MAX_BATCH_SIZE}. ` +
      `Please split into smaller batches.`
    );
  }
}

// Usage:
validateBatchSize(trends, 'tag-trend-policy-domains');
```

---

## Execution Checklist

- [ ] Task 1: Replace Math.random() with actual performance calculation
- [ ] Task 2: Fix state abbreviation matching with word boundaries
- [ ] Task 3: Implement LSH-based duplicate detection
- [ ] Task 4: Add retry wrapper to ingestion functions
- [ ] Task 5: Add batch size validation

## Post-Fix Verification

Run Learning System Audit:
```bash
claude -p "Run audit-agents/06-learning-system-auditor.md on the News & Trends system"
```

Expected Results:
- Learning system: FUNCTIONAL (no longer BLOCKED)
- Performance values: Derived from actual metrics
- State matching: No false positives on common words
