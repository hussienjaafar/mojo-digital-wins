import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Copy, Lightbulb, TrendingUp, Target, MessageSquare, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Session } from "@supabase/supabase-js";
import { ClientLayout } from "@/components/client/ClientLayout";

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
      
      // Load organization
      const { data: clientUser } = await (supabase as any)
        .from('client_users')
        .select('organization_id')
        .eq('id', session?.user?.id)
        .single();

      if (!clientUser) throw new Error("Organization not found");

      const { data: org } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', clientUser.organization_id)
        .single();

      setOrganization(org);

      // Load suggested actions with related alerts
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
      
      // Mark as used
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

  if (isLoading || !organization) {
    return null;
  }

  const usedActions = actions.filter(a => a.is_used);
  const pendingActions = actions.filter(a => !a.is_used);

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Actions</p>
                  <p className="text-3xl font-bold">{pendingActions.length}</p>
                </div>
                <Lightbulb className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Used This Week</p>
                  <p className="text-3xl font-bold">{usedActions.length}</p>
                </div>
                <Check className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Generated</p>
                  <p className="text-3xl font-bold">{actions.length}</p>
                </div>
                <MessageSquare className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions List */}
        {pendingActions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No pending suggestions</h3>
              <p className="text-muted-foreground text-center mb-4">
                New AI-generated action suggestions will appear here based on your alerts
              </p>
              <Button onClick={() => navigate('/client/alerts')}>
                View Alerts
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {pendingActions.map((action) => (
              <Card key={action.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-primary">
                          {action.action_type}
                        </Badge>
                        {action.topic_relevance_score >= 70 && (
                          <Badge className="bg-green-500">High Relevance</Badge>
                        )}
                        {action.urgency_score >= 70 && (
                          <Badge className="bg-red-500">Urgent</Badge>
                        )}
                      </div>
                      <CardTitle className="text-lg">{action.topic}</CardTitle>
                      <CardDescription>
                        {action.alert?.entity_name && `Related to: ${action.alert.entity_name}`}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Relevance</p>
                      <p className="text-2xl font-bold text-primary">{action.topic_relevance_score}%</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* SMS Preview */}
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">SMS Text Preview</span>
                      <Badge variant="outline">
                        {action.character_count}/160
                      </Badge>
                    </div>
                    <p className="text-sm font-mono">{action.sms_copy}</p>
                    <Progress value={(action.character_count / 160) * 100} className="h-1" />
                  </div>

                  {/* Scores */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Urgency Score</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={action.urgency_score} className="h-2 flex-1" />
                        <span className="text-sm font-bold">{action.urgency_score}%</span>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Target className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Impact</span>
                      </div>
                      <Badge variant="secondary">{action.estimated_impact}</Badge>
                    </div>
                  </div>

                  {/* Value Prop & Audience */}
                  <div className="space-y-2">
                    <div>
                      <p className="text-sm font-medium mb-1">Value Proposition</p>
                      <p className="text-sm text-muted-foreground">{action.value_proposition}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-1">Target Audience</p>
                      <p className="text-sm text-muted-foreground">{action.target_audience}</p>
                    </div>
                  </div>

                  {/* Historical Context */}
                  {action.historical_context && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-1">Historical Context</p>
                      <p className="text-xs text-muted-foreground">{action.historical_context}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={() => handleCopy(action)}
                      className="flex-1"
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
                    <Button
                      variant="outline"
                      onClick={() => handleDismiss(action.id)}
                    >
                      Dismiss
                    </Button>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Generated {format(new Date(action.created_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Used Actions Section */}
        {usedActions.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-4">Recently Used</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {usedActions.slice(0, 6).map((action) => (
                <Card key={action.id} className="opacity-75">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{action.topic}</CardTitle>
                      <Badge variant="outline" className="bg-green-500/10 text-green-500">
                        <Check className="h-3 w-3 mr-1" />
                        Used
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{action.sms_copy}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Used {format(new Date(action.created_at), 'MMM d, yyyy')}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientActions;
