import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { V3Card, V3CardHeader, V3CardTitle, V3CardContent } from "@/components/v3";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface AttributionHealth {
  total_touchpoints: number;
  touchpoints_with_donor: number;
  touchpoints_without_donor: number;
  touchpoint_coverage_percent: number;
  
  total_donations: number;
  donations_with_prior_touchpoint: number;
  donations_without_touchpoint: number;
  donation_attribution_percent: number;
  
  total_sms_events: number;
  sms_with_identity_link: number;
  sms_without_link: number;
  sms_identity_percent: number;
  
  unique_refcodes: number;
  refcodes_mapped_to_campaigns: number;
  
  health_score: number;
  recommendations: string[];
}

interface AttributionHealthCardProps {
  organizationId: string;
}

const getHealthIcon = (score: number) => {
  if (score >= 70) return CheckCircle;
  if (score >= 40) return AlertTriangle;
  return XCircle;
};

const getHealthColor = (score: number) => {
  if (score >= 70) return "text-[hsl(var(--portal-success))]";
  if (score >= 40) return "text-[hsl(var(--portal-warning))]";
  return "text-[hsl(var(--portal-error))]";
};

const getHealthLabel = (score: number) => {
  if (score >= 70) return "Healthy";
  if (score >= 40) return "Needs Attention";
  return "Critical";
};

export const AttributionHealthCard = ({ organizationId }: AttributionHealthCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["attribution-health", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("validate-attribution", {
        body: { organization_id: organizationId, days_back: 90 },
      });
      
      if (error) throw error;
      return data.health as AttributionHealth;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <V3Card>
        <V3CardContent className="py-8">
          <div className="flex items-center justify-center gap-2 text-[hsl(var(--portal-text-muted))]">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Analyzing attribution health...</span>
          </div>
        </V3CardContent>
      </V3Card>
    );
  }

  if (!data) {
    return null;
  }

  const HealthIcon = getHealthIcon(data.health_score);
  const healthColor = getHealthColor(data.health_score);
  const healthLabel = getHealthLabel(data.health_score);

  return (
    <V3Card>
      <V3CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <V3CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Attribution Health
          </V3CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                "flex items-center gap-1",
                data.health_score >= 70 && "border-[hsl(var(--portal-success)/0.3)] bg-[hsl(var(--portal-success)/0.1)]",
                data.health_score >= 40 && data.health_score < 70 && "border-[hsl(var(--portal-warning)/0.3)] bg-[hsl(var(--portal-warning)/0.1)]",
                data.health_score < 40 && "border-[hsl(var(--portal-error)/0.3)] bg-[hsl(var(--portal-error)/0.1)]"
              )}
            >
              <HealthIcon className={cn("h-3 w-3", healthColor)} />
              <span className={healthColor}>{data.health_score}%</span>
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>
      </V3CardHeader>
      
      <V3CardContent>
        {/* Summary metrics */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
              {data.touchpoint_coverage_percent}%
            </div>
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">
              Touchpoint Linkage
            </div>
            <Progress 
              value={data.touchpoint_coverage_percent} 
              className="h-1 mt-1"
            />
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
              {data.donation_attribution_percent}%
            </div>
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">
              Donation Attribution
            </div>
            <Progress 
              value={data.donation_attribution_percent} 
              className="h-1 mt-1"
            />
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
              {data.sms_identity_percent}%
            </div>
            <div className="text-xs text-[hsl(var(--portal-text-muted))]">
              SMS Identity Match
            </div>
            <Progress 
              value={data.sms_identity_percent} 
              className="h-1 mt-1"
            />
          </div>
        </div>

        {/* Expandable details */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full justify-between text-[hsl(var(--portal-text-muted))]"
        >
          <span>{isExpanded ? "Hide Details" : "Show Details"}</span>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            {/* Detailed metrics */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium text-[hsl(var(--portal-text-primary))]">Touchpoints</h4>
                <div className="flex justify-between text-[hsl(var(--portal-text-muted))]">
                  <span>With donor linked:</span>
                  <span className="text-[hsl(var(--portal-success))]">{data.touchpoints_with_donor}</span>
                </div>
                <div className="flex justify-between text-[hsl(var(--portal-text-muted))]">
                  <span>Without donor:</span>
                  <span className="text-[hsl(var(--portal-warning))]">{data.touchpoints_without_donor}</span>
                </div>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium text-[hsl(var(--portal-text-primary))]">Donations</h4>
                <div className="flex justify-between text-[hsl(var(--portal-text-muted))]">
                  <span>With attribution:</span>
                  <span className="text-[hsl(var(--portal-success))]">{data.donations_with_prior_touchpoint}</span>
                </div>
                <div className="flex justify-between text-[hsl(var(--portal-text-muted))]">
                  <span>No touchpoints:</span>
                  <span className="text-[hsl(var(--portal-warning))]">{data.donations_without_touchpoint}</span>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {data.recommendations.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-[hsl(var(--portal-text-primary))] mb-2 flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
                  Recommendations
                </h4>
                <ul className="space-y-1">
                  {data.recommendations.map((rec, idx) => (
                    <li 
                      key={idx}
                      className="text-sm text-[hsl(var(--portal-text-muted))] pl-4 border-l-2 border-[hsl(var(--portal-warning)/0.3)]"
                    >
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </V3CardContent>
    </V3Card>
  );
};
