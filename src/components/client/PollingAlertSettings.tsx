import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bell, Plus, Trash2, TrendingUp } from "lucide-react";

interface AlertConfig {
  id: string;
  organization_id: string;
  state: string | null;
  poll_type: string;
  threshold_percentage: number;
  is_active: boolean;
  notify_email: boolean;
  notify_in_app: boolean;
  created_at: string;
}

export default function PollingAlertSettings() {
  const [configs, setConfigs] = useState<AlertConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newConfig, setNewConfig] = useState({
    state: "",
    poll_type: "senate",
    threshold_percentage: 5,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientUser } = await supabase
        .from("client_users")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!clientUser) return;

      const { data, error } = await supabase
        .from("polling_alert_configs")
        .select("*")
        .eq("organization_id", clientUser.organization_id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error("Error fetching configs:", error);
    } finally {
      setLoading(false);
    }
  };

  const addConfig = async () => {
    if (!newConfig.state) {
      toast({
        title: "State Required",
        description: "Please select a state to monitor",
        variant: "destructive",
      });
      return;
    }

    setAdding(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: clientUser } = await supabase
        .from("client_users")
        .select("organization_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!clientUser) throw new Error("Organization not found");

      const { error } = await supabase
        .from("polling_alert_configs")
        .insert({
          organization_id: clientUser.organization_id,
          state: newConfig.state,
          poll_type: newConfig.poll_type,
          threshold_percentage: newConfig.threshold_percentage,
          is_active: true,
          notify_email: true,
          notify_in_app: true,
        });

      if (error) throw error;

      toast({
        title: "Alert Created",
        description: `You'll be notified of ${newConfig.threshold_percentage}%+ changes in ${newConfig.state} ${newConfig.poll_type} polls`,
      });

      setNewConfig({ state: "", poll_type: "senate", threshold_percentage: 5 });
      fetchConfigs();
    } catch (error: any) {
      console.error("Error adding config:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create alert",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const toggleConfig = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("polling_alert_configs")
        .update({ is_active: isActive })
        .eq("id", id);

      if (error) throw error;

      setConfigs(configs.map(c => c.id === id ? { ...c, is_active: isActive } : c));
      
      toast({
        title: isActive ? "Alert Enabled" : "Alert Disabled",
        description: isActive ? "You'll receive notifications for this race" : "Notifications paused for this race",
      });
    } catch (error) {
      console.error("Error toggling config:", error);
      toast({
        title: "Error",
        description: "Failed to update alert",
        variant: "destructive",
      });
    }
  };

  const deleteConfig = async (id: string) => {
    try {
      const { error } = await supabase
        .from("polling_alert_configs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setConfigs(configs.filter(c => c.id !== id));
      
      toast({
        title: "Alert Deleted",
        description: "Alert configuration has been removed",
      });
    } catch (error) {
      console.error("Error deleting config:", error);
      toast({
        title: "Error",
        description: "Failed to delete alert",
        variant: "destructive",
      });
    }
  };

  const states = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
    "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
    "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
    "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
    "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
    "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
    "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
    "Wisconsin", "Wyoming"
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading settings...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Polling Alert Settings
          </CardTitle>
          <CardDescription>
            Get notified when poll numbers change significantly in races you're tracking
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>State</Label>
              <Select value={newConfig.state} onValueChange={(v) => setNewConfig({...newConfig, state: v})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {states.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Race Type</Label>
              <Select value={newConfig.poll_type} onValueChange={(v) => setNewConfig({...newConfig, poll_type: v})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="senate">Senate</SelectItem>
                  <SelectItem value="house">House</SelectItem>
                  <SelectItem value="presidential">Presidential</SelectItem>
                  <SelectItem value="gubernatorial">Gubernatorial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Alert Threshold</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={newConfig.threshold_percentage}
                  onChange={(e) => setNewConfig({...newConfig, threshold_percentage: parseInt(e.target.value) || 5})}
                  className="flex-1"
                />
                <span className="flex items-center text-sm text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          <Button onClick={addConfig} disabled={adding} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Alert
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Alerts</CardTitle>
          <CardDescription>
            Manage your polling alert subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No polling alerts configured</p>
              <p className="text-sm mt-2">Add your first alert above to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {configs.map((config) => (
                <div key={config.id} className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/50">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={config.is_active}
                      onCheckedChange={(checked) => toggleConfig(config.id, checked)}
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-foreground">
                          {config.state} {config.poll_type}
                        </p>
                        <Badge variant={config.is_active ? "default" : "outline"}>
                          {config.is_active ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Alert when lead changes by ≥{config.threshold_percentage}%
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteConfig(config.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
