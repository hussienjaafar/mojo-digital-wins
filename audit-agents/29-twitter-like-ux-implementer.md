# Twitter-Like UX Implementer

**Agent ID:** 29
**Role:** Frontend Engineer / Full-Stack Developer
**Focus:** Implement article-based drill-down like Twitter/X
**Priority:** HIGH
**Estimated Time:** 4-6 hours
**Dependencies:** Audit findings from Agents 26-27

---

## Overview

Transform the trend drill-down from technical metrics to a Twitter/X-like experience:

**Current State:**
- Shows z-scores, baseline deltas, confidence factors
- Evidence timeline is secondary
- Articles are not prominently displayed

**Target State:**
- Featured article at top (like Twitter's pinned tweet)
- "Why it's trending" in simple language
- Article list as primary content
- Social mentions as secondary section
- Click any article to open in new tab

---

## Reference: Twitter/X Trending UX

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔥 Trump Fires FBI Director                                     │
│ Trending in Politics · 125K posts                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ WHY IT'S TRENDING                                               │
│ Breaking news: President Trump announced the firing of FBI      │
│ Director Christopher Wray, citing ongoing investigations.       │
│ The story is being covered by major news outlets.              │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ 📰 TOP STORIES                                                  │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🏆 TIER 1 · New York Times · 2h ago                         │ │
│ │ Trump Fires FBI Director Christopher Wray                   │ │
│ │ President Trump announced the dismissal of FBI Director...  │ │
│ │ [Read full story →]                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ TIER 2 · Washington Post · 3h ago                           │ │
│ │ Wray Out: What This Means for the FBI                       │ │
│ │ [Read full story →]                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ TIER 2 · Reuters · 4h ago                                   │ │
│ │ FBI Director Wray Removed by Trump Administration           │ │
│ │ [Read full story →]                                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ [Show 12 more articles ▼]                                       │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│ 💬 SOCIAL MENTIONS (45 posts)                                   │
│                                                                  │
│ Latest posts from Bluesky about this topic...                   │
│ [View all social mentions →]                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Step 1: Create New Components

#### 1.1 FeaturedArticle Component

**File:** `src/components/client/FeaturedArticle.tsx`

```tsx
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Award, Newspaper } from "lucide-react";
import { V3Badge } from "@/components/v3";
import { cn } from "@/lib/utils";

interface FeaturedArticleProps {
  headline: string;
  source: string;
  url: string;
  publishedAt: string;
  tier?: 'tier1' | 'tier2' | 'tier3';
  description?: string;
}

export function FeaturedArticle({
  headline,
  source,
  url,
  publishedAt,
  tier,
  description
}: FeaturedArticleProps) {
  const tierConfig = {
    tier1: { label: 'Tier 1', color: 'text-amber-500', bg: 'bg-amber-500/10' },
    tier2: { label: 'Tier 2', color: 'text-blue-500', bg: 'bg-blue-500/10' },
    tier3: { label: 'Tier 3', color: 'text-slate-500', bg: 'bg-slate-500/10' },
  };

  const config = tier ? tierConfig[tier] : null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block p-4 rounded-lg border-2 transition-all",
        "border-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-bg-elevated))]",
        "hover:border-[hsl(var(--portal-accent-blue))]/80 hover:shadow-lg"
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Award className="w-4 h-4 text-amber-500" />
        <span className="text-xs font-semibold text-amber-500 uppercase">Featured Story</span>
        {config && (
          <V3Badge variant="muted" className={cn(config.bg, config.color)}>
            {config.label}
          </V3Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {formatDistanceToNow(new Date(publishedAt), { addSuffix: true })}
        </span>
      </div>

      <h3 className="text-lg font-semibold mb-1 line-clamp-2">
        {headline}
      </h3>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Newspaper className="w-3 h-3" />
        <span>{source}</span>
        <ExternalLink className="w-3 h-3 ml-auto" />
      </div>

      {description && (
        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
          {description}
        </p>
      )}
    </a>
  );
}
```

#### 1.2 ArticleList Component

**File:** `src/components/client/ArticleList.tsx`

```tsx
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ExternalLink, Newspaper, ChevronDown, ChevronUp } from "lucide-react";
import { V3Badge, V3Button } from "@/components/v3";
import { cn } from "@/lib/utils";
import type { TrendEvidence } from "@/hooks/useTrendEvents";

interface ArticleListProps {
  articles: TrendEvidence[];
  initialLimit?: number;
}

function getTierBadge(tier?: string) {
  switch (tier) {
    case 'tier1':
      return <V3Badge variant="success" className="text-xs">Tier 1</V3Badge>;
    case 'tier2':
      return <V3Badge variant="info" className="text-xs">Tier 2</V3Badge>;
    case 'tier3':
      return <V3Badge variant="muted" className="text-xs">Tier 3</V3Badge>;
    default:
      return null;
  }
}

function ArticleCard({ article }: { article: TrendEvidence }) {
  return (
    <a
      href={article.source_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg transition-all",
        "bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]",
        "hover:border-[hsl(var(--portal-accent-blue))]/50 hover:bg-[hsl(var(--portal-bg-elevated))]/80",
        !article.source_url && "pointer-events-none opacity-60"
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {getTierBadge(article.source_tier)}
          <span className="text-xs text-muted-foreground">
            {article.source_domain || 'Unknown Source'}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {article.published_at
              ? formatDistanceToNow(new Date(article.published_at), { addSuffix: true })
              : 'Recently'}
          </span>
        </div>

        <h4 className="text-sm font-medium line-clamp-2">
          {article.headline || article.source_url || 'Untitled Article'}
        </h4>
      </div>

      {article.source_url && (
        <ExternalLink className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-1" />
      )}
    </a>
  );
}

export function ArticleList({ articles, initialLimit = 5 }: ArticleListProps) {
  const [expanded, setExpanded] = useState(false);

  // Filter to only articles with URLs, sorted by tier then recency
  const sortedArticles = [...articles]
    .filter(a => a.source_url && a.source_type !== 'bluesky')
    .sort((a, b) => {
      // Sort by tier first
      const tierOrder = { tier1: 0, tier2: 1, tier3: 2 };
      const tierA = tierOrder[a.source_tier as keyof typeof tierOrder] ?? 3;
      const tierB = tierOrder[b.source_tier as keyof typeof tierOrder] ?? 3;
      if (tierA !== tierB) return tierA - tierB;

      // Then by recency
      const dateA = a.published_at ? new Date(a.published_at).getTime() : 0;
      const dateB = b.published_at ? new Date(b.published_at).getTime() : 0;
      return dateB - dateA;
    });

  const displayedArticles = expanded ? sortedArticles : sortedArticles.slice(0, initialLimit);
  const hasMore = sortedArticles.length > initialLimit;

  if (sortedArticles.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <Newspaper className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No articles available for this trend</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Newspaper className="w-4 h-4" />
          News Coverage
          <span className="text-sm font-normal text-muted-foreground">
            ({sortedArticles.length} articles)
          </span>
        </h3>
      </div>

      <div className="space-y-2">
        {displayedArticles.map((article, idx) => (
          <ArticleCard key={article.id || idx} article={article} />
        ))}
      </div>

      {hasMore && (
        <V3Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              Show {sortedArticles.length - initialLimit} more articles
            </>
          )}
        </V3Button>
      )}
    </div>
  );
}
```

#### 1.3 SocialMentions Component

**File:** `src/components/client/SocialMentions.tsx`

```tsx
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { V3Badge, V3Button } from "@/components/v3";
import { cn } from "@/lib/utils";
import type { TrendEvidence } from "@/hooks/useTrendEvents";

interface SocialMentionsProps {
  posts: TrendEvidence[];
  initialLimit?: number;
}

function SocialCard({ post }: { post: TrendEvidence }) {
  return (
    <a
      href={post.source_url || '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg transition-all",
        "bg-[hsl(var(--portal-bg))] border border-[hsl(var(--portal-border))]",
        "hover:border-[hsl(var(--portal-accent-blue))]/50",
        !post.source_url && "pointer-events-none opacity-60"
      )}
    >
      <MessageCircle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-1" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-blue-400">Bluesky</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {post.published_at
              ? formatDistanceToNow(new Date(post.published_at), { addSuffix: true })
              : 'Recently'}
          </span>
          {post.sentiment_label && (
            <V3Badge
              variant={
                post.sentiment_label === 'positive' ? 'success' :
                post.sentiment_label === 'negative' ? 'destructive' : 'muted'
              }
              className="text-xs ml-auto"
            >
              {post.sentiment_label}
            </V3Badge>
          )}
        </div>

        <p className="text-sm line-clamp-3">
          {post.headline || 'Social post about this topic'}
        </p>
      </div>

      {post.source_url && (
        <ExternalLink className="w-3 h-3 text-muted-foreground flex-shrink-0" />
      )}
    </a>
  );
}

export function SocialMentions({ posts, initialLimit = 3 }: SocialMentionsProps) {
  const [expanded, setExpanded] = useState(false);

  const socialPosts = posts.filter(p => p.source_type === 'bluesky');
  const displayedPosts = expanded ? socialPosts : socialPosts.slice(0, initialLimit);
  const hasMore = socialPosts.length > initialLimit;

  if (socialPosts.length === 0) {
    return null; // Don't show section if no social mentions
  }

  return (
    <div className="space-y-3 pt-4 border-t border-[hsl(var(--portal-border))]">
      <h3 className="font-semibold flex items-center gap-2 text-sm">
        <MessageCircle className="w-4 h-4" />
        Social Mentions
        <span className="font-normal text-muted-foreground">
          ({socialPosts.length} posts)
        </span>
      </h3>

      <div className="space-y-2">
        {displayedPosts.map((post, idx) => (
          <SocialCard key={post.id || idx} post={post} />
        ))}
      </div>

      {hasMore && (
        <V3Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="w-full text-xs"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3 mr-1" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 mr-1" />
              View all {socialPosts.length} social mentions
            </>
          )}
        </V3Button>
      )}
    </div>
  );
}
```

#### 1.4 WhyTrendingSimple Component

**File:** `src/components/client/WhyTrendingSimple.tsx`

```tsx
import { TrendingUp, Clock, Globe, Zap, BarChart3 } from "lucide-react";
import type { TrendEvent } from "@/hooks/useTrendEvents";
import { formatDistanceToNow } from "date-fns";

interface WhyTrendingSimpleProps {
  trend: TrendEvent;
}

function generateSimpleExplanation(trend: TrendEvent): string {
  const parts: string[] = [];

  // Breaking news indicator
  if (trend.is_breaking) {
    parts.push("Breaking news");
  }

  // Velocity description
  const velocity = trend.z_score_velocity || 0;
  if (velocity >= 5) {
    parts.push("surging with extreme activity");
  } else if (velocity >= 3) {
    parts.push("rapidly growing coverage");
  } else if (velocity >= 2) {
    parts.push("gaining significant attention");
  } else {
    parts.push("being discussed");
  }

  // Source coverage
  const sourceCount = trend.source_count || 0;
  if (sourceCount >= 10) {
    parts.push(`across ${sourceCount}+ news sources`);
  } else if (sourceCount >= 5) {
    parts.push(`across multiple major outlets`);
  } else if (sourceCount >= 3) {
    parts.push(`from several sources`);
  }

  // Confidence indicator
  const confidence = trend.confidence_score || 0;
  if (confidence >= 80) {
    parts.push("with high confidence");
  } else if (confidence >= 60) {
    parts.push("with verified coverage");
  }

  return parts.join(" ");
}

export function WhyTrendingSimple({ trend }: WhyTrendingSimpleProps) {
  const explanation = generateSimpleExplanation(trend);
  const trendingDuration = trend.first_seen_at
    ? formatDistanceToNow(new Date(trend.first_seen_at))
    : null;

  return (
    <div className="bg-[hsl(var(--portal-bg))] rounded-lg p-4 space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-[hsl(var(--portal-accent-blue))]" />
        Why it's trending
      </h3>

      <p className="text-sm text-muted-foreground">
        {explanation}
      </p>

      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {trend.source_count && (
          <div className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            <span>{trend.source_count} sources</span>
          </div>
        )}

        {trend.evidence_count && (
          <div className="flex items-center gap-1">
            <BarChart3 className="w-3 h-3" />
            <span>{trend.evidence_count} mentions</span>
          </div>
        )}

        {trendingDuration && (
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>Trending for {trendingDuration}</span>
          </div>
        )}

        {trend.is_breaking && (
          <div className="flex items-center gap-1 text-amber-500">
            <Zap className="w-3 h-3" />
            <span>Breaking</span>
          </div>
        )}
      </div>
    </div>
  );
}
```

---

### Step 2: Update TrendDrilldownPanel

**File:** `src/components/client/TrendDrilldownPanel.tsx`

Replace the current layout with the new Twitter-like structure:

```tsx
// Add imports at top
import { FeaturedArticle } from "./FeaturedArticle";
import { ArticleList } from "./ArticleList";
import { SocialMentions } from "./SocialMentions";
import { WhyTrendingSimple } from "./WhyTrendingSimple";

// In the component, restructure the layout:
export function TrendDrilldownPanel({
  trend,
  organizationId,
  relevanceExplanation,
  onClose
}: TrendDrilldownPanelProps) {
  const { evidence, loading: evidenceLoading } = useTrendEvidence(trend.id);

  // Get featured article (tier1 first, then highest quality)
  const featuredArticle = evidence
    ?.filter(e => e.source_url && e.source_type !== 'bluesky')
    .sort((a, b) => {
      const tierOrder = { tier1: 0, tier2: 1, tier3: 2 };
      const tierA = tierOrder[a.source_tier as keyof typeof tierOrder] ?? 3;
      const tierB = tierOrder[b.source_tier as keyof typeof tierOrder] ?? 3;
      return tierA - tierB;
    })[0];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-lg font-semibold">{trend.event_title}</h2>
          {trend.policy_domains?.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {trend.policy_domains[0]}
            </span>
          )}
        </div>
        <button onClick={onClose}>
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {/* Why Trending - Simple explanation */}
          <WhyTrendingSimple trend={trend} />

          {/* Featured Article */}
          {featuredArticle && (
            <FeaturedArticle
              headline={featuredArticle.headline || trend.top_headline || trend.event_title}
              source={featuredArticle.source_domain || 'News Source'}
              url={featuredArticle.source_url!}
              publishedAt={featuredArticle.published_at || new Date().toISOString()}
              tier={featuredArticle.source_tier as 'tier1' | 'tier2' | 'tier3'}
            />
          )}

          {/* Article List - Primary content */}
          {evidenceLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading articles...
            </div>
          ) : (
            <ArticleList articles={evidence || []} initialLimit={5} />
          )}

          {/* Social Mentions - Secondary */}
          {evidence && <SocialMentions posts={evidence} initialLimit={3} />}

          {/* Relevance explanation (if org-specific) */}
          {relevanceExplanation && (
            <div className="bg-[hsl(var(--portal-accent-blue))]/10 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-1">Why this matters to you</h4>
              <p className="text-sm text-muted-foreground">{relevanceExplanation}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
```

---

### Step 3: Update Evidence Query

Ensure the `useTrendEvidence` hook fetches all needed fields:

```typescript
// In src/hooks/useTrendEvents.tsx - update the evidence query
const { data: evidenceData } = await supabase
  .from('trend_evidence')
  .select(`
    id,
    headline,
    source_url,
    source_domain,
    source_type,
    source_tier,
    published_at,
    sentiment_label,
    sentiment_score,
    is_primary,
    contribution_score
  `)
  .eq('trend_event_id', trendId)
  .order('source_tier', { ascending: true, nullsFirst: false })
  .order('published_at', { ascending: false })
  .limit(50);
```

---

## Verification Checklist

- [ ] FeaturedArticle component created and styled
- [ ] ArticleList component with expand/collapse
- [ ] SocialMentions component for Bluesky posts
- [ ] WhyTrendingSimple with non-technical explanation
- [ ] TrendDrilldownPanel restructured
- [ ] Articles sorted by tier then recency
- [ ] All articles clickable with external links
- [ ] Mobile responsive layout
- [ ] Loading states handled

---

## Testing

1. **Visual Test:**
   - Open a trending topic drill-down
   - Verify featured article appears at top
   - Verify article list is primary content
   - Click articles → should open in new tab

2. **Data Test:**
   - Check console for missing URLs
   - Verify tier badges display correctly
   - Verify relative timestamps work

3. **Mobile Test:**
   - Test on narrow viewport
   - Verify touch targets are adequate
   - Verify scrolling works

---

## Next Agent

After completing UX implementation, proceed to:
→ `30-ground-truth-integrator.md` (Implement automated accuracy tracking)
