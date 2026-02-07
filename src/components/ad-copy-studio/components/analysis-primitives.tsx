/**
 * Shared analysis display primitives for Ad Copy Studio
 * 
 * Extracted from TranscriptReviewStep and TranscriptAnalysisPanel (Issue C1)
 * to eliminate duplication across components.
 */

import { cn } from '@/lib/utils';

// =============================================================================
// AnalysisCard
// =============================================================================

interface AnalysisCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accentColor?: string;
}

const COLOR_MAP: Record<string, string> = {
  blue: 'border-blue-500/30 bg-blue-500/5',
  purple: 'border-[#a855f7]/30 bg-[#a855f7]/5',
  orange: 'border-[#f97316]/30 bg-[#f97316]/5',
  red: 'border-[#ef4444]/30 bg-[#ef4444]/5',
  green: 'border-[#22c55e]/30 bg-[#22c55e]/5',
};

const ICON_COLOR_MAP: Record<string, string> = {
  blue: 'text-blue-400',
  purple: 'text-[#a855f7]',
  orange: 'text-[#f97316]',
  red: 'text-[#ef4444]',
  green: 'text-[#22c55e]',
};

export function AnalysisCard({ title, icon, children, accentColor = 'blue' }: AnalysisCardProps) {
  return (
    <div className={cn('rounded-lg border p-4', COLOR_MAP[accentColor])}>
      <div className="flex items-center gap-2 mb-3">
        <span className={ICON_COLOR_MAP[accentColor]}>{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
          {title}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

// =============================================================================
// TagList
// =============================================================================

interface TagListProps {
  items: string[];
  accentColor?: string;
}

const TAG_COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  purple: 'bg-[#a855f7]/10 border-[#a855f7]/30 text-[#a855f7]',
  orange: 'bg-[#f97316]/10 border-[#f97316]/30 text-[#f97316]',
  red: 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]',
  green: 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]',
};

export function TagList({ items, accentColor = 'blue' }: TagListProps) {
  if (items.length === 0) {
    return <span className="text-sm text-[#64748b] italic">None detected</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <span
          key={idx}
          className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs', TAG_COLOR_MAP[accentColor])}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// =============================================================================
// BulletList
// =============================================================================

interface BulletListProps {
  items: string[];
}

export function BulletList({ items }: BulletListProps) {
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

// =============================================================================
// Char Count Helper
// =============================================================================

export function getCharCountColor(count: number, maxRecommended: number, maxAllowed: number): string {
  if (count <= maxRecommended) return 'text-[#22c55e]';
  if (count <= maxAllowed) return 'text-[#f97316]';
  return 'text-[#ef4444]';
}
