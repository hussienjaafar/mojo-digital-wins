/**
 * TranscriptAnalysisPanel - Displays analysis tags from transcript
 *
 * Shows comprehensive analysis of video transcript including:
 * - Primary topic and tags
 * - Tone analysis
 * - Political stances and targets
 * - Donor pain points and values
 * - Key phrases and urgency drivers
 * - Colored tags by category
 */

import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Target,
  MessageSquare,
  AlertTriangle,
  Heart,
  Quote,
  Flame,
  Shield,
  Zap,
  Users,
} from 'lucide-react';
import type { TranscriptAnalysis } from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface TranscriptAnalysisPanelProps {
  analysis: TranscriptAnalysis;
  maxHeight?: string;
}

// =============================================================================
// Helper Components
// =============================================================================

interface AnalysisCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accentColor?: 'blue' | 'purple' | 'orange' | 'red' | 'green' | 'cyan';
}

const colorMap: Record<string, string> = {
  blue: 'border-blue-500/30 bg-blue-500/5',
  purple: 'border-[#a855f7]/30 bg-[#a855f7]/5',
  orange: 'border-[#f97316]/30 bg-[#f97316]/5',
  red: 'border-[#ef4444]/30 bg-[#ef4444]/5',
  green: 'border-[#22c55e]/30 bg-[#22c55e]/5',
  cyan: 'border-[#06b6d4]/30 bg-[#06b6d4]/5',
};

const iconColorMap: Record<string, string> = {
  blue: 'text-blue-400',
  purple: 'text-[#a855f7]',
  orange: 'text-[#f97316]',
  red: 'text-[#ef4444]',
  green: 'text-[#22c55e]',
  cyan: 'text-[#06b6d4]',
};

function AnalysisCard({ title, icon, children, accentColor = 'blue' }: AnalysisCardProps) {
  return (
    <div className={cn('rounded-lg border p-4', colorMap[accentColor])}>
      <div className="flex items-center gap-2 mb-3">
        <span className={iconColorMap[accentColor]}>{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
          {title}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

interface TagListProps {
  items: string[];
  accentColor?: 'blue' | 'purple' | 'orange' | 'red' | 'green' | 'cyan';
}

const tagColorMap: Record<string, string> = {
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  purple: 'bg-[#a855f7]/10 border-[#a855f7]/30 text-[#a855f7]',
  orange: 'bg-[#f97316]/10 border-[#f97316]/30 text-[#f97316]',
  red: 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]',
  green: 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]',
  cyan: 'bg-[#06b6d4]/10 border-[#06b6d4]/30 text-[#06b6d4]',
};

function TagList({ items, accentColor = 'blue' }: TagListProps) {
  if (items.length === 0) {
    return <span className="text-sm text-[#64748b] italic">None detected</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <span
          key={idx}
          className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs', tagColorMap[accentColor])}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

interface BulletListProps {
  items: string[];
}

function BulletList({ items }: BulletListProps) {
  if (items.length === 0) {
    return <span className="text-sm text-[#64748b] italic">None detected</span>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm text-[#e2e8f0]">
          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#64748b]" />
          {item}
        </li>
      ))}
    </ul>
  );
}

interface PrimaryBadgeProps {
  text: string;
  accentColor?: 'blue' | 'purple' | 'orange' | 'red' | 'green' | 'cyan';
}

const primaryBadgeColorMap: Record<string, string> = {
  blue: 'bg-blue-500/20 border-blue-500/40 text-blue-400',
  purple: 'bg-[#a855f7]/20 border-[#a855f7]/40 text-[#a855f7]',
  orange: 'bg-[#f97316]/20 border-[#f97316]/40 text-[#f97316]',
  red: 'bg-[#ef4444]/20 border-[#ef4444]/40 text-[#ef4444]',
  green: 'bg-[#22c55e]/20 border-[#22c55e]/40 text-[#22c55e]',
  cyan: 'bg-[#06b6d4]/20 border-[#06b6d4]/40 text-[#06b6d4]',
};

function PrimaryBadge({ text, accentColor = 'blue' }: PrimaryBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-3 py-1 text-sm font-medium',
        primaryBadgeColorMap[accentColor]
      )}
    >
      {text}
    </span>
  );
}

// =============================================================================
// Component
// =============================================================================

export function TranscriptAnalysisPanel({
  analysis,
  maxHeight = '480px',
}: TranscriptAnalysisPanelProps) {
  return (
    <ScrollArea style={{ height: maxHeight }}>
      <div className="space-y-4 pr-4">
        {/* Primary Topic/Issue */}
        <AnalysisCard
          title="Primary Topic"
          icon={<Target className="h-4 w-4" />}
          accentColor="blue"
        >
          <div className="space-y-3">
            {analysis.topic_primary && <PrimaryBadge text={analysis.topic_primary} accentColor="blue" />}
            {analysis.topic_tags.length > 0 && (
              <TagList items={analysis.topic_tags} accentColor="blue" />
            )}
            {analysis.issue_primary && !analysis.topic_primary && (
              <PrimaryBadge text={analysis.issue_primary} accentColor="blue" />
            )}
            {analysis.issue_tags.length > 0 && analysis.topic_tags.length === 0 && (
              <TagList items={analysis.issue_tags} accentColor="blue" />
            )}
          </div>
        </AnalysisCard>

        {/* Tone */}
        <AnalysisCard
          title="Tone"
          icon={<MessageSquare className="h-4 w-4" />}
          accentColor="purple"
        >
          <div className="space-y-3">
            {analysis.tone_primary && <PrimaryBadge text={analysis.tone_primary} accentColor="purple" />}
            {analysis.tone_tags.length > 0 && (
              <TagList items={analysis.tone_tags} accentColor="purple" />
            )}
            {/* Sentiment score */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-[#64748b]">Sentiment:</span>
              <div className="flex-1 h-2 bg-[#1e2a45] rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    analysis.sentiment_score >= 0.5
                      ? 'bg-[#22c55e]'
                      : analysis.sentiment_score >= 0
                      ? 'bg-[#f97316]'
                      : 'bg-[#ef4444]'
                  )}
                  style={{ width: `${Math.abs(analysis.sentiment_score) * 50 + 50}%` }}
                />
              </div>
              <span className="text-xs text-[#94a3b8] tabular-nums w-10 text-right">
                {analysis.sentiment_score.toFixed(2)}
              </span>
            </div>
          </div>
        </AnalysisCard>

        {/* Political Stances */}
        {analysis.political_stances.length > 0 && (
          <AnalysisCard
            title="Political Stances"
            icon={<Shield className="h-4 w-4" />}
            accentColor="cyan"
          >
            <BulletList items={analysis.political_stances} />
          </AnalysisCard>
        )}

        {/* Targets Attacked */}
        {analysis.targets_attacked.length > 0 && (
          <AnalysisCard
            title="Targets Attacked"
            icon={<AlertTriangle className="h-4 w-4" />}
            accentColor="red"
          >
            <BulletList items={analysis.targets_attacked} />
          </AnalysisCard>
        )}

        {/* Targets Supported */}
        {analysis.targets_supported.length > 0 && (
          <AnalysisCard
            title="Targets Supported"
            icon={<Users className="h-4 w-4" />}
            accentColor="green"
          >
            <BulletList items={analysis.targets_supported} />
          </AnalysisCard>
        )}

        {/* Donor Pain Points */}
        {analysis.donor_pain_points.length > 0 && (
          <AnalysisCard
            title="Donor Pain Points"
            icon={<Heart className="h-4 w-4" />}
            accentColor="orange"
          >
            <BulletList items={analysis.donor_pain_points} />
          </AnalysisCard>
        )}

        {/* Values Appealed */}
        {analysis.values_appealed.length > 0 && (
          <AnalysisCard
            title="Values Appealed"
            icon={<Heart className="h-4 w-4" />}
            accentColor="purple"
          >
            <TagList items={analysis.values_appealed} accentColor="purple" />
          </AnalysisCard>
        )}

        {/* Urgency Drivers */}
        {analysis.urgency_drivers.length > 0 && (
          <AnalysisCard
            title="Urgency Drivers"
            icon={<Zap className="h-4 w-4" />}
            accentColor="orange"
          >
            <div className="space-y-2">
              <TagList items={analysis.urgency_drivers} accentColor="orange" />
              {analysis.urgency_level && (
                <div className="flex items-center gap-2 mt-2">
                  <Flame className="h-3.5 w-3.5 text-[#f97316]" />
                  <span className="text-xs text-[#94a3b8]">
                    Urgency Level: <span className="text-[#f97316] font-medium">{analysis.urgency_level}</span>
                  </span>
                </div>
              )}
            </div>
          </AnalysisCard>
        )}

        {/* Key Phrases */}
        <AnalysisCard
          title="Key Phrases"
          icon={<Quote className="h-4 w-4" />}
          accentColor="green"
        >
          <div className="space-y-2">
            {analysis.key_phrases.length === 0 ? (
              <span className="text-sm text-[#64748b] italic">None detected</span>
            ) : (
              analysis.key_phrases.map((phrase, idx) => (
                <p key={idx} className="text-sm text-[#e2e8f0] italic">
                  "{phrase}"
                </p>
              ))
            )}
          </div>
        </AnalysisCard>

        {/* CTA if present */}
        {analysis.cta_text && (
          <AnalysisCard
            title="Call to Action"
            icon={<Target className="h-4 w-4" />}
            accentColor="green"
          >
            <p className="text-sm text-[#e2e8f0] font-medium">"{analysis.cta_text}"</p>
          </AnalysisCard>
        )}
      </div>
    </ScrollArea>
  );
}

export default TranscriptAnalysisPanel;
