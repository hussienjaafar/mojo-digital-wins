import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Plus, Trash2, Sparkles, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Session } from "@supabase/supabase-js";
import { ClientLayout } from "@/components/client/ClientLayout";

type WatchlistItem = {
  id: string;
  entity_name: string;
  entity_type: string;
  aliases: string[];
  alert_threshold: number;
  sentiment_alerts_enabled: boolean;
  relevance_score: number;
  created_at: string;
};

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

const ClientWatchlist = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    entity_name: "",
    entity_type: "organization",
    aliases: "",
    alert_threshold: 70,
    sentiment_alerts_enabled: true,
  });

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

      // Load watchlist
      const { data: watchlistData, error } = await (supabase as any)
        .from('entity_watchlist')
        .select('*')
        .eq('organization_id', clientUser.organization_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWatchlist(watchlistData || []);
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

  const handleAddEntity = async () => {
    if (!organization || !formData.entity_name) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('entity_watchlist')
        .insert({
          organization_id: organization.id,
          entity_name: formData.entity_name,
          entity_type: formData.entity_type,
          aliases: formData.aliases ? formData.aliases.split(',').map((a: string) => a.trim()) : [],
          alert_threshold: formData.alert_threshold,
          sentiment_alerts_enabled: formData.sentiment_alerts_enabled,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Entity added to watchlist",
      });

      setFormData({
        entity_name: "",
        entity_type: "organization",
        aliases: "",
        alert_threshold: 70,
        sentiment_alerts_enabled: true,
      });
      setShowForm(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteEntity = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('entity_watchlist')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Entity removed from watchlist",
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

  const toggleSentimentAlerts = async (id: string, current: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('entity_watchlist')
        .update({ sentiment_alerts_enabled: !current })
        .eq('id', id);

      if (error) throw error;
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

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Add Entity Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Entity Watchlist</CardTitle>
                <CardDescription>
                  Track organizations, people, topics, and issues relevant to your mission
                </CardDescription>
              </div>
              <Button onClick={() => setShowForm(!showForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Entity
              </Button>
            </div>
          </CardHeader>

          {showForm && (
            <CardContent>
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="entity_name">Entity Name *</Label>
                  <Input
                    id="entity_name"
                    value={formData.entity_name}
                    onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                    placeholder="e.g., ACLU, John Doe, Climate Change"
                  />
                </div>

                <div>
                  <Label htmlFor="entity_type">Entity Type</Label>
                  <Select
                    value={formData.entity_type}
                    onValueChange={(value) => setFormData({ ...formData, entity_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="organization">Organization</SelectItem>
                      <SelectItem value="person">Person</SelectItem>
                      <SelectItem value="topic">Topic</SelectItem>
                      <SelectItem value="location">Location</SelectItem>
                      <SelectItem value="opposition">Opposition</SelectItem>
                      <SelectItem value="issue">Issue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="aliases">Aliases (comma-separated)</Label>
                  <Input
                    id="aliases"
                    value={formData.aliases}
                    onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                    placeholder="e.g., ACLU, American Civil Liberties Union"
                  />
                </div>

                <div>
                  <Label>Alert Threshold: {formData.alert_threshold}%</Label>
                  <Slider
                    value={[formData.alert_threshold]}
                    onValueChange={([value]) => setFormData({ ...formData, alert_threshold: value })}
                    min={0}
                    max={100}
                    step={5}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Receive alerts when relevance score exceeds this threshold
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="sentiment"
                      checked={formData.sentiment_alerts_enabled}
                      onChange={(e) => setFormData({ ...formData, sentiment_alerts_enabled: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="sentiment" className="cursor-pointer">
                      Enable sentiment alerts
                    </Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddEntity}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Add to Watchlist
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Watchlist Items */}
        {watchlist.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No entities in watchlist</h3>
              <p className="text-muted-foreground text-center mb-4">
                Start tracking entities relevant to your organization's mission
              </p>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Entity
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {watchlist.map((item) => (
              <Card key={item.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{item.entity_name}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">{item.entity_type}</Badge>
                        {item.relevance_score > 0 && (
                          <Badge variant="secondary">
                            Score: {item.relevance_score}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {item.aliases && item.aliases.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Aliases:</p>
                        <div className="flex flex-wrap gap-1">
                          {item.aliases.map((alias, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {alias}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Alert threshold:</span>
                      <span className="font-medium">{item.alert_threshold}%</span>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSentimentAlerts(item.id, item.sentiment_alerts_enabled)}
                      >
                        {item.sentiment_alerts_enabled ? (
                          <>
                            <Eye className="h-4 w-4 mr-2" />
                            Alerts On
                          </>
                        ) : (
                          <>
                            <EyeOff className="h-4 w-4 mr-2" />
                            Alerts Off
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteEntity(item.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientWatchlist;
