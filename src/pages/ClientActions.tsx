import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Lightbulb, TrendingUp, Target, MessageSquare, Check, Zap, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Session } from "@supabase/supabase-js";
import { ClientLayout } from "@/components/client/ClientLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
  V3KPICard,
  V3PageContainer,
  V3SectionHeader,
  V3LoadingState,
  V3EmptyState,
} from "@/components/v3";
import { cn } from "@/lib/utils";

type SuggestedAction = {
  id: string;
  alert_id: string;
  topic: string;
  action_type: string;
  sms_copy: string;
  topic_relevance_score: number;
  urgency_score: number;
  estimated_impact: string;
  value_proposition: string;
  target_audience: string;
  historical_context: string | null;
  character_count: number;
  is_used: boolean;
  is_dismissed: boolean;
  created_at: string;
  alert?: {
    entity_name: string;
    actionable_score: number;
  };
};

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

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
    transition: { duration: 0.3, ease: "easeOut" as const },
  },
};

const ClientActions = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [actions, setActions] = useState<SuggestedAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/client-login");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/client-login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      const { data: clientUser } = await (supabase as any)
        .from('client_users')
        .select('organization_id')
        .eq('id', session?.user?.id)
        .maybeSingle();

      if (!clientUser) throw new Error("Organization not found");

      const { data: org } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', clientUser.organization_id)
        .maybeSingle();

      if (!org) throw new Error("Organization not found");
      setOrganization(org);

      const { data: actionsData, error } = await (supabase as any)
        .from('suggested_actions')
        .select(`
          *,
          alert:client_entity_alerts(entity_name, actionable_score)
        `)
        .eq('organization_id', clientUser.organization_id)
        .eq('is_dismissed', false)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setActions(actionsData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (action: SuggestedAction) => {
    try {
      await navigator.clipboard.writeText(action.sms_copy);
      setCopiedId(action.id);

      const { error } = await (supabase as any)
        .from('suggested_actions')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('id', action.id);

      if (error) throw error;

      toast({
        title: "Copied to clipboard",
        description: "SMS text copied successfully",
      });

      setTimeout(() => setCopiedId(null), 2000);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('suggested_actions')
        .update({ is_dismissed: true })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Action dismissed",
        description: "This suggestion has been hidden",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const usedActions = actions.filter(a => a.is_used);
  const pendingActions = actions.filter(a => !a.is_used);

  return (
    <ClientLayout>
      <V3PageContainer
        icon={Zap}
        title="Suggested Actions"
        description="AI-generated campaign suggestions based on your alerts"
        animate={false}
      >
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >

        {/* Loading State */}
        {isLoading && (
          <motion.div variants={itemVariants} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <V3LoadingState variant="kpi" />
              <V3LoadingState variant="kpi" />
              <V3LoadingState variant="kpi" />
            </div>
            <V3LoadingState variant="channel" />
            <V3LoadingState variant="channel" />
          </motion.div>
        )}

        {!isLoading && (
          <>
            {/* Stats KPIs */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <V3KPICard
                icon={Lightbulb}
                label="Pending Actions"
                value={pendingActions.length.toString()}
                accent="amber"
              />
              <V3KPICard
                icon={Check}
                label="Used This Week"
                value={usedActions.length.toString()}
                accent="green"
              />
              <V3KPICard
                icon={MessageSquare}
                label="Total Generated"
                value={actions.length.toString()}
                accent="blue"
              />
            </motion.div>

            {/* Actions List */}
            {pendingActions.length === 0 ? (
              <motion.div variants={itemVariants}>
                <V3EmptyState
                  icon={Lightbulb}
                  title="No pending suggestions"
                  description="New AI-generated action suggestions will appear here based on your alerts"
                  action={
                    <Button
                      onClick={() => navigate('/client/alerts')}
                      className="min-h-[44px] bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.9)] text-white"
                    >
                      View Alerts
                    </Button>
                  }
                  accent="amber"
                />
              </motion.div>
            ) : (
              <motion.div variants={containerVariants} className="space-y-4">
                {pendingActions.map((action, index) => (
                  <motion.div key={action.id} variants={itemVariants}>
                    <V3Card
                      accent={action.urgency_score >= 70 ? "red" : action.topic_relevance_score >= 70 ? "green" : "blue"}
                      interactive
                    >
                      <V3CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge className="bg-[hsl(var(--portal-accent-blue))] text-white">
                                {action.action_type}
                              </Badge>
                              {action.topic_relevance_score >= 70 && (
                                <Badge className="bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]">
                                  High Relevance
                                </Badge>
                              )}
                              {action.urgency_score >= 70 && (
                                <Badge className="bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))] border-[hsl(var(--portal-error)/0.2)]">
                                  Urgent
                                </Badge>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold text-[hsl(var(--portal-text-primary))] line-clamp-2">
                              {action.topic}
                            </h3>
                            {action.alert?.entity_name && (
                              <p className="text-sm text-[hsl(var(--portal-text-secondary))] mt-1">
                                Related to: {action.alert.entity_name}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-[hsl(var(--portal-text-muted))]">Relevance</p>
                            <p className="text-2xl font-bold text-[hsl(var(--portal-accent-blue))] tabular-nums">
                              {action.topic_relevance_score}%
                            </p>
                          </div>
                        </div>
                      </V3CardHeader>

                      <V3CardContent className="space-y-4">
                        {/* SMS Preview */}
                        <div className="bg-[hsl(var(--portal-bg-elevated))] rounded-lg p-4 border border-[hsl(var(--portal-border))]">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                              SMS Text Preview
                            </span>
                            <Badge
                              variant="outline"
                              className="bg-transparent border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))]"
                            >
                              {action.character_count}/160
                            </Badge>
                          </div>
                          <p className="text-sm font-mono text-[hsl(var(--portal-text-primary))]">
                            {action.sms_copy}
                          </p>
                          <Progress
                            value={(action.character_count / 160) * 100}
                            className="h-1 mt-2"
                          />
                        </div>

                        {/* Scores Grid */}
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <TrendingUp className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                              <span className="text-sm text-[hsl(var(--portal-text-secondary))]">
                                Urgency Score
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Progress value={action.urgency_score} className="h-2 flex-1" />
                              <span className="text-sm font-bold text-[hsl(var(--portal-text-primary))] tabular-nums">
                                {action.urgency_score}%
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Target className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                              <span className="text-sm text-[hsl(var(--portal-text-secondary))]">
                                Impact
                              </span>
                            </div>
                            <Badge
                              variant="secondary"
                              className="bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-primary))]"
                            >
                              {action.estimated_impact}
                            </Badge>
                          </div>
                        </div>

                        {/* Value Prop & Audience */}
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-1">
                              Value Proposition
                            </p>
                            <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
                              {action.value_proposition}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-1">
                              Target Audience
                            </p>
                            <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
                              {action.target_audience}
                            </p>
                          </div>
                        </div>

                        {/* Historical Context */}
                        {action.historical_context && (
                          <div className="border-t border-[hsl(var(--portal-border))] pt-4">
                            <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-1">
                              Historical Context
                            </p>
                            <p className="text-xs text-[hsl(var(--portal-text-secondary))]">
                              {action.historical_context}
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-3 pt-4 border-t border-[hsl(var(--portal-border))]">
                          <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              onClick={() => handleCopy(action)}
                              className="w-full min-h-[44px] bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.9)] text-white"
                              disabled={copiedId === action.id}
                            >
                              {copiedId === action.id ? (
                                <>
                                  <Check className="h-4 w-4 mr-2" />
                                  Copied!
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy SMS Text
                                </>
                              )}
                            </Button>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              variant="outline"
                              onClick={() => handleDismiss(action.id)}
                              className="min-h-[44px] min-w-[44px] border-[hsl(var(--portal-border))] hover:bg-[hsl(var(--portal-bg-elevated))]"
                            >
                              Dismiss
                            </Button>
                          </motion.div>
                        </div>

                        <p className="text-xs text-[hsl(var(--portal-text-muted))] text-center flex items-center justify-center gap-1">
                          <Clock className="h-3 w-3" />
                          Generated {format(new Date(action.created_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      </V3CardContent>
                    </V3Card>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Used Actions Section */}
            {usedActions.length > 0 && (
              <motion.div variants={itemVariants} className="mt-12">
                <V3SectionHeader
                  title="Recently Used"
                  subtitle="Actions you've already implemented"
                  icon={Check}
                  className="mb-4"
                />
                <div className="grid gap-4 md:grid-cols-2">
                  {usedActions.slice(0, 6).map((action) => (
                    <motion.div key={action.id} variants={itemVariants}>
                      <V3Card accent="green" className="opacity-75">
                        <V3CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-base font-semibold text-[hsl(var(--portal-text-primary))] line-clamp-1">
                              {action.topic}
                            </h4>
                            <Badge className="bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))] border-[hsl(var(--portal-success)/0.2)]">
                              <Check className="h-3 w-3 mr-1" />
                              Used
                            </Badge>
                          </div>
                        </V3CardHeader>
                        <V3CardContent>
                          <p className="text-sm text-[hsl(var(--portal-text-secondary))] line-clamp-2">
                            {action.sms_copy}
                          </p>
                          <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-2">
                            Used {format(new Date(action.created_at), 'MMM d, yyyy')}
                          </p>
                        </V3CardContent>
                      </V3Card>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
        </motion.div>
      </V3PageContainer>
    </ClientLayout>
  );
};

export default ClientActions;
