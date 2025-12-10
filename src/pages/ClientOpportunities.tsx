import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Zap, TrendingUp, Clock, Target } from "lucide-react";
import { toast } from "sonner";
import { MagicMomentCard } from "@/components/client/MagicMomentCard";
import { ClientLayout } from "@/components/client/ClientLayout";
import { motion } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3SectionHeader,
  V3LoadingState,
  V3EmptyState,
} from "@/components/v3";
import { cn } from "@/lib/utils";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
};

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
    refetchInterval: 60000,
  });

  return (
    <ClientLayout>
      <motion.div
        className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Page Header */}
        <motion.div variants={itemVariants}>
          <V3SectionHeader
            title="Fundraising Opportunities"
            subtitle="Real-time opportunities based on trending topics and historical performance"
            icon={Target}
            size="lg"
          />
        </motion.div>

        {/* Loading State */}
        {isLoading && (
          <motion.div variants={itemVariants} className="space-y-4">
            <V3LoadingState variant="channel" />
            <V3LoadingState variant="channel" />
            <V3LoadingState variant="channel" />
          </motion.div>
        )}

        {/* Empty State with Demo */}
        {!isLoading && opportunities && opportunities.length === 0 && (
          <motion.div variants={itemVariants} className="space-y-6">
            <V3EmptyState
              icon={Sparkles}
              title="AI-Powered Opportunities"
              description="Our intelligence engine monitors news trends, social media, and polling data 24/7. When high-impact fundraising moments emerge, you'll see AI-generated campaign suggestions here."
              accent="purple"
            />

            {/* Demo Opportunity Card */}
            <motion.div variants={itemVariants}>
              <V3Card accent="purple" className="border-dashed opacity-75">
                <V3CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <Badge
                        variant="secondary"
                        className="mb-2 bg-[hsl(var(--portal-accent-purple)/0.1)] text-[hsl(var(--portal-accent-purple))] border-[hsl(var(--portal-accent-purple)/0.2)]"
                      >
                        DEMO OPPORTUNITY
                      </Badge>
                      <h3 className="text-xl font-bold text-[hsl(var(--portal-text-primary))]">
                        Climate Action Bill Trending
                      </h3>
                      <p className="text-sm text-[hsl(var(--portal-text-secondary))] mt-1">
                        Detected 45 minutes ago
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-[hsl(var(--portal-accent-purple))]">87</div>
                      <p className="text-xs text-[hsl(var(--portal-text-muted))]">Opportunity Score</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[hsl(var(--portal-text-secondary))] flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Velocity:
                      </span>
                      <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                        12.4 mentions/hour
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[hsl(var(--portal-text-secondary))]">Similar Past Events:</span>
                      <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                        3 (avg. $8.4K raised)
                      </span>
                    </div>

                    <div className="bg-[hsl(var(--portal-bg-elevated))] p-3 rounded-lg border border-[hsl(var(--portal-border))]">
                      <p className="text-sm font-medium mb-1 flex items-center gap-2 text-[hsl(var(--portal-text-primary))]">
                        <Sparkles className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" />
                        AI-Generated Message:
                      </p>
                      <p className="text-sm text-[hsl(var(--portal-text-secondary))] italic">
                        "Climate Action Bill is making headlines RIGHT NOW. This is our moment to show strength. Reply YES to donate and stand with us."
                      </p>
                    </div>

                    <div className="bg-[hsl(var(--portal-success)/0.1)] p-3 rounded-lg border border-[hsl(var(--portal-success)/0.2)]">
                      <p className="text-sm font-medium text-[hsl(var(--portal-success))] mb-1 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Optimal Send Time
                      </p>
                      <p className="text-xs text-[hsl(var(--portal-text-secondary))]">
                        Today, 2-4 PM EST • Peak donor engagement window
                      </p>
                    </div>
                  </div>
                </V3CardContent>
              </V3Card>
            </motion.div>

            <motion.p
              variants={itemVariants}
              className="text-center text-sm text-[hsl(var(--portal-text-muted))]"
            >
              Live opportunities will appear here when our AI detects high-impact moments
            </motion.p>
          </motion.div>
        )}

        {/* Real Opportunities */}
        {!isLoading && opportunities && opportunities.length > 0 && (
          <motion.div variants={containerVariants} className="grid gap-6">
            {opportunities.map((opp, index) => {
              const messageContext = `${opp.entity_name} is trending with ${opp.current_mentions} mentions. Act now to mobilize support.`;
              const optimalTime = {
                time: "2-4 PM EST",
                reason: "Peak donor engagement based on your history"
              };

              return (
                <motion.div key={opp.id} variants={itemVariants}>
                  <MagicMomentCard
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
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </ClientLayout>
  );
}
