import { useState, useEffect } from "react";
import { ClientLayout } from "@/components/client/ClientLayout";
import { NotificationSettings } from "@/components/notifications/NotificationSettings";
import { PortalCard, PortalCardHeader, PortalCardTitle, PortalCardDescription, PortalCardContent } from "@/components/portal/PortalCard";
import { Settings as SettingsIcon, Bell, User, Shield, Palette, Loader2, Save, Eye, EyeOff } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "@/components/ThemeProvider";
import { formatDistanceToNow } from "date-fns";

export default function ClientSettings() {
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userProfile, setUserProfile] = useState({
    full_name: "",
    role: "",
    created_at: "",
    last_login_at: "",
  });
  const [email, setEmail] = useState("");
  
  // Password change
  const [showPasswordFields, setShowPasswordFields] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email || "");

      const { data: clientUser, error } = await supabase
        .from("client_users")
        .select("full_name, role, created_at, last_login_at")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      if (!clientUser) return;

      setUserProfile({
        full_name: clientUser.full_name || "",
        role: clientUser.role || "viewer",
        created_at: clientUser.created_at || "",
        last_login_at: clientUser.last_login_at || "",
      });
    } catch (error) {
      console.error("Error fetching user profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("client_users")
        .update({ full_name: userProfile.full_name })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      });

      if (error) throw error;

      toast.success("Password updated successfully");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setShowPasswordFields(false);
    } catch (error: any) {
      console.error("Error changing password:", error);
      toast.error(error.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "destructive";
      case "manager":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <ClientLayout showDateControls={false}>
      <div className="portal-scrollbar max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ background: 'hsl(var(--portal-accent-blue) / 0.1)' }}>
              <SettingsIcon className="h-6 w-6" style={{ color: 'hsl(var(--portal-accent-blue))' }} />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold portal-text-primary">Settings</h1>
          </div>
          <p className="portal-text-secondary text-sm sm:text-base">
            Manage your account preferences and portal settings
          </p>
        </div>

        {/* Settings Tabs */}
        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="portal-bg-secondary border border-border/30 mb-6">
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="profile" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="appearance" className="gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Appearance</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="notifications">
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle>Notification Preferences</PortalCardTitle>
                <PortalCardDescription>
                  Configure how and when you receive notifications
                </PortalCardDescription>
              </PortalCardHeader>
              <PortalCardContent>
                <NotificationSettings />
              </PortalCardContent>
            </PortalCard>
          </TabsContent>

          <TabsContent value="profile">
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle>Profile Settings</PortalCardTitle>
                <PortalCardDescription>
                  Manage your personal information and preferences
                </PortalCardDescription>
              </PortalCardHeader>
              <PortalCardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="full-name">Full Name</Label>
                      <Input
                        id="full-name"
                        value={userProfile.full_name}
                        onChange={(e) =>
                          setUserProfile({ ...userProfile, full_name: e.target.value })
                        }
                        placeholder="Your full name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-xs text-muted-foreground">
                        Contact your administrator to change your email address
                      </p>
                    </div>

                    <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Role</span>
                        <Badge variant={getRoleBadgeVariant(userProfile.role)}>
                          {userProfile.role}
                        </Badge>
                      </div>
                      {userProfile.created_at && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Member Since</span>
                          <span>{new Date(userProfile.created_at).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>

                    <Button onClick={handleSaveProfile} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Profile
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </PortalCardContent>
            </PortalCard>
          </TabsContent>

          <TabsContent value="security">
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle>Security Settings</PortalCardTitle>
                <PortalCardDescription>
                  Manage your password and security preferences
                </PortalCardDescription>
              </PortalCardHeader>
              <PortalCardContent>
                <div className="space-y-6">
                  {/* Last Login Info */}
                  <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Last Login</span>
                      <span className="text-sm">
                        {userProfile.last_login_at
                          ? formatDistanceToNow(new Date(userProfile.last_login_at), { addSuffix: true })
                          : "Unknown"}
                      </span>
                    </div>
                  </div>

                  {/* Password Change */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Password</h4>
                        <p className="text-sm text-muted-foreground">
                          Update your account password
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => setShowPasswordFields(!showPasswordFields)}
                      >
                        {showPasswordFields ? "Cancel" : "Change Password"}
                      </Button>
                    </div>

                    {showPasswordFields && (
                      <div className="space-y-4 p-4 border rounded-lg">
                        <div className="space-y-2">
                          <Label htmlFor="new-password">New Password</Label>
                          <div className="relative">
                            <Input
                              id="new-password"
                              type={showPasswords ? "text" : "password"}
                              value={passwordForm.newPassword}
                              onChange={(e) =>
                                setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                              }
                              placeholder="Enter new password"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
                              onClick={() => setShowPasswords(!showPasswords)}
                            >
                              {showPasswords ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="confirm-password">Confirm Password</Label>
                          <Input
                            id="confirm-password"
                            type={showPasswords ? "text" : "password"}
                            value={passwordForm.confirmPassword}
                            onChange={(e) =>
                              setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                            }
                            placeholder="Confirm new password"
                          />
                        </div>

                        <Button onClick={handleChangePassword} disabled={saving}>
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            "Update Password"
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </PortalCardContent>
            </PortalCard>
          </TabsContent>

          <TabsContent value="appearance">
            <PortalCard>
              <PortalCardHeader>
                <PortalCardTitle>Appearance Settings</PortalCardTitle>
                <PortalCardDescription>
                  Customize the look and feel of your portal
                </PortalCardDescription>
              </PortalCardHeader>
              <PortalCardContent>
                <div className="space-y-6">
                  {/* Theme Toggle */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Dark Mode</h4>
                      <p className="text-sm text-muted-foreground">
                        Switch between light and dark themes
                      </p>
                    </div>
                    <Switch
                      checked={theme === "dark"}
                      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                    />
                  </div>

                  {/* Theme Preview */}
                  <div className="p-4 rounded-lg border">
                    <p className="text-sm text-muted-foreground mb-3">Current Theme</p>
                    <div className="flex gap-2">
                      <Button
                        variant={theme === "light" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme("light")}
                      >
                        Light
                      </Button>
                      <Button
                        variant={theme === "dark" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme("dark")}
                      >
                        Dark
                      </Button>
                      <Button
                        variant={theme === "system" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setTheme("system")}
                      >
                        System
                      </Button>
                    </div>
                  </div>
                </div>
              </PortalCardContent>
            </PortalCard>
          </TabsContent>
        </Tabs>
      </div>
    </ClientLayout>
  );
}
