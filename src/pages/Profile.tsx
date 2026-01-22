import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  User,
  Mail,
  Shield,
  Building2,
  Key,
  LogOut,
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { isPasswordValid, validatePassword } from "@/lib/password-validation";

interface UserProfile {
  id: string;
  email: string;
  created_at: string;
  is_active: boolean;
}

interface UserAccess {
  isPlatformAdmin: boolean;
  organizations: {
    org_id: string;
    org_name: string;
    role: string;
  }[];
}

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [access, setAccess] = useState<UserAccess>({ isPlatformAdmin: false, organizations: [] });
  
  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/login");
        return;
      }

      // Get profile data
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, email, created_at, is_active")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData as UserProfile);

      // Check platform admin status
      const { data: hasAdminRole } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      // Get organization memberships
      const { data: orgData } = await supabase
        .from("client_users")
        .select(`
          organization_id,
          role,
          client_organizations (
            id,
            name
          )
        `)
        .eq("id", user.id);

      const organizations = (orgData || []).map((ou: any) => ({
        org_id: ou.organization_id,
        org_name: ou.client_organizations?.name || "Unknown",
        role: ou.role,
      }));

      setAccess({
        isPlatformAdmin: !!hasAdminRole,
        organizations,
      });
    } catch (err) {
      console.error("Error loading profile:", err);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }

    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      toast.error(validation.errors[0]);
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPasswordChanged(true);
      setShowPasswordForm(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully");

      setTimeout(() => setPasswordChanged(false), 3000);
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="container max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 rounded-full bg-primary/10">
          <User className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">My Profile</h1>
          <p className="text-muted-foreground">Manage your account settings</p>
        </div>
      </div>

      {/* Account Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div>
              <Label className="text-muted-foreground">Email</Label>
              <p className="font-medium">{profile.email}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Member Since</Label>
              <p className="font-medium">
                {new Date(profile.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* My Access */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            My Access
          </CardTitle>
          <CardDescription>
            Your access levels across the platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Platform Access */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <Shield className={`h-5 w-5 ${access.isPlatformAdmin ? "text-purple-600" : "text-muted-foreground"}`} />
              <div>
                <p className="font-medium">Platform Admin</p>
                <p className="text-sm text-muted-foreground">
                  {access.isPlatformAdmin
                    ? "You have full admin dashboard access"
                    : "Standard user access"}
                </p>
              </div>
            </div>
            {access.isPlatformAdmin && (
              <Badge className="bg-purple-100 text-purple-800">Active</Badge>
            )}
          </div>

          {/* Organization Access */}
          {access.organizations.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Organization Memberships
                </h4>
                <div className="space-y-2">
                  {access.organizations.map((org) => (
                    <div
                      key={org.org_id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <span className="font-medium">{org.org_name}</span>
                      <Badge variant="secondary" className="capitalize">
                        {org.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {!access.isPlatformAdmin && access.organizations.length === 0 && (
            <p className="text-center py-4 text-muted-foreground">
              No special access granted
            </p>
          )}
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>
            Manage your password and security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showPasswordForm ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-muted-foreground">
                  {passwordChanged ? (
                    <span className="text-green-600 flex items-center gap-1">
                      <CheckCircle className="h-4 w-4" />
                      Password updated successfully
                    </span>
                  ) : (
                    "Change your account password"
                  )}
                </p>
              </div>
              <Button variant="outline" onClick={() => setShowPasswordForm(true)}>
                Change Password
              </Button>
            </div>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrengthMeter password={newPassword} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-destructive">Passwords do not match</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={changingPassword || !isPasswordValid(newPassword) || newPassword !== confirmPassword}>
                  {changingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </div>
            </form>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sign Out</p>
              <p className="text-sm text-muted-foreground">
                Sign out of your account on this device
              </p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}