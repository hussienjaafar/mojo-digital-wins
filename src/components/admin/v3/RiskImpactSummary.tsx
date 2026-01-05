import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { V3Card, V3CardContent } from "@/components/v3";
import { AlertTriangle, TrendingUp, Shield, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface RiskData {
  criticalThreats: number;
  highThreats: number;
  risingNegative: number;
  watchlistAtRisk: number;
  overallRisk: "low" | "medium" | "high" | "critical";
}

export function RiskImpactSummary() {
  const [data, setData] = useState<RiskData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRiskData = async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Fetch critical threats
        const criticalResult = await supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq("threat_level", "critical")
          .gte("published_date", today.toISOString());

        // Fetch high threats
        const highResult = await supabase
          .from("articles")
          .select("id", { count: "exact", head: true })
          .eq("threat_level", "high")
          .gte("published_date", today.toISOString());

        // Fetch rising negative sentiment - simplified query
        const negativeResult = await supabase
          .from("trend_clusters")
          .select("id", { count: "exact", head: true })
          .gte("detected_at", today.toISOString());

        // Fetch watchlist items with alerts
        const alertsResult = await supabase
          .from("client_entity_alerts")
          .select("id", { count: "exact", head: true })
          .in("severity", ["critical", "high"])
          .gte("created_at", today.toISOString());

        const criticalThreats = criticalResult.count || 0;
        const highThreats = highResult.count || 0;
        const risingNegative = negativeResult.count || 0;
        const watchlistAtRisk = alertsResult.count || 0;

        // Calculate overall risk level
        let overallRisk: RiskData["overallRisk"] = "low";
        if (criticalThreats >= 3 || watchlistAtRisk >= 5) {
          overallRisk = "critical";
        } else if (criticalThreats >= 1 || highThreats >= 5 || watchlistAtRisk >= 3) {
          overallRisk = "high";
        } else if (highThreats >= 2 || risingNegative >= 3) {
          overallRisk = "medium";
        }

        setData({
          criticalThreats,
          highThreats,
          risingNegative,
          watchlistAtRisk,
          overallRisk,
        });
      } catch (error) {
        console.error("Error fetching risk data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRiskData();
  }, []);

  if (isLoading) {
    return (
      <V3Card>
        <V3CardContent className="p-4">
          <Skeleton className="h-24 w-full" />
        </V3CardContent>
      </V3Card>
    );
  }

  if (!data) {
    return null;
  }

  const riskColors = {
    low: { bg: "bg-emerald-500/10", text: "text-emerald-500", border: "border-emerald-500/30" },
    medium: { bg: "bg-amber-500/10", text: "text-amber-500", border: "border-amber-500/30" },
    high: { bg: "bg-orange-500/10", text: "text-orange-500", border: "border-orange-500/30" },
    critical: { bg: "bg-red-500/10", text: "text-red-500", border: "border-red-500/30" },
  };

  const colors = riskColors[data.overallRisk];

  return (
    <V3Card className={cn("border-2", colors.border, colors.bg)}>
      <V3CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Shield className={cn("h-5 w-5", colors.text)} />
            <h3 className="font-semibold text-foreground">Risk Summary</h3>
          </div>
          <Badge variant="outline" className={cn("capitalize font-semibold", colors.bg, colors.text, colors.border)}>
            {data.overallRisk} Risk
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="text-center p-2 rounded-lg bg-background/50">
            <div className="flex items-center justify-center gap-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-xl font-bold text-foreground">{data.criticalThreats}</span>
            </div>
            <p className="text-xs text-muted-foreground">Critical</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-background/50">
            <div className="flex items-center justify-center gap-1">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span className="text-xl font-bold text-foreground">{data.highThreats}</span>
            </div>
            <p className="text-xs text-muted-foreground">High</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-background/50">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4 text-rose-500" />
              <span className="text-xl font-bold text-foreground">{data.risingNegative}</span>
            </div>
            <p className="text-xs text-muted-foreground">Rising -ve</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-background/50">
            <div className="flex items-center justify-center gap-1">
              <Activity className="h-4 w-4 text-amber-500" />
              <span className="text-xl font-bold text-foreground">{data.watchlistAtRisk}</span>
            </div>
            <p className="text-xs text-muted-foreground">At Risk</p>
          </div>
        </div>
      </V3CardContent>
    </V3Card>
  );
}
