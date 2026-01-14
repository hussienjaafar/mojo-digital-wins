import * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  Target,
  MessageSquare,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface DataPointDetails {
  date: string;
  metrics: {
    label: string;
    value: string | number;
    change?: number;
    type?: "currency" | "number" | "percent";
  }[];
  transactions?: {
    id: string;
    amount: number;
    donorName?: string;
    source?: string;
    time: string;
  }[];
  campaigns?: {
    name: string;
    spend: number;
    conversions: number;
    roi: number;
  }[];
}

interface DataPointDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  date: string | null;
  seriesName?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const formatValue = (value: number, type?: string): string => {
  if (type === "currency") {
    if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  }
  if (type === "percent") {
    return `${value.toFixed(1)}%`;
  }
  return value.toLocaleString();
};

// ============================================================================
// Query Function
// ============================================================================

async function fetchDataPointDetails(
  organizationId: string,
  date: string
): Promise<DataPointDetails> {
  const startOfDay = `${date}T00:00:00`;
  const endOfDay = `${date}T23:59:59`;

  // Fetch transactions for the day (using secure view)
  const { data: transactions } = await (supabase as any)
    .from("actblue_transactions_secure")
    .select("id, amount, fee, donor_name, refcode, transaction_date")
    .eq("organization_id", organizationId)
    .gte("transaction_date", startOfDay)
    .lte("transaction_date", endOfDay)
    .order("transaction_date", { ascending: false })
    .limit(10);

  // Fetch Meta ad metrics for the day (canonical source, replaces daily_aggregated_metrics)
  const { data: metaMetrics } = await (supabase as any)
    .from("meta_ad_metrics")
    .select("spend, impressions, clicks")
    .eq("organization_id", organizationId)
    .eq("date", date);

  // Aggregate Meta metrics for the day
  const dailyMetrics = {
    total_ad_spend: (metaMetrics || []).reduce((sum: number, m: any) => sum + Number(m.spend || 0), 0),
    meta_impressions: (metaMetrics || []).reduce((sum: number, m: any) => sum + Number(m.impressions || 0), 0),
    meta_clicks: (metaMetrics || []).reduce((sum: number, m: any) => sum + Number(m.clicks || 0), 0),
  };

  // Calculate aggregates
  const totalGross = (transactions || []).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const totalFees = (transactions || []).reduce((sum, tx) => sum + Number(tx.fee || 0), 0);
  const totalNet = totalGross - totalFees;
  const donationCount = transactions?.length || 0;

  // Build metrics array
  const metrics = [
    { label: "Gross Donations", value: formatValue(totalGross, "currency"), type: "currency" as const },
    { label: "Net Donations", value: formatValue(totalNet, "currency"), type: "currency" as const },
    { label: "Donation Count", value: donationCount, type: "number" as const },
    { label: "Avg Donation", value: formatValue(donationCount > 0 ? totalGross / donationCount : 0, "currency"), type: "currency" as const },
  ];

  // Add Meta ad metrics if there's any spend
  if (dailyMetrics.total_ad_spend > 0 || dailyMetrics.meta_impressions > 0) {
    metrics.push(
      { label: "Ad Spend", value: formatValue(dailyMetrics.total_ad_spend, "currency"), type: "currency" as const },
      { label: "Impressions", value: dailyMetrics.meta_impressions, type: "number" as const },
      { label: "Clicks", value: dailyMetrics.meta_clicks, type: "number" as const }
    );
  }

  return {
    date,
    metrics,
    transactions: (transactions || []).map((tx) => ({
      id: tx.id,
      amount: Number(tx.amount),
      donorName: tx.donor_name || "Anonymous",
      source: tx.refcode || "Direct",
      time: format(parseISO(tx.transaction_date), "h:mm a"),
    })),
  };
}

// ============================================================================
// Sub-components
// ============================================================================

const MetricCard: React.FC<{
  label: string;
  value: string | number;
  change?: number;
}> = ({ label, value, change }) => (
  <div className="flex justify-between items-center py-2">
    <span className="text-sm text-[hsl(var(--portal-text-muted))]">{label}</span>
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
        {value}
      </span>
      {change !== undefined && (
        <span
          className={cn(
            "flex items-center text-xs",
            change >= 0 ? "text-[hsl(var(--portal-success))]" : "text-[hsl(var(--portal-error))]"
          )}
        >
          {change >= 0 ? <TrendingUp className="h-3 w-3 mr-0.5" /> : <TrendingDown className="h-3 w-3 mr-0.5" />}
          {Math.abs(change).toFixed(1)}%
        </span>
      )}
    </div>
  </div>
);

const TransactionRow: React.FC<{
  transaction: {
    id: string;
    amount: number;
    donorName?: string;
    source?: string;
    time: string;
  };
}> = ({ transaction }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(transaction.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] hover:bg-[hsl(var(--portal-bg-elevated))]/80">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] truncate">
          {transaction.donorName}
        </p>
        <p className="text-xs text-[hsl(var(--portal-text-muted))]">
          {transaction.source} • {transaction.time}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold text-[hsl(var(--portal-success))]">
          ${transaction.amount.toFixed(2)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0"
        onClick={handleCopy}
        aria-label="Copy transaction ID"
      >
        {copied ? (
          <Check className="h-3 w-3 text-[hsl(var(--portal-success))]" />
        ) : (
          <Copy className="h-3 w-3 text-[hsl(var(--portal-text-muted))]" />
        )}
      </Button>
    </div>
  );
};

const LoadingSkeleton: React.FC = () => (
  <div className="space-y-6">
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex justify-between items-center">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
    <Separator />
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-14 w-full rounded-lg" />
      ))}
    </div>
  </div>
);

// ============================================================================
// Main Component
// ============================================================================

export const DataPointDetailSheet: React.FC<DataPointDetailSheetProps> = ({
  open,
  onOpenChange,
  organizationId,
  date,
  seriesName,
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["datapoint-details", organizationId, date],
    queryFn: () => fetchDataPointDetails(organizationId, date!),
    enabled: open && !!organizationId && !!date,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-[hsl(var(--portal-bg-surface))] border-[hsl(var(--portal-border))]"
      >
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10">
              <Calendar className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div>
              <SheetTitle className="text-[hsl(var(--portal-text-primary))]">
                {date ? format(parseISO(date), "EEEE, MMMM d, yyyy") : "Data Details"}
              </SheetTitle>
              {seriesName && (
                <SheetDescription className="text-[hsl(var(--portal-text-muted))]">
                  {seriesName} breakdown
                </SheetDescription>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-6">
          {isLoading ? (
            <LoadingSkeleton />
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-[hsl(var(--portal-error))]">
                Failed to load details
              </p>
            </div>
          ) : data ? (
            <>
              {/* Metrics Section */}
              <div>
                <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-3 flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Day Summary
                </h4>
                <div className="space-y-1 divide-y divide-[hsl(var(--portal-border))]">
                  {data.metrics.map((metric) => (
                    <MetricCard
                      key={metric.label}
                      label={metric.label}
                      value={metric.value}
                      change={metric.change}
                    />
                  ))}
                </div>
              </div>

              <Separator className="bg-[hsl(var(--portal-border))]" />

              {/* Transactions Section */}
              {data.transactions && data.transactions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-3 flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Recent Donations ({data.transactions.length})
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {data.transactions.map((tx) => (
                      <TransactionRow key={tx.id} transaction={tx} />
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {(!data.transactions || data.transactions.length === 0) && (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 mx-auto text-[hsl(var(--portal-text-muted))] mb-2" />
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                    No donations on this day
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
};

DataPointDetailSheet.displayName = "DataPointDetailSheet";
