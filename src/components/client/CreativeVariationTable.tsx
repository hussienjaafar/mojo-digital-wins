import * as React from "react";
import { motion } from "framer-motion";
import { Trophy, Medal, Award, ArrowUp, ArrowDown, Minus, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { V3Card, V3CardContent, V3SectionHeader, V3EmptyState } from "@/components/v3";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  roas: number | null;
  performance_rank: number | null;
}

interface CreativeVariationTableProps {
  variations: CreativeVariation[];
  isLoading?: boolean;
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

export const CreativeVariationTable: React.FC<CreativeVariationTableProps> = ({
  variations,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = React.useState<string>("body");

  // Group variations by asset type
  const variationsByType = React.useMemo(() => {
    const grouped: Record<string, CreativeVariation[]> = {};
    for (const v of variations) {
      if (!grouped[v.asset_type]) {
        grouped[v.asset_type] = [];
      }
      grouped[v.asset_type].push(v);
    }
    // Sort each group by ROAS descending, then impressions
    for (const type of Object.keys(grouped)) {
      grouped[type].sort((a, b) => {
        const roasA = a.roas ?? 0;
        const roasB = b.roas ?? 0;
        if (roasB !== roasA) return roasB - roasA;
        return b.impressions - a.impressions;
      });
      // Assign ranks
      grouped[type].forEach((v, idx) => {
        v.performance_rank = idx + 1;
      });
    }
    return grouped;
  }, [variations]);

  // Available asset types
  const availableTypes = Object.keys(variationsByType).filter(
    (type) => variationsByType[type].length > 0
  );

  // Calculate averages for baseline comparison
  const getTypeAverage = (type: string, metric: "roas" | "ctr") => {
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
        <V3SectionHeader
          title="Creative Variations Performance"
          subtitle={`${variations.length} variations across ${availableTypes.length} asset types`}
          icon={Layers}
          className="mb-4"
        />

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
            const avgCtr = getTypeAverage(type, "ctr");

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
                          <TableHead className="text-right">Impressions</TableHead>
                          <TableHead className="text-right">Clicks</TableHead>
                          <TableHead className="text-right">CTR</TableHead>
                          <TableHead className="text-right">Spend</TableHead>
                          <TableHead className="text-right">Conv</TableHead>
                          <TableHead className="text-right">ROAS</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {typeVariations.map((variation, idx) => (
                          <TableRow
                            key={variation.id}
                            className={cn(
                              "transition-colors",
                              idx === 0 && "bg-[hsl(var(--portal-accent-green)/0.08)]",
                              idx === typeVariations.length - 1 &&
                                typeVariations.length > 1 &&
                                "bg-[hsl(var(--portal-accent-red)/0.05)]"
                            )}
                          >
                            <TableCell className="text-center">
                              <RankIcon rank={variation.performance_rank || idx + 1} />
                            </TableCell>
                            <TableCell className="font-medium max-w-[400px]">
                              <p className="line-clamp-2 text-sm text-[hsl(var(--portal-text-primary))]">
                                {variation.asset_text || "—"}
                              </p>
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatNumber(variation.impressions)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm">
                              {formatNumber(variation.clicks)}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <span className="font-mono text-sm">
                                  {formatPercent(variation.ctr)}
                                </span>
                                <TrendIndicator
                                  current={variation.ctr ?? 0}
                                  baseline={avgCtr}
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
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Summary stats */}
                  <div className="mt-4 flex gap-4 text-sm text-[hsl(var(--portal-text-muted))]">
                    <span>
                      Avg CTR:{" "}
                      <strong className="text-[hsl(var(--portal-text-primary))]">
                        {formatPercent(avgCtr)}
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
