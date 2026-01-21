import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Users, Trash2, Shield, User, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { RequestMemberDialog } from "./RequestMemberDialog";
import { SeatUsageDisplay } from "./SeatUsageDisplay";
import { PendingRequestsList } from "./PendingRequestsList";

interface TeamMember {
  id: string;
  full_name: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
  email?: string;
}

export function TeamManagement() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientUser } = await supabase
        .from("client_users")
        .select("organization_id, role")
        .eq("id", user.id)
        .maybeSingle();

      if (!clientUser) return;

      setCurrentUserRole(clientUser.role);
      setOrganizationId(clientUser.organization_id);

      const { data: teamMembers, error } = await supabase
        .from("client_users")
        .select("id, full_name, role, created_at, last_login_at")
        .eq("organization_id", clientUser.organization_id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setMembers(teamMembers || []);

      // Fetch pending requests count
      const { count } = await supabase
        .from("pending_member_requests")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", clientUser.organization_id)
        .eq("status", "pending");

      setPendingRequestsCount(count || 0);
    } catch (error) {
      console.error("Error fetching team members:", error);
      toast.error("Failed to load team members");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from the team?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("client_users")
        .delete()
        .eq("id", memberId);

      if (error) throw error;

      toast.success(`${memberName} has been removed from the team`);
      fetchTeamMembers();
    } catch (error) {
      console.error("Error removing member:", error);
      toast.error("Failed to remove team member");
    }
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from("client_users")
        .update({ role: newRole })
        .eq("id", memberId);

      if (error) throw error;

      toast.success("Role updated successfully");
      fetchTeamMembers();
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    }
  };

  const canManageTeam = currentUserRole === "admin" || currentUserRole === "manager";
  const canManageAdmins = currentUserRole === "admin";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seat Usage Display */}
      {organizationId && (
        <SeatUsageDisplay organizationId={organizationId} />
      )}

      <Tabs defaultValue="members" className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              Team Members
              <Badge variant="secondary" className="ml-1 text-xs">
                {members.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2">
              <FileText className="h-4 w-4" />
              Requests
              {pendingRequestsCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-xs">
                  {pendingRequestsCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {canManageTeam && organizationId && (
            <RequestMemberDialog
              organizationId={organizationId}
              canManageAdmins={canManageAdmins}
              onRequestSubmitted={fetchTeamMembers}
            />
          )}
        </div>

        <TabsContent value="members" className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead>Last Active</TableHead>
                  {canManageTeam && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          {member.role === "admin" ? (
                            <Shield className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <span className="font-medium">{member.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canManageTeam && (member.role !== "admin" || canManageAdmins) ? (
                        <Select
                          value={member.role || "viewer"}
                          onValueChange={(value) => handleRoleChange(member.id, value)}
                        >
                          <SelectTrigger className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Viewer</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            {canManageAdmins && (
                              <SelectItem value="admin">Admin</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={getRoleBadgeVariant(member.role || "viewer")}>
                          {member.role || "viewer"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(new Date(member.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.last_login_at
                        ? formatDistanceToNow(new Date(member.last_login_at), { addSuffix: true })
                        : "Never"}
                    </TableCell>
                    {canManageTeam && (
                      <TableCell>
                        {(member.role !== "admin" || canManageAdmins) && members.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveMember(member.id, member.full_name)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {!canManageTeam && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Contact your organization admin to manage team members
            </p>
          )}
        </TabsContent>

        <TabsContent value="requests">
          {organizationId && (
            <PendingRequestsList organizationId={organizationId} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
