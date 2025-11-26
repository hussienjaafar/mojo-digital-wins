import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Clock, DollarSign, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";

export default function ClientOpportunities() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: opportunities, isLoading } = useQuery({
    queryKey: ['fundraising-opportunities'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: clientUser } = await supabase
        .from('client_users')
        .select('organization_id')
        .eq('id', user.id)
        .single();

      if (!clientUser) throw new Error('Client user not found');

      const { data, error } = await supabase
        .from('fundraising_opportunities')
        .select('*')
        .eq('organization_id', clientUser.organization_id)
        .eq('is_active', true)
        .order('opportunity_score', { ascending: false });

      if (error) throw error;
      return data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const handleCopySuggestion = (opportunityId: string, entityName: string, entityType: string) => {
    const message = `URGENT: ${entityName} is trending right now. This is our moment to mobilize. Reply YES to donate and show where we stand. Every contribution counts.`;
    
    navigator.clipboard.writeText(message);
    setCopiedId(opportunityId);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("SMS suggestion copied to clipboard");
  };

  const getSeverityColor = (score: number) => {
    if (score >= 85) return "destructive";
    if (score >= 70) return "default";
    return "secondary";
  };

  const getSeverityLabel = (score: number) => {
    if (score >= 85) return "Critical";
    if (score >= 70) return "High";
    return "Medium";
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-24 bg-muted" />
              <CardContent className="h-32 bg-muted/50" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Fundraising Opportunities</h1>
        <p className="text-muted-foreground">
          Real-time opportunities based on trending topics and historical performance
        </p>
      </div>

      {opportunities && opportunities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No Active Opportunities</p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              We're monitoring trends 24/7. When a high-impact moment emerges, it will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {opportunities?.map((opp) => (
            <Card key={opp.id} className="border-l-4" style={{
              borderLeftColor: opp.opportunity_score >= 85 ? 'hsl(var(--destructive))' : 
                              opp.opportunity_score >= 70 ? 'hsl(var(--primary))' : 
                              'hsl(var(--muted))'
            }}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-2xl">{opp.entity_name}</CardTitle>
                      <Badge variant={getSeverityColor(opp.opportunity_score)}>
                        {getSeverityLabel(opp.opportunity_score)}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {opp.entity_type}
                      </Badge>
                    </div>
                    <CardDescription>
                      Detected {formatDistanceToNow(new Date(opp.detected_at), { addSuffix: true })}
                    </CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">
                      {opp.opportunity_score?.toFixed(0)}
                    </div>
                    <div className="text-xs text-muted-foreground">Opportunity Score</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <div>
                      <div className="text-sm text-muted-foreground">Velocity</div>
                      <div className="font-semibold">{opp.velocity?.toFixed(0)}%</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Clock className="h-5 w-5 text-primary" />
                    <div>
                      <div className="text-sm text-muted-foreground">Time Sensitivity</div>
                      <div className="font-semibold">{opp.time_sensitivity?.toFixed(0)}%</div>
                    </div>
                  </div>

                  {opp.estimated_value && (
                    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                      <DollarSign className="h-5 w-5 text-primary" />
                      <div>
                        <div className="text-sm text-muted-foreground">Est. Value (48h)</div>
                        <div className="font-semibold">${opp.estimated_value.toFixed(0)}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Historical Context */}
                {opp.similar_past_events > 0 && (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">Historical Performance</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Similar events have resulted in fundraising success {opp.similar_past_events} time(s) in the past.
                      {opp.historical_success_rate && ` Success rate: ${opp.historical_success_rate.toFixed(0)}%`}
                    </p>
                  </div>
                )}

                {/* Action */}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div>
                    <p className="text-sm font-medium mb-1">Suggested SMS Message</p>
                    <p className="text-xs text-muted-foreground">
                      {opp.current_mentions} mentions in the last 24 hours
                    </p>
                  </div>
                  <Button 
                    onClick={() => handleCopySuggestion(opp.id, opp.entity_name, opp.entity_type)}
                    className="gap-2"
                  >
                    {copiedId === opp.id ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy SMS
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
