import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, Clock, DollarSign, Copy, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { MagicMomentCard } from "@/components/client/MagicMomentCard";

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
          {opportunities?.map((opp) => {
            // Generate AI message context
            const messageContext = `${opp.entity_name} is trending with ${opp.current_mentions} mentions. Act now to mobilize support.`;
            const optimalTime = {
              time: "2-4 PM EST",
              reason: "Peak donor engagement based on your history"
            };

            return (
              <MagicMomentCard
                key={opp.id}
                entityName={opp.entity_name}
                entityType={opp.entity_type}
                opportunityScore={opp.opportunity_score || 0}
                velocity={opp.velocity || 0}
                estimatedValue={opp.estimated_value}
                similarPastEvents={opp.similar_past_events || 0}
                historicalContext={
                  opp.similar_past_events > 0
                    ? `Similar events resulted in ${opp.historical_success_rate?.toFixed(0)}% success rate`
                    : undefined
                }
                aiGeneratedMessage={messageContext}
                messageVariants={[
                  messageContext,
                  `URGENT: ${opp.entity_name} needs us NOW. Every voice matters. Reply YES to donate and stand with us.`,
                  `${opp.entity_name} is making headlines. This is our chance to show strength. Donate now to make an impact.`
                ]}
                optimalSendTime={optimalTime}
                detectedAt={opp.detected_at}
                onSendMessage={(msg) => {
                  navigator.clipboard.writeText(msg);
                  toast.success("Message ready to send to your SMS platform");
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
