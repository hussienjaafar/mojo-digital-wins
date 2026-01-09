import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { V3Button } from "@/components/v3/V3Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, UserPlus, Clock, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PendingInvitations } from "@/components/admin/PendingInvitations";
import { InviteUserDialog } from "@/components/admin/InviteUserDialog";

export const AdminInviteCodes = () => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [stats, setStats] = useState({
    pending: 0,
    accepted: 0,
    expired: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data, error } = await supabase
        .from("user_invitations")
        .select("status")
        .eq("invitation_type", "platform_admin");

      if (error) throw error;

      const pending = data?.filter((i) => i.status === "pending").length || 0;
      const accepted = data?.filter((i) => i.status === "accepted").length || 0;
      const expired = data?.filter((i) => i.status === "expired" || i.status === "revoked").length || 0;

      setStats({ pending, accepted, expired });
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 portal-animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
            <Mail className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold portal-text-primary">Platform Admin Invitations</h2>
            <p className="text-sm portal-text-secondary">Loading...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="portal-card p-4 flex items-center justify-between" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex-1 space-y-2">
                <div className="portal-skeleton h-5 w-40" />
                <div className="portal-skeleton h-4 w-24" />
              </div>
              <div className="portal-skeleton h-8 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Platform Admin Invitations
            </CardTitle>
            <CardDescription>
              Invite new platform administrators via email. They'll receive a secure link to accept and create their account.
            </CardDescription>
          </div>
          <V3Button onClick={() => setShowInviteDialog(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Invite Admin
          </V3Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>
          <AlertDescription>
            Platform admins have full access to this admin dashboard, including user management, organization settings, and system configuration.
          </AlertDescription>
        </Alert>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Pending</span>
            </div>
            <p className="text-2xl font-bold">{stats.pending}</p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              <span className="text-sm">Accepted</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
          </div>
          <div className="p-4 rounded-lg border bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Expired/Revoked</span>
            </div>
            <p className="text-2xl font-bold text-muted-foreground">{stats.expired}</p>
          </div>
        </div>

        <Tabs defaultValue="pending" className="w-full">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              Pending
              {stats.pending > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {stats.pending}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-4">
            <PendingInvitations 
              type="platform_admin" 
              onInvitationChange={fetchStats}
            />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <InvitationHistory />
          </TabsContent>
        </Tabs>
      </CardContent>

      <InviteUserDialog
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
        type="platform_admin"
        onSuccess={fetchStats}
      />
    </Card>
  );
};

// Invitation history component
function InvitationHistory() {
  const [invitations, setInvitations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from("user_invitations")
        .select(`
          id,
          email,
          status,
          created_at,
          accepted_at,
          expires_at
        `)
        .eq("invitation_type", "platform_admin")
        .neq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setInvitations(data || []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-muted-foreground">Loading history...</div>;
  }

  if (invitations.length === 0) {
    return <div className="py-8 text-center text-muted-foreground">No invitation history yet</div>;
  }

  return (
    <div className="space-y-2">
      {invitations.map((inv) => (
        <div key={inv.id} className="flex items-center justify-between p-3 rounded-lg border">
          <div>
            <p className="font-medium">{inv.email}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(inv.created_at).toLocaleDateString()}
            </p>
          </div>
          <Badge
            variant={
              inv.status === "accepted"
                ? "default"
                : inv.status === "expired"
                ? "secondary"
                : "destructive"
            }
          >
            {inv.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}