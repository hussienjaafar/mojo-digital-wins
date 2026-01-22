import * as React from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, MessageSquare, Heading, FileText, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { V3Card, V3CardContent, V3SectionHeader } from "@/components/v3";
import type { CreativeVariation } from "./CreativeVariationTable";

interface VariationWinnerCardProps {
  variations: CreativeVariation[];
  className?: string;
}

const assetTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  body: { label: "Primary Text", icon: MessageSquare, color: "purple" },
  title: { label: "Headline", icon: Heading, color: "blue" },
  description: { label: "Description", icon: FileText, color: "green" },
};

const formatRoas = (n: number | null | undefined): string => {
  if (n === null || n === undefined || n === 0) return "—";
  return `${n.toFixed(2)}x`;
};

export const VariationWinnerCard: React.FC<VariationWinnerCardProps> = ({
  variations,
  className,
}) => {
  // Find best performer for each text asset type
  const winners = React.useMemo(() => {
    const grouped: Record<string, CreativeVariation | null> = {};
    
    for (const type of ["body", "title", "description"]) {
      const typeVars = variations.filter((v) => v.asset_type === type && v.impressions > 0);
      if (typeVars.length === 0) {
        grouped[type] = null;
        continue;
      }
      // Sort by ROAS descending
      typeVars.sort((a, b) => (b.roas ?? 0) - (a.roas ?? 0));
      grouped[type] = typeVars[0];
    }
    
    return grouped;
  }, [variations]);

  const hasAnyWinners = Object.values(winners).some((w) => w !== null);

  if (!hasAnyWinners) {
    return null;
  }

  return (
    <V3Card className={className}>
      <V3CardContent>
        <V3SectionHeader
          title="Top Performing Copy"
          subtitle="Best performing variation for each asset type"
          icon={Trophy}
          size="sm"
          className="mb-4"
        />

        <div className="grid gap-4 md:grid-cols-3">
          {(["body", "title", "description"] as const).map((type) => {
            const winner = winners[type];
            const config = assetTypeConfig[type];
            const Icon = config.icon;

            if (!winner) {
              return (
                <div
                  key={type}
                  className="p-4 rounded-lg border border-dashed border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                    <span className="text-sm font-medium text-[hsl(var(--portal-text-muted))]">
                      {config.label}
                    </span>
                  </div>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))] italic">
                    No data available
                  </p>
                </div>
              );
            }

            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2, delay: 0.05 * (type === "body" ? 0 : type === "title" ? 1 : 2) }}
                className={cn(
                  "p-4 rounded-lg border border-[hsl(var(--portal-border))]",
                  "bg-gradient-to-br from-[hsl(var(--portal-bg-elevated))] to-[hsl(var(--portal-bg-tertiary))]",
                  "relative overflow-hidden"
                )}
              >
                {/* Accent bar */}
                <div
                  className={cn(
                    "absolute left-0 top-0 bottom-0 w-1",
                    config.color === "purple" && "bg-[hsl(var(--portal-accent-purple))]",
                    config.color === "blue" && "bg-[hsl(var(--portal-accent-blue))]",
                    config.color === "green" && "bg-[hsl(var(--portal-accent-green))]"
                  )}
                />

                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        config.color === "purple" && "text-[hsl(var(--portal-accent-purple))]",
                        config.color === "blue" && "text-[hsl(var(--portal-accent-blue))]",
                        config.color === "green" && "text-[hsl(var(--portal-accent-green))]"
                      )}
                    />
                    <span className="text-sm font-medium text-[hsl(var(--portal-text-secondary))]">
                      {config.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Trophy className="h-4 w-4 text-[hsl(var(--portal-accent-amber))]" />
                  </div>
                </div>

                <p className="text-sm text-[hsl(var(--portal-text-primary))] line-clamp-3 mb-3 min-h-[3.75rem]">
                  "{winner.asset_text || "—"}"
                </p>

                <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--portal-border))]">
                  <div className="flex items-center gap-1 text-[hsl(var(--portal-accent-green))]">
                    <TrendingUp className="h-4 w-4" />
                    <span className="text-sm font-semibold">{formatRoas(winner.roas)} ROAS</span>
                  </div>
                  <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                    {winner.impressions.toLocaleString()} imp
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </V3CardContent>
    </V3Card>
  );
};

VariationWinnerCard.displayName = "VariationWinnerCard";
