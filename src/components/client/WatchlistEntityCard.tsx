import { memo } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  User,
  Hash,
  MapPin,
  ShieldAlert,
  FileText,
  Eye,
  EyeOff,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { cssVar } from "@/lib/design-tokens";
import type { WatchlistEntity, EntityType } from "@/queries/useWatchlistQuery";

// ============================================================================
// Entity Type Configuration
// ============================================================================

type AccentColor = "blue" | "purple" | "green" | "amber" | "red";

interface EntityTypeConfig {
  icon: LucideIcon;
  accent: AccentColor;
  label: string;
}

const entityTypeConfig: Record<EntityType, EntityTypeConfig> = {
  organization: { icon: Building2, accent: "blue", label: "Organization" },
  person: { icon: User, accent: "purple", label: "Person" },
  topic: { icon: Hash, accent: "green", label: "Topic" },
  location: { icon: MapPin, accent: "amber", label: "Location" },
  opposition: { icon: ShieldAlert, accent: "red", label: "Opposition" },
  issue: { icon: FileText, accent: "blue", label: "Issue" },
};

const accentStyles: Record<AccentColor, { bg: string; text: string; border: string }> = {
  blue: {
    bg: "bg-[hsl(var(--portal-accent-blue)/0.1)]",
    text: "text-[hsl(var(--portal-accent-blue))]",
    border: "border-[hsl(var(--portal-accent-blue)/0.3)]",
  },
  purple: {
    bg: "bg-[hsl(var(--portal-accent-purple)/0.1)]",
    text: "text-[hsl(var(--portal-accent-purple))]",
    border: "border-[hsl(var(--portal-accent-purple)/0.3)]",
  },
  green: {
    bg: "bg-[hsl(var(--portal-success)/0.1)]",
    text: "text-[hsl(var(--portal-success))]",
    border: "border-[hsl(var(--portal-success)/0.3)]",
  },
  amber: {
    bg: "bg-[hsl(var(--portal-warning)/0.1)]",
    text: "text-[hsl(var(--portal-warning))]",
    border: "border-[hsl(var(--portal-warning)/0.3)]",
  },
  red: {
    bg: "bg-[hsl(var(--portal-error)/0.1)]",
    text: "text-[hsl(var(--portal-error))]",
    border: "border-[hsl(var(--portal-error)/0.3)]",
  },
};

// ============================================================================
// Component Props
// ============================================================================

export interface WatchlistEntityCardProps {
  entity: WatchlistEntity;
  onToggleSentiment: (id: string, current: boolean) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
  isToggling?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export const WatchlistEntityCard = memo(
  ({
    entity,
    onToggleSentiment,
    onDelete,
    isDeleting = false,
    isToggling = false,
  }: WatchlistEntityCardProps) => {
    const config = entityTypeConfig[entity.entity_type] || entityTypeConfig.organization;
    const EntityIcon = config.icon;
    const styles = accentStyles[config.accent];

    return (
      <motion.article
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "group relative rounded-xl border bg-[hsl(var(--portal-bg-elevated))]",
          "border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-border-hover))]",
          "transition-all duration-200 hover:shadow-md"
        )}
        role="article"
        aria-label={`${entity.entity_name} - ${config.label}`}
      >
        {/* Accent top border */}
        <div
          className={cn("absolute top-0 left-4 right-4 h-0.5 rounded-full", styles.bg)}
          style={{ backgroundColor: cssVar(config.accent === "blue" ? "portal-accent-blue" : config.accent === "purple" ? "portal-accent-purple" : config.accent === "green" ? "portal-success" : config.accent === "amber" ? "portal-warning" : "portal-error", 0.5) }}
        />

        <div className="p-4 space-y-3">
          {/* Header: Icon + Name + Type Badge */}
          <div className="flex items-start gap-3">
            <motion.div
              className={cn("p-2 rounded-lg shrink-0", styles.bg)}
              whileHover={{ scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
            >
              <EntityIcon className={cn("h-4 w-4", styles.text)} aria-hidden="true" />
            </motion.div>

            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[hsl(var(--portal-text-primary))] truncate">
                {entity.entity_name}
              </h3>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs capitalize",
                    styles.border,
                    styles.text,
                    styles.bg.replace("0.1", "0.05")
                  )}
                >
                  {config.label}
                </Badge>
                {entity.relevance_score > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-xs bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-secondary))]"
                  >
                    Score: {entity.relevance_score}%
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Aliases */}
          {entity.aliases && entity.aliases.length > 0 && (
            <div>
              <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-1.5">
                Aliases:
              </p>
              <div className="flex flex-wrap gap-1">
                {entity.aliases.slice(0, 3).map((alias, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="text-xs border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))] bg-[hsl(var(--portal-bg-tertiary)/0.5)]"
                  >
                    {alias}
                  </Badge>
                ))}
                {entity.aliases.length > 3 && (
                  <Badge
                    variant="outline"
                    className="text-xs border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-muted))]"
                  >
                    +{entity.aliases.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Threshold */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-[hsl(var(--portal-text-muted))]">Alert threshold:</span>
            <span className="font-medium text-[hsl(var(--portal-text-primary))] tabular-nums">
              {entity.alert_threshold}%
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--portal-border)/0.5)]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleSentiment(entity.id, entity.sentiment_alerts_enabled)}
              disabled={isToggling}
              className={cn(
                "min-h-[40px] gap-2 transition-colors",
                entity.sentiment_alerts_enabled
                  ? "text-[hsl(var(--portal-success))] hover:text-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success)/0.1)]"
                  : "text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-secondary))]"
              )}
              aria-label={
                entity.sentiment_alerts_enabled
                  ? "Disable sentiment alerts"
                  : "Enable sentiment alerts"
              }
            >
              {entity.sentiment_alerts_enabled ? (
                <>
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  <span>Alerts On</span>
                </>
              ) : (
                <>
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                  <span>Alerts Off</span>
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(entity.id)}
              disabled={isDeleting}
              className="text-[hsl(var(--portal-error))] hover:text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)] min-h-[40px] min-w-[40px]"
              aria-label={`Delete ${entity.entity_name}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </motion.article>
    );
  }
);

WatchlistEntityCard.displayName = "WatchlistEntityCard";
