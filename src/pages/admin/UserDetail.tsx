import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  User,
  Shield,
  Building2,
  Clock,
  Mail,
  ShieldCheck,
  ShieldOff,
  Plus,
  Trash2,
  History,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { InviteUserDialog } from "@/components/admin/InviteUserDialog";

interface UserDetails {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_active: boolean;
  roles: string[];
  organizations: {
    org_id: string;
    org_name: string;
    role: string;
  }[];
}

interface AuditLogEntry {
  id: string;
  action_type: string;
  created_at: string;
  old_value: any;
  new_value: any;
}

export default function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();

  const [user, setUser] = useState<UserDetails | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    action: () => Promise<void>;
  }>({ open: false, title: "", description: "", action: async () => {} });

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedOrgForInvite, setSelectedOrgForInvite] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    if (userId) {
      loadUser();
      loadAuditLogs();
    }
  }, [userId]);

  const loadUser = async () => {
    try {
      // Try the new RPC first, fall back to manual query
      const { data, error } = await supabase.rpc("get_users_with_roles_and_orgs");

      if (error) throw error;

      const foundUser = (data as UserDetails[])?.find((u) => u.id === userId);
      if (foundUser) {
        setUser(foundUser);
      } else {
        toast.error("User not found");
        navigate("/admin");
      }
    } catch (err) {
      console.error("Error loading user:", err);
      toast.error("Failed to load user details");
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("id, action_type, created_at, old_value, new_value")
        .or(`record_id.eq.${userId},new_value->user_id.eq.${userId}`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setAuditLogs((data as AuditLogEntry[]) || []);
    } catch (err) {
      console.error("Error loading audit logs:", err);
    }
  };

  const togglePlatformAdmin = async () => {
    if (!user) return;

    const isCurrentlyAdmin = user.roles.includes("admin");

    setConfirmDialog({
      open: true,
      title: isCurrentlyAdmin ? "Remove Platform Admin" : "Grant Platform Admin",
      description: isCurrentlyAdmin
        ? `Remove platform admin access from ${user.email}? They will lose access to the admin dashboard.`
        : `Grant platform admin access to ${user.email}? They will have full access to the admin dashboard.`,
      action: async () => {
        setProcessing(true);
        try {
          if (isCurrentlyAdmin) {
            const { error } = await supabase
              .from("user_roles")
              .delete()
              .eq("user_id", user.id)
              .eq("role", "admin");
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("user_roles")
              .insert({ user_id: user.id, role: "admin" });
            if (error) throw error;
          }

          toast.success(isCurrentlyAdmin ? "Platform admin access removed" : "Platform admin access granted");
          loadUser();
        } catch (err: any) {
          toast.error(err.message || "Failed to update role");
        } finally {
          setProcessing(false);
          setConfirmDialog({ ...confirmDialog, open: false });
        }
      },
    });
  };

  const removeFromOrganization = async (orgId: string, orgName: string) => {
    if (!user) return;

    setConfirmDialog({
      open: true,
      title: "Remove from Organization",
      description: `Remove ${user.email} from ${orgName}? They will lose access to this organization's portal.`,
      action: async () => {
        setProcessing(true);
        try {
          const { error } = await supabase
            .from("client_users")
            .delete()
            .eq("id", user.id)
            .eq("organization_id", orgId);

          if (error) throw error;

          toast.success(`Removed from ${orgName}`);
          loadUser();
        } catch (err: any) {
          toast.error(err.message || "Failed to remove from organization");
        } finally {
          setProcessing(false);
          setConfirmDialog({ ...confirmDialog, open: false });
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertDescription>User not found</AlertDescription>
        </Alert>
      </div>
    );
  }

  const isPlatformAdmin = user.roles.includes("admin");
  const hasOrgAccess = user.organizations.length > 0;

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <User className="h-6 w-6" />
            User Details
          </h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
        <Badge variant={user.is_active ? "default" : "destructive"}>
          {user.is_active ? "Active" : "Inactive"}
        </Badge>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Account Created</p>
              <p className="font-medium">
                {format(new Date(user.created_at), "PPP")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Last Sign In</p>
              <p className="font-medium">
                {user.last_sign_in_at
                  ? formatDistanceToNow(new Date(user.last_sign_in_at), { addSuffix: true })
                  : "Never"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Access Level</p>
              <div className="flex gap-2 mt-1">
                {isPlatformAdmin && (
                  <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                    Platform Admin
                  </Badge>
                )}
                {hasOrgAccess && (
                  <Badge variant="outline">
                    {user.organizations.length} Organization{user.organizations.length !== 1 ? "s" : ""}
                  </Badge>
                )}
                {!isPlatformAdmin && !hasOrgAccess && (
                  <Badge variant="secondary">No Access</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Access Management Tabs */}
      <Tabs defaultValue="platform" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="platform" className="gap-2">
            <Shield className="h-4 w-4" />
            Platform Access
          </TabsTrigger>
          <TabsTrigger value="organizations" className="gap-2">
            <Building2 className="h-4 w-4" />
            Organizations
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* Platform Access Tab */}
        <TabsContent value="platform" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Platform Admin Access</CardTitle>
              <CardDescription>
                Platform admins have full access to the admin dashboard, including user management and system settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  {isPlatformAdmin ? (
                    <ShieldCheck className="h-8 w-8 text-purple-600" />
                  ) : (
                    <ShieldOff className="h-8 w-8 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">
                      {isPlatformAdmin ? "Platform Admin" : "Standard User"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isPlatformAdmin
                        ? "Has full admin dashboard access"
                        : "No admin dashboard access"}
                    </p>
                  </div>
                </div>
                <Button
                  variant={isPlatformAdmin ? "destructive" : "default"}
                  onClick={togglePlatformAdmin}
                  disabled={processing}
                >
                  {isPlatformAdmin ? (
                    <>
                      <ShieldOff className="h-4 w-4 mr-2" />
                      Remove Admin
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4 mr-2" />
                      Grant Admin
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Organizations Tab */}
        <TabsContent value="organizations" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Organization Memberships</CardTitle>
                  <CardDescription>
                    Organizations this user has access to via the client portal.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {user.organizations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Not a member of any organizations</p>
                  <p className="text-sm">Use Organization Members to add this user to an organization</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {user.organizations.map((org) => (
                    <div
                      key={org.org_id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className="h-5 w-5 text-blue-600" />
                        <div>
                          <p className="font-medium">{org.org_name}</p>
                          <Badge variant="secondary" className="capitalize mt-1">
                            {org.role}
                          </Badge>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromOrganization(org.org_id, org.org_name)}
                        disabled={processing}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Role changes and access modifications for this user.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No activity recorded yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start gap-3 p-3 rounded-lg border"
                    >
                      <Clock className="h-4 w-4 mt-1 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium capitalize">
                          {log.action_type.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDialog.action} disabled={processing}>
              {processing ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invite Dialog */}
      {selectedOrgForInvite && (
        <InviteUserDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          type="organization_member"
          organizationId={selectedOrgForInvite.id}
          organizationName={selectedOrgForInvite.name}
          onSuccess={loadUser}
        />
      )}
    </div>
  );
}