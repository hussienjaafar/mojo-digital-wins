import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { MagicMomentCard } from "@/components/client/MagicMomentCard";
import { ClientLayout } from "@/components/client/ClientLayout";
import { EmptyState } from "@/components/ui/empty-state";

export default function ClientOpportunities() {
  const { data: opportunities, isLoading } = useQuery({
    queryKey: ['fundraising-opportunities'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: clientUser } = await supabase
        .from('client_users')
        .select('organization_id')
        .eq('id', user.id)
        .maybeSingle();

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

  if (isLoading) {
    return null;
  }

  return (
    <ClientLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Fundraising Opportunities</h1>
          <p className="text-muted-foreground">
            Real-time opportunities based on trending topics and historical performance
          </p>
        </div>

      {opportunities && opportunities.length === 0 ? (
        <div className="space-y-6">
          <EmptyState
            icon={<Sparkles className="h-12 w-12 text-primary" />}
            title="AI-Powered Opportunities"
            description="Our intelligence engine monitors news trends, social media, and polling data 24/7. When high-impact fundraising moments emerge, you'll see AI-generated campaign suggestions here."
            variant="card"
          />
          
          {/* Sample Opportunity Cards */}
          <div className="grid gap-6">
            <Card className="border-dashed opacity-75">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Badge variant="secondary" className="mb-2">DEMO OPPORTUNITY</Badge>
                    <h3 className="text-xl font-bold">Climate Action Bill Trending</h3>
                    <p className="text-sm text-muted-foreground mt-1">Detected 45 minutes ago</p>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-primary">87</div>
                    <p className="text-xs text-muted-foreground">Opportunity Score</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Velocity:</span>
                    <span className="font-medium">12.4 mentions/hour</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Similar Past Events:</span>
                    <span className="font-medium">3 (avg. $8.4K raised)</span>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-medium mb-1">AI-Generated Message:</p>
                    <p className="text-sm text-muted-foreground italic">
                      "Climate Action Bill is making headlines RIGHT NOW. This is our moment to show strength. Reply YES to donate and stand with us."
                    </p>
                  </div>
                  <div className="bg-success/10 p-3 rounded-lg border border-success/20">
                    <p className="text-sm font-medium text-success mb-1">Optimal Send Time</p>
                    <p className="text-xs text-muted-foreground">Today, 2-4 PM EST • Peak donor engagement window</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <p className="text-center text-sm text-muted-foreground">
            Live opportunities will appear here when our AI detects high-impact moments
          </p>
        </div>
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
    </ClientLayout>
  );
}
