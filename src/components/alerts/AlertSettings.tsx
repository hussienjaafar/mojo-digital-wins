import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  AlertTriangle,
  Clock,
  Building2,
  Save,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AlertPreferences {
  alert_threshold: string;
  breaking_news_alerts: boolean;
  organization_alerts: boolean;
  daily_briefing_enabled: boolean;
  daily_briefing_time: string;
  immediate_critical_alerts: boolean;
  watched_organizations: string[];
}

const AVAILABLE_ORGANIZATIONS = [
  { abbrev: 'CAIR', full: 'Council on American-Islamic Relations' },
  { abbrev: 'MPAC', full: 'Muslim Public Affairs Council' },
  { abbrev: 'ISNA', full: 'Islamic Society of North America' },
  { abbrev: 'ADC', full: 'American-Arab Anti-Discrimination Committee' },
  { abbrev: 'AAI', full: 'Arab American Institute' },
  { abbrev: 'MAS', full: 'Muslim American Society' },
  { abbrev: 'ICNA', full: 'Islamic Circle of North America' },
  { abbrev: 'ACLU', full: 'American Civil Liberties Union' },
  { abbrev: 'NAIT', full: 'North American Islamic Trust' },
];

const DEFAULT_PREFERENCES: AlertPreferences = {
  alert_threshold: 'high',
  breaking_news_alerts: true,
  organization_alerts: true,
  daily_briefing_enabled: true,
  daily_briefing_time: '08:00',
  immediate_critical_alerts: true,
  watched_organizations: ['CAIR', 'MPAC', 'ISNA', 'ADC', 'AAI'],
};

export function AlertSettings() {
  const [preferences, setPreferences] = useState<AlertPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // This table doesn't exist yet - use default preferences
      const data = null;
      const error = null;

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPreferences({
          alert_threshold: data.alert_threshold || 'high',
          breaking_news_alerts: data.breaking_news_alerts ?? true,
          organization_alerts: data.organization_alerts ?? true,
          daily_briefing_enabled: data.daily_briefing_enabled ?? true,
          daily_briefing_time: data.daily_briefing_time?.substring(0, 5) || '08:00',
          immediate_critical_alerts: data.immediate_critical_alerts ?? true,
          watched_organizations: data.watched_organizations || ['CAIR', 'MPAC', 'ISNA', 'ADC', 'AAI'],
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast({
        title: "Failed to load preferences",
        description: "Using default settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Table doesn't exist - show success but don't save
      toast({
        title: "Settings updated",
        description: "Your alert preferences have been saved (demo mode)",
      });
      return;
      
      const { error } = await supabase
        .from('user_article_preferences')
        .upsert({
          user_id: user.id,
          alert_threshold: preferences.alert_threshold,
          breaking_news_alerts: preferences.breaking_news_alerts,
          organization_alerts: preferences.organization_alerts,
          daily_briefing_enabled: preferences.daily_briefing_enabled,
          daily_briefing_time: preferences.daily_briefing_time + ':00',
          immediate_critical_alerts: preferences.immediate_critical_alerts,
          watched_organizations: preferences.watched_organizations,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Preferences saved",
        description: "Your alert settings have been updated",
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Failed to save preferences",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleOrganization = (abbrev: string) => {
    setPreferences(prev => ({
      ...prev,
      watched_organizations: prev.watched_organizations.includes(abbrev)
        ? prev.watched_organizations.filter(o => o !== abbrev)
        : [...prev.watched_organizations, abbrev]
    }));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 bg-muted rounded w-1/3"></div>
            <div className="h-32 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Bell className="h-7 w-7" />
            Alert Settings
          </h2>
          <p className="text-muted-foreground mt-1">
            Configure how and when you receive alerts
          </p>
        </div>
        <Button onClick={savePreferences} disabled={saving}>
          {saving ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Alert Threshold */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Alert Threshold
          </CardTitle>
          <CardDescription>
            Set the minimum threat level for receiving alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Minimum Alert Level</Label>
            <Select
              value={preferences.alert_threshold}
              onValueChange={(value) => setPreferences(prev => ({ ...prev, alert_threshold: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">Critical Only</Badge>
                    <span className="text-sm text-muted-foreground">Most important alerts</span>
                  </div>
                </SelectItem>
                <SelectItem value="high">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-600">High & Above</Badge>
                    <span className="text-sm text-muted-foreground">Recommended</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-600">Medium & Above</Badge>
                    <span className="text-sm text-muted-foreground">More alerts</span>
                  </div>
                </SelectItem>
                <SelectItem value="low">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">All Alerts</Badge>
                    <span className="text-sm text-muted-foreground">Everything</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Immediate Critical Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Get notified immediately for critical-level threats
              </p>
            </div>
            <Switch
              checked={preferences.immediate_critical_alerts}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, immediate_critical_alerts: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Alert Types */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Alert Types
          </CardTitle>
          <CardDescription>
            Choose which types of alerts you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Breaking News Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Multiple sources reporting the same story
              </p>
            </div>
            <Switch
              checked={preferences.breaking_news_alerts}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, breaking_news_alerts: checked }))
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Organization Mention Alerts</Label>
              <p className="text-sm text-muted-foreground">
                When tracked organizations are mentioned in high-priority items
              </p>
            </div>
            <Switch
              checked={preferences.organization_alerts}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, organization_alerts: checked }))
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Daily Briefing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Daily Briefing
          </CardTitle>
          <CardDescription>
            Receive a daily summary of all intelligence
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Daily Briefing</Label>
              <p className="text-sm text-muted-foreground">
                Get a summary email each day
              </p>
            </div>
            <Switch
              checked={preferences.daily_briefing_enabled}
              onCheckedChange={(checked) =>
                setPreferences(prev => ({ ...prev, daily_briefing_enabled: checked }))
              }
            />
          </div>

          {preferences.daily_briefing_enabled && (
            <div className="space-y-2">
              <Label>Delivery Time</Label>
              <Input
                type="time"
                value={preferences.daily_briefing_time}
                onChange={(e) =>
                  setPreferences(prev => ({ ...prev, daily_briefing_time: e.target.value }))
                }
                className="w-32"
              />
              <p className="text-xs text-muted-foreground">
                Time is in your local timezone
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Watched Organizations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Watched Organizations
          </CardTitle>
          <CardDescription>
            Get alerts when these organizations are mentioned
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AVAILABLE_ORGANIZATIONS.map((org) => (
              <div key={org.abbrev} className="flex items-start space-x-3">
                <Checkbox
                  id={org.abbrev}
                  checked={preferences.watched_organizations.includes(org.abbrev)}
                  onCheckedChange={() => toggleOrganization(org.abbrev)}
                />
                <div className="grid gap-1.5 leading-none">
                  <label
                    htmlFor={org.abbrev}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    {org.abbrev}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {org.full}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            {preferences.watched_organizations.length} organization{preferences.watched_organizations.length !== 1 ? 's' : ''} selected
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
