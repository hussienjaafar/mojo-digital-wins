import * as React from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Award, ArrowUp, ArrowDown, Minus, Layers, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { V3Card, V3CardContent, V3SectionHeader, V3EmptyState } from "@/components/v3";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export interface CreativeVariation {
  id: string;
  ad_id: string;
  asset_type: "body" | "title" | "description" | "image" | "video";
  asset_index: number;
  asset_text: string | null;
  impressions: number;
  clicks: number;
  spend: number;
  conversions: number;
  conversion_value: number;
  ctr: number | null;
  link_clicks: number | null;
  link_ctr: number | null;
  roas: number | null;
  performance_rank: number | null;
  is_estimated?: boolean;
  // NEW: Enhanced ranking fields per Gemini Pro guidance
  cpa?: number | null;
  purchases?: number;
  reach?: number;
  ranking_method?: string | null;
  inline_link_clicks?: number;
}

interface CreativeVariationTableProps {
  variations: CreativeVariation[];
  isLoading?: boolean;
  organizationId?: string;
  onRefresh?: () => void;
}

const assetTypeLabels: Record<string, string> = {
  body: "Primary Text",
  title: "Headline",
  description: "Description",
  image: "Image",
  video: "Video",
};

const assetTypeColors: Record<string, string> = {
  body: "purple",
  title: "blue",
  description: "green",
  image: "amber",
  video: "red",
};

const RankIcon = ({ rank }: { rank: number }) => {
  if (rank === 1) return <Trophy className="h-4 w-4 text-[hsl(var(--portal-accent-amber))]" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-[hsl(var(--portal-text-secondary))]" />;
  if (rank === 3) return <Award className="h-4 w-4 text-[hsl(var(--portal-accent-amber)/0.7)]" />;
  return <span className="text-[hsl(var(--portal-text-muted))]">{rank}</span>;
};

const TrendIndicator = ({ current, baseline }: { current: number; baseline: number }) => {
  if (current > baseline * 1.1) {
    return <ArrowUp className="h-4 w-4 text-[hsl(var(--portal-accent-green))]" />;
  } else if (current < baseline * 0.9) {
    return <ArrowDown className="h-4 w-4 text-[hsl(var(--portal-accent-red))]" />;
  }
  return <Minus className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />;
};

const formatNumber = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return "—";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
};

const formatPercent = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return "—";
  return `${(n * 100).toFixed(2)}%`;
};

const formatCurrency = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatRoas = (n: number | null | undefined): string => {
  if (n === null || n === undefined || n === 0) return "—";
  return `${n.toFixed(2)}x`;
};

const formatCpa = (n: number | null | undefined): string => {
  if (n === null || n === undefined || n === 0) return "—";
  return `$${n.toFixed(2)}`;
};

const MIN_IMPRESSIONS_THRESHOLD = 500;

export const CreativeVariationTable: React.FC<CreativeVariationTableProps> = ({
  variations,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = React.useState<string>("body");

  // Check if we have REAL metrics (not estimated) - only show metrics table when we have actual data
  const hasRealMetrics = React.useMemo(() => 
    variations.some(v => !v.is_estimated && v.impressions && v.impressions > 0), [variations]
  );

  // Group variations by asset type
  const variationsByType = React.useMemo(() => {
    const grouped: Record<string, CreativeVariation[]> = {};
    for (const v of variations) {
      if (!grouped[v.asset_type]) {
        grouped[v.asset_type] = [];
      }
      grouped[v.asset_type].push(v);
    }
    // Sort each group using CPA-first algorithm per Gemini Pro guidance:
    // Primary: CPA ascending (lower = better, more cost-efficient)
    // Fallback: CTR descending (higher = better engagement)
    for (const type of Object.keys(grouped)) {
      grouped[type].sort((a, b) => {
        // Filter out low-impression variations for ranking purposes
        const aHasEnoughData = a.impressions >= MIN_IMPRESSIONS_THRESHOLD;
        const bHasEnoughData = b.impressions >= MIN_IMPRESSIONS_THRESHOLD;
        
        // Variations with enough data rank above those without
        if (aHasEnoughData && !bHasEnoughData) return -1;
        if (!aHasEnoughData && bHasEnoughData) return 1;
        
        // If both have CPA > 0, compare CPA (lower wins)
        const cpaA = a.cpa ?? 0;
        const cpaB = b.cpa ?? 0;
        if (cpaA > 0 && cpaB > 0) {
          if (cpaA !== cpaB) return cpaA - cpaB;
        }
        // If only one has CPA, that one wins
        if (cpaA > 0 && cpaB === 0) return -1;
        if (cpaA === 0 && cpaB > 0) return 1;
        
        // Fallback to CTR (higher wins)
        const ctrA = a.ctr ?? 0;
        const ctrB = b.ctr ?? 0;
        if (ctrB !== ctrA) return ctrB - ctrA;
        
        // Final fallback to impressions
        return b.impressions - a.impressions;
      });
      // Assign ranks (only to variations with sufficient data)
      let rank = 0;
      grouped[type].forEach((v) => {
        if (v.impressions >= MIN_IMPRESSIONS_THRESHOLD) {
          rank++;
          v.performance_rank = rank;
        } else {
          v.performance_rank = null; // Insufficient data
        }
      });
    }
    return grouped;
  }, [variations]);

  // Available asset types
  const availableTypes = Object.keys(variationsByType).filter(
    (type) => variationsByType[type].length > 0
  );

  // Calculate averages for baseline comparison - using link_ctr instead of ctr
  const getTypeAverage = (type: string, metric: "roas" | "link_ctr") => {
    const vars = variationsByType[type] || [];
    if (vars.length === 0) return 0;
    const values = vars.map((v) => v[metric] ?? 0);
    return values.reduce((a, b) => a + b, 0) / values.length;
  };

  // Set default tab to first available type - moved BEFORE any returns
  React.useEffect(() => {
    if (availableTypes.length > 0 && !availableTypes.includes(activeTab)) {
      setActiveTab(availableTypes[0]);
    }
  }, [availableTypes, activeTab]);

  return (
    <V3Card>
      <V3CardContent>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <V3SectionHeader
              title="Creative Variations"
              subtitle={`${variations.length} variations across ${availableTypes.length} asset types`}
              icon={Layers}
            />
          </div>
        </div>

        {/* Show info alert when we don't have real metrics */}
        {!hasRealMetrics && variations.length > 0 && (
          <Alert className="mb-4 border-[hsl(var(--portal-accent-amber)/0.5)] bg-[hsl(var(--portal-accent-amber)/0.1)]">
            <AlertCircle className="h-4 w-4 text-[hsl(var(--portal-accent-amber))]" />
            <AlertTitle className="text-[hsl(var(--portal-text-primary))]">
              Individual Variation Metrics Not Available
            </AlertTitle>
            <AlertDescription className="text-[hsl(var(--portal-text-secondary))]">
              Meta only provides per-variation performance data for Dynamic Creative (DCO) ads with sufficient 
              impression volume. Your ad copy variations are shown below for reference, but individual performance 
              metrics cannot be determined. To get variation-level data, consider using Meta's Dynamic Creative 
              feature when setting up your ads.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))]">
            {availableTypes.map((type) => (
              <TabsTrigger
                key={type}
                value={type}
                className="gap-2 data-[state=active]:bg-[hsl(var(--portal-accent-blue))] data-[state=active]:text-white"
              >
                {assetTypeLabels[type] || type}
                <Badge variant="secondary" className="ml-1 text-xs">
                  {variationsByType[type]?.length || 0}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {availableTypes.map((type) => {
            const typeVariations = variationsByType[type] || [];
            const avgRoas = getTypeAverage(type, "roas");
            const avgLinkCtr = getTypeAverage(type, "link_ctr");

            return (
              <TabsContent key={type} value={type}>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="rounded-lg border border-[hsl(var(--portal-border))] overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[hsl(var(--portal-bg-elevated))]">
                          <TableHead className="w-12 text-center">#</TableHead>
                          <TableHead className="min-w-[300px]">Copy</TableHead>
                          {hasRealMetrics && (
                            <>
                              <TableHead className="text-right">Impressions</TableHead>
                              <TableHead className="text-right">Clicks</TableHead>
                              <TableHead className="text-right">Link CTR</TableHead>
                              <TableHead className="text-right">Spend</TableHead>
                              <TableHead className="text-right">Conv</TableHead>
                              <TableHead className="text-right">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger className="flex items-center gap-1 justify-end">
                                      CPA
                                      <Info className="h-3 w-3 text-[hsl(var(--portal-text-muted))]" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Cost Per Acquisition (primary ranking metric)</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </TableHead>
                              <TableHead className="text-right">ROAS</TableHead>
                            </>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {typeVariations.map((variation, idx) => (
                          <TableRow
                            key={variation.id}
                            className={cn(
                              "transition-colors",
                              hasRealMetrics && idx === 0 && "bg-[hsl(var(--portal-accent-green)/0.08)]",
                              hasRealMetrics && idx === typeVariations.length - 1 &&
                                typeVariations.length > 1 &&
                                "bg-[hsl(var(--portal-accent-red)/0.05)]"
                            )}
                          >
                            <TableCell className="text-center">
                              {hasRealMetrics ? (
                                variation.performance_rank ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <RankIcon rank={variation.performance_rank} />
                                    {variation.ranking_method && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger>
                                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                                              {variation.ranking_method.toUpperCase()}
                                            </Badge>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Ranked by {variation.ranking_method === 'cpa' ? 'Cost Per Acquisition' : 'Click-Through Rate'}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                ) : variation.impressions > 0 && variation.impressions < MIN_IMPRESSIONS_THRESHOLD ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <AlertCircle className="h-4 w-4 text-[hsl(var(--portal-accent-amber))]" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Insufficient data ({variation.impressions} impressions, need {MIN_IMPRESSIONS_THRESHOLD}+)
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : (
                                  <span className="text-[hsl(var(--portal-text-muted))]">—</span>
                                )
                              ) : (
                                <span className="text-[hsl(var(--portal-text-muted))]">{idx + 1}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium max-w-[400px]">
                              <p className="line-clamp-2 text-sm text-[hsl(var(--portal-text-primary))]">
                                {variation.asset_text || "—"}
                              </p>
                            </TableCell>
                            {hasRealMetrics && (
                              <>
                                <TableCell className="text-right font-mono text-sm">
                                  {formatNumber(variation.impressions)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {formatNumber(variation.clicks)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <span className="font-mono text-sm">
                                      {formatPercent(variation.link_ctr)}
                                    </span>
                                    <TrendIndicator
                                      current={variation.link_ctr ?? 0}
                                      baseline={avgLinkCtr}
                                    />
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {formatCurrency(variation.spend)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-sm">
                                  {formatNumber(variation.conversions)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span
                                    className={cn(
                                      "font-mono text-sm",
                                      variation.cpa && variation.cpa > 0
                                        ? "text-[hsl(var(--portal-text-primary))] font-semibold"
                                        : "text-[hsl(var(--portal-text-muted))]"
                                    )}
                                  >
                                    {formatCpa(variation.cpa)}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <span
                                      className={cn(
                                        "font-mono text-sm font-semibold",
                                        (variation.roas ?? 0) > avgRoas * 1.1
                                          ? "text-[hsl(var(--portal-accent-green))]"
                                          : (variation.roas ?? 0) < avgRoas * 0.9
                                          ? "text-[hsl(var(--portal-accent-red))]"
                                          : "text-[hsl(var(--portal-text-primary))]"
                                      )}
                                    >
                                      {formatRoas(variation.roas)}
                                    </span>
                                    <TrendIndicator
                                      current={variation.roas ?? 0}
                                      baseline={avgRoas}
                                    />
                                  </div>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary stats - only show when we have real metrics */}
                  {hasRealMetrics && (
                    <div className="mt-4 flex gap-4 text-sm text-[hsl(var(--portal-text-muted))]">
                      <span>
                        Avg Link CTR:{" "}
                        <strong className="text-[hsl(var(--portal-text-primary))]">
                          {formatPercent(avgLinkCtr)}
                        </strong>
                      </span>
                      <span>
                        Avg ROAS:{" "}
                        <strong className="text-[hsl(var(--portal-text-primary))]">
                          {formatRoas(avgRoas)}
                        </strong>
                      </span>
                      <span>
                        Top performer:{" "}
                        <strong className="text-[hsl(var(--portal-accent-green))]">
                          {typeVariations[0]?.roas
                            ? `${((typeVariations[0].roas / avgRoas - 1) * 100).toFixed(0)}% above avg`
                            : "—"}
                        </strong>
                      </span>
                    </div>
                  )}
                </motion.div>
              </TabsContent>
            );
          })}
        </Tabs>
      </V3CardContent>
    </V3Card>
  );
};

CreativeVariationTable.displayName = "CreativeVariationTable";
