import { useState } from "react";
import { 
  X, 
  Plus, 
  Trophy, 
  TrendingUp,
  TrendingDown,
  Equal,
  Eye,
  MousePointer,
  DollarSign,
  Video,
  Image as ImageIcon
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { V3Card, V3CardContent, V3Badge, V3Button } from "@/components/v3";
import { iconSizes } from "@/lib/design-tokens";

interface Creative {
  id: string;
  headline: string | null;
  primary_text: string | null;
  thumbnail_url: string | null;
  creative_type: string;
  spend: number;
  roas: number | null;
  impressions: number;
  ctr: number | null;
  conversions: number;
  performance_tier: string | null;
}

interface CreativeComparisonProps {
  pinnedCreatives: [Creative | null, Creative | null];
  onRemove: (slot: 0 | 1) => void;
  onClear: () => void;
  className?: string;
}

interface MetricComparisonProps {
  label: string;
  icon: typeof Eye;
  value1: number | null;
  value2: number | null;
  format: (v: number) => string;
  higherIsBetter?: boolean;
}

function MetricComparison({ 
  label, 
  icon: Icon, 
  value1, 
  value2, 
  format, 
  higherIsBetter = true 
}: MetricComparisonProps) {
  const v1 = value1 ?? 0;
  const v2 = value2 ?? 0;
  
  let winner: 0 | 1 | 'tie' | null = null;
  if (v1 > 0 && v2 > 0) {
    if (v1 > v2) winner = higherIsBetter ? 0 : 1;
    else if (v2 > v1) winner = higherIsBetter ? 1 : 0;
    else winner = 'tie';
  }

  const percentDiff = v1 > 0 && v2 > 0 
    ? Math.round(((Math.max(v1, v2) - Math.min(v1, v2)) / Math.min(v1, v2)) * 100)
    : 0;

  return (
    <div className="py-3 border-b border-[hsl(var(--portal-border)/0.3)] last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        {/* Slot 1 Value */}
        <div className={cn(
          "flex-1 text-right transition-all",
          winner === 0 && "scale-105"
        )}>
          <span className={cn(
            "text-sm font-semibold",
            winner === 0 
              ? "text-[hsl(var(--portal-success))]" 
              : "text-[hsl(var(--portal-text-primary))]"
          )}>
            {value1 != null ? format(value1) : '-'}
          </span>
          {winner === 0 && (
            <Trophy className={cn(iconSizes.xs, "inline ml-1 text-[hsl(var(--portal-success))]")} />
          )}
        </div>

        {/* Label (Center) */}
        <div className="flex flex-col items-center min-w-[100px]">
          <div className="flex items-center gap-1 text-xs text-[hsl(var(--portal-text-muted))]">
            <Icon className={iconSizes.xs} />
            {label}
          </div>
          {percentDiff > 0 && winner !== 'tie' && (
            <div className="flex items-center gap-0.5 text-xs mt-0.5">
              {winner === 0 ? (
                <TrendingUp className={cn(iconSizes.xs, "text-[hsl(var(--portal-success))]")} />
              ) : (
                <TrendingDown className={cn(iconSizes.xs, "text-[hsl(var(--portal-error))]")} />
              )}
              <span className={cn(
                winner === 0 
                  ? "text-[hsl(var(--portal-success))]" 
                  : "text-[hsl(var(--portal-error))]"
              )}>
                {percentDiff}%
              </span>
            </div>
          )}
          {winner === 'tie' && (
            <div className="flex items-center gap-0.5 text-xs mt-0.5 text-[hsl(var(--portal-text-muted))]">
              <Equal className={iconSizes.xs} />
              Tie
            </div>
          )}
        </div>

        {/* Slot 2 Value */}
        <div className={cn(
          "flex-1 text-left transition-all",
          winner === 1 && "scale-105"
        )}>
          {winner === 1 && (
            <Trophy className={cn(iconSizes.xs, "inline mr-1 text-[hsl(var(--portal-success))]")} />
          )}
          <span className={cn(
            "text-sm font-semibold",
            winner === 1 
              ? "text-[hsl(var(--portal-success))]" 
              : "text-[hsl(var(--portal-text-primary))]"
          )}>
            {value2 != null ? format(value2) : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[200px] border-2 border-dashed border-[hsl(var(--portal-border)/0.5)] rounded-lg bg-[hsl(var(--portal-bg-secondary)/0.3)]">
      <Plus className={cn(iconSizes.lg, "text-[hsl(var(--portal-text-muted))] mb-2")} />
      <p className="text-sm text-[hsl(var(--portal-text-muted))]">{label}</p>
      <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
        Click "Pin" on any creative
      </p>
    </div>
  );
}

function CreativeSlot({ 
  creative, 
  onRemove,
  slotLabel 
}: { 
  creative: Creative; 
  onRemove: () => void;
  slotLabel: string;
}) {
  const isVideo = creative.creative_type === 'video';
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="relative h-full"
    >
      <V3Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
        onClick={onRemove}
      >
        <X className={iconSizes.sm} />
      </V3Button>
      
      <div className="h-full flex flex-col">
        {/* Thumbnail */}
        <div className="relative aspect-video rounded-lg overflow-hidden bg-[hsl(var(--portal-bg-secondary))]">
          {creative.thumbnail_url ? (
            <img 
              src={creative.thumbnail_url}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isVideo ? (
                <Video className={cn(iconSizes.xl, "text-[hsl(var(--portal-text-muted))]")} />
              ) : (
                <ImageIcon className={cn(iconSizes.xl, "text-[hsl(var(--portal-text-muted))]")} />
              )}
            </div>
          )}
          <div className="absolute top-2 left-2">
            <V3Badge variant="secondary" size="sm">{slotLabel}</V3Badge>
          </div>
          {creative.performance_tier && (
            <div className="absolute bottom-2 left-2">
              <V3Badge 
                variant={creative.performance_tier === 'Top Performer' ? 'success' : 
                         creative.performance_tier === 'Average' ? 'pending' : 'error'}
                size="sm"
              >
                {creative.performance_tier}
              </V3Badge>
            </div>
          )}
        </div>
        
        {/* Title */}
        <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mt-2 line-clamp-2 flex-1">
          {creative.headline || creative.primary_text?.slice(0, 60) || 'Untitled'}
        </p>
      </div>
    </motion.div>
  );
}

export function CreativeComparison({
  pinnedCreatives,
  onRemove,
  onClear,
  className,
}: CreativeComparisonProps) {
  const [creative1, creative2] = pinnedCreatives;
  const hasBoth = creative1 && creative2;
  const hasAny = creative1 || creative2;

  if (!hasAny) {
    return null; // Don't show component if no creatives pinned
  }

  return (
    <V3Card className={cn("overflow-hidden", className)}>
      <V3CardContent className="p-0">
        {/* Header */}
        <div className="p-4 border-b border-[hsl(var(--portal-border)/0.5)] flex items-center justify-between">
          <h3 className="text-base font-semibold text-[hsl(var(--portal-text-primary))]">
            Creative Comparison
          </h3>
          {hasAny && (
            <V3Button variant="ghost" size="sm" onClick={onClear}>
              Clear All
            </V3Button>
          )}
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 gap-6">
            {/* Slot 1 */}
            <AnimatePresence mode="wait">
              {creative1 ? (
                <CreativeSlot 
                  key={creative1.id}
                  creative={creative1} 
                  onRemove={() => onRemove(0)}
                  slotLabel="A"
                />
              ) : (
                <EmptySlot key="empty-1" label="Creative A" />
              )}
            </AnimatePresence>

            {/* Slot 2 */}
            <AnimatePresence mode="wait">
              {creative2 ? (
                <CreativeSlot 
                  key={creative2.id}
                  creative={creative2} 
                  onRemove={() => onRemove(1)}
                  slotLabel="B"
                />
              ) : (
                <EmptySlot key="empty-2" label="Creative B" />
              )}
            </AnimatePresence>
          </div>

          {/* Metrics Comparison */}
          {hasBoth && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 pt-4 border-t border-[hsl(var(--portal-border)/0.5)]"
            >
              <MetricComparison
                label="ROAS"
                icon={DollarSign}
                value1={creative1.roas}
                value2={creative2.roas}
                format={(v) => `${v.toFixed(2)}x`}
                higherIsBetter
              />
              <MetricComparison
                label="Link CTR"
                icon={MousePointer}
                value1={creative1.ctr}
                value2={creative2.ctr}
                format={(v) => `${(v * 100).toFixed(2)}%`}
                higherIsBetter
              />
              <MetricComparison
                label="Spend"
                icon={DollarSign}
                value1={creative1.spend}
                value2={creative2.spend}
                format={(v) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                higherIsBetter={false} // Lower spend for same results is better
              />
              <MetricComparison
                label="Impressions"
                icon={Eye}
                value1={creative1.impressions}
                value2={creative2.impressions}
                format={(v) => v.toLocaleString()}
                higherIsBetter
              />
              <MetricComparison
                label="Conversions"
                icon={TrendingUp}
                value1={creative1.conversions}
                value2={creative2.conversions}
                format={(v) => v.toLocaleString()}
                higherIsBetter
              />
            </motion.div>
          )}
        </div>
      </V3CardContent>
    </V3Card>
  );
}
