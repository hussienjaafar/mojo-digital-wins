import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Bell, Mail, Smartphone } from "lucide-react";

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkPushSupport();
    loadPreferences();
  }, []);

  const checkPushSupport = () => {
    setPushSupported('serviceWorker' in navigator && 'PushManager' in window);
  };

  const loadPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (!data) {
        // Create default preferences
        const { data: newPrefs, error: insertError } = await supabase
          .from('notification_preferences')
          .insert({
            user_id: user.id,
            email_notifications: true,
            push_notifications: false,
            notify_new_bills: true,
            notify_bill_updates: true,
            notify_new_articles: false,
            notify_bookmarked_articles: true,
            email_frequency: 'instant'
          })
          .select()
          .single();

        if (insertError) throw insertError;
        data = newPrefs;
      }

      setPreferences(data);
    } catch (error) {
      console.error('Error loading preferences:', error);
      toast({
        title: "Error loading preferences",
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
      if (!user || !preferences) return;

      const { error } = await supabase
        .from('notification_preferences')
        .update(preferences)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Preferences saved",
        description: "Your notification preferences have been updated",
      });
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error saving preferences",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePreference = (key: string, value: any) => {
    setPreferences((prev: any) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return <div className="text-center py-8">Loading preferences...</div>;
  }

  if (!preferences) {
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            <CardTitle>Email Notifications</CardTitle>
          </div>
          <CardDescription>
            Receive updates via email
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="email-notifications">Enable email notifications</Label>
            <Switch
              id="email-notifications"
              checked={preferences.email_notifications}
              onCheckedChange={(checked) => updatePreference('email_notifications', checked)}
            />
          </div>

          {preferences.email_notifications && (
            <>
              <div className="flex items-center justify-between">
                <Label htmlFor="notify-new-bills">New bills</Label>
                <Switch
                  id="notify-new-bills"
                  checked={preferences.notify_new_bills}
                  onCheckedChange={(checked) => updatePreference('notify_new_bills', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="notify-bill-updates">Bill updates</Label>
                <Switch
                  id="notify-bill-updates"
                  checked={preferences.notify_bill_updates}
                  onCheckedChange={(checked) => updatePreference('notify_bill_updates', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="notify-new-articles">New articles</Label>
                <Switch
                  id="notify-new-articles"
                  checked={preferences.notify_new_articles}
                  onCheckedChange={(checked) => updatePreference('notify_new_articles', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="notify-bookmarked">Bookmarked article updates</Label>
                <Switch
                  id="notify-bookmarked"
                  checked={preferences.notify_bookmarked_articles}
                  onCheckedChange={(checked) => updatePreference('notify_bookmarked_articles', checked)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-frequency">Email frequency</Label>
                <Select
                  value={preferences.email_frequency}
                  onValueChange={(value) => updatePreference('email_frequency', value)}
                >
                  <SelectTrigger id="email-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instant">Instant</SelectItem>
                    <SelectItem value="daily">Daily digest</SelectItem>
                    <SelectItem value="weekly">Weekly digest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            <CardTitle>Push Notifications</CardTitle>
          </div>
          <CardDescription>
            {pushSupported 
              ? "Receive instant notifications in your browser" 
              : "Push notifications are not supported in your browser"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="push-notifications">Enable push notifications</Label>
            <Switch
              id="push-notifications"
              checked={preferences.push_notifications}
              onCheckedChange={(checked) => updatePreference('push_notifications', checked)}
              disabled={!pushSupported}
            />
          </div>
          {!pushSupported && (
            <p className="text-sm text-muted-foreground mt-2">
              Try using Chrome, Firefox, or Edge for push notification support
            </p>
          )}
        </CardContent>
      </Card>

      <Button onClick={savePreferences} disabled={saving} className="w-full">
        {saving ? "Saving..." : "Save Preferences"}
      </Button>
    </div>
  );
}
