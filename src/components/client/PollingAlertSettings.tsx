import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { V3Card, V3CardContent, V3CardDescription, V3CardHeader, V3CardTitle } from "@/components/v3/V3Card";
import { V3Button } from "@/components/v3/V3Button";
import { V3Badge } from "@/components/v3/V3Badge";
import { V3LoadingState } from "@/components/v3/V3LoadingState";
import { V3EmptyState } from "@/components/v3/V3EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    return <V3LoadingState variant="card" height={200} />;
  }

  return (
    <div className="space-y-6">
      <V3Card>
        <V3CardHeader>
          <V3CardTitle className="flex items-center gap-2 text-[hsl(var(--portal-text-primary))]">
            <Bell className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            Create New Alert
          </V3CardTitle>
          <V3CardDescription>
            Get notified when poll numbers change significantly in races you're tracking
          </V3CardDescription>
        </V3CardHeader>
        <V3CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-[hsl(var(--portal-text-primary))]">State</Label>
              <Select value={newConfig.state} onValueChange={(v) => setNewConfig({...newConfig, state: v})}>
                <SelectTrigger className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]">
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
              <Label className="text-[hsl(var(--portal-text-primary))]">Race Type</Label>
              <Select value={newConfig.poll_type} onValueChange={(v) => setNewConfig({...newConfig, poll_type: v})}>
                <SelectTrigger className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]">
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
              <Label className="text-[hsl(var(--portal-text-primary))]">Alert Threshold</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max="20"
                  value={newConfig.threshold_percentage}
                  onChange={(e) => setNewConfig({...newConfig, threshold_percentage: parseInt(e.target.value) || 5})}
                  className="flex-1 border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]"
                />
                <span className="flex items-center text-sm text-[hsl(var(--portal-text-muted))]">%</span>
              </div>
            </div>
          </div>

          <V3Button onClick={addConfig} disabled={adding} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Alert
          </V3Button>
        </V3CardContent>
      </V3Card>

      <V3Card>
        <V3CardHeader>
          <V3CardTitle className="text-[hsl(var(--portal-text-primary))]">Active Alerts</V3CardTitle>
          <V3CardDescription>
            Manage your polling alert subscriptions
          </V3CardDescription>
        </V3CardHeader>
        <V3CardContent>
          {configs.length === 0 ? (
            <V3EmptyState
              icon={TrendingUp}
              title="No Polling Alerts Configured"
              description="Add your first alert above to get started tracking poll changes"
              accent="amber"
            />
          ) : (
            <div className="space-y-3">
              {configs.map((config) => (
                <div key={config.id} className="flex items-center justify-between p-4 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={config.is_active}
                      onCheckedChange={(checked) => toggleConfig(config.id, checked)}
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-[hsl(var(--portal-text-primary))]">
                          {config.state} {config.poll_type}
                        </p>
                        <V3Badge variant={config.is_active ? "success" : "muted"}>
                          {config.is_active ? "Active" : "Paused"}
                        </V3Badge>
                      </div>
                      <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                        Alert when lead changes by ≥{config.threshold_percentage}%
                      </p>
                    </div>
                  </div>
                  <V3Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteConfig(config.id)}
                  >
                    <Trash2 className="h-4 w-4 text-[hsl(var(--portal-error))]" />
                  </V3Button>
                </div>
              ))}
            </div>
          )}
        </V3CardContent>
      </V3Card>
    </div>
  );
}
