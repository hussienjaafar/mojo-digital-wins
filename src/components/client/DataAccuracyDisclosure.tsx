import { useState } from "react";
import { 
  Info, 
  Clock, 
  ExternalLink, 
  ChevronDown,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  V3Card, 
  V3Badge,
  V3DataFreshnessIndicator 
} from "@/components/v3";
import { iconSizes } from "@/lib/design-tokens";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface DataAccuracyDisclosureProps {
  lastSyncedAt?: string | null;
  totalCreatives: number;
  creativesWithMetrics: number;
  className?: string;
}

export function DataAccuracyDisclosure({
  lastSyncedAt,
  totalCreatives,
  creativesWithMetrics,
  className,
}: DataAccuracyDisclosureProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const coveragePercent = totalCreatives > 0 
    ? Math.round((creativesWithMetrics / totalCreatives) * 100) 
    : 0;

  return (
    <V3Card className={cn("p-4", className)}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
                <Info className={cn(iconSizes.md, "text-[hsl(var(--portal-accent-blue))]")} />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                  Data Accuracy & Attribution
                </h3>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                  7-day click attribution • Link CTR metrics
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {lastSyncedAt && (
                <V3DataFreshnessIndicator
                  lastSyncedAt={lastSyncedAt}
                  expectedFreshnessHours={4}
                  source="Meta"
                  compact
                />
              )}
              <ChevronDown 
                className={cn(
                  iconSizes.sm, 
                  "text-[hsl(var(--portal-text-muted))] transition-transform",
                  isOpen && "rotate-180"
                )} 
              />
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="pt-4">
          <div className="space-y-4">
            {/* Attribution Window */}
            <div className="flex items-start gap-3 p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary)/0.5)]">
              <Clock className={cn(iconSizes.sm, "text-[hsl(var(--portal-text-muted))] mt-0.5")} />
              <div>
                <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                  Attribution Window
                </h4>
                <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
                  ROAS is calculated using Meta's <strong>7-day click</strong> attribution model. 
                  Conversions are credited to ads that were clicked within 7 days of the purchase.
                </p>
              </div>
            </div>

            {/* Metrics Explanation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary)/0.5)]">
                <div className="flex items-center gap-2 mb-2">
                  <V3Badge variant="blue" size="sm">Link CTR</V3Badge>
                </div>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                  Measures outbound clicks to your donation page, not total engagements. 
                  More accurate for conversion-focused campaigns.
                </p>
              </div>
              
              <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary)/0.5)]">
                <div className="flex items-center gap-2 mb-2">
                  <V3Badge variant="success" size="sm">ROAS</V3Badge>
                </div>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                  Return on Ad Spend from Meta's attributed conversions. 
                  A ROAS of 2.0x means $2 revenue for every $1 spent.
                </p>
              </div>
            </div>

            {/* Coverage Indicator */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-[hsl(var(--portal-border)/0.5)]">
              <div className="flex items-center gap-2">
                {coveragePercent >= 80 ? (
                  <CheckCircle2 className={cn(iconSizes.sm, "text-[hsl(var(--portal-success))]")} />
                ) : (
                  <AlertCircle className={cn(iconSizes.sm, "text-[hsl(var(--portal-warning))]")} />
                )}
                <span className="text-sm text-[hsl(var(--portal-text-primary))]">
                  Metrics Coverage
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                  {creativesWithMetrics}/{totalCreatives} creatives
                </span>
                <V3Badge variant={coveragePercent >= 80 ? "success" : "pending"} size="sm">
                  {coveragePercent}%
                </V3Badge>
              </div>
            </div>

            {/* Documentation Link */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <a 
                    href="https://www.facebook.com/business/help/458681590974355" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-[hsl(var(--portal-accent-blue))] hover:underline"
                  >
                    <ExternalLink className={iconSizes.xs} />
                    Learn more about Meta attribution
                  </a>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Opens Meta's official attribution documentation</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </V3Card>
  );
}
