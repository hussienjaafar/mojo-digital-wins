import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { Copy, RotateCcw, Trash2, Clock, Mail, Building2 } from "lucide-react";

interface PendingInvitation {
  id: string;
  email: string;
  invitation_type: string;
  organization_id: string | null;
  organization_name: string | null;
  role: string | null;
  invited_by: string | null;
  invited_by_email: string | null;
  created_at: string;
  expires_at: string;
  status: string;
}

interface PendingInvitationsProps {
  type?: "platform_admin" | "organization_member" | null;
  organizationId?: string | null;
  onInvitationChange?: () => void;
}

export function PendingInvitations({
  type = null,
  organizationId = null,
  onInvitationChange,
}: PendingInvitationsProps) {
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [selectedInvitation, setSelectedInvitation] = useState<PendingInvitation | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [resending, setResending] = useState<string | null>(null);

  useEffect(() => {
    fetchInvitations();
  }, [type, organizationId]);

  const fetchInvitations = async () => {
    try {
      const { data, error } = await supabase.rpc("get_pending_invitations", {
        p_type: type,
        p_organization_id: organizationId,
      });

      if (error) throw error;
      setInvitations((data as PendingInvitation[]) || []);
    } catch (err) {
      console.error("Error fetching invitations:", err);
      toast.error("Failed to load pending invitations");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedInvitation) return;
    setRevoking(true);

    try {
      const { error } = await supabase
        .from("user_invitations")
        .update({ status: "revoked" })
        .eq("id", selectedInvitation.id);

      if (error) throw error;

      toast.success("Invitation revoked");
      setRevokeDialogOpen(false);
      setSelectedInvitation(null);
      fetchInvitations();
      onInvitationChange?.();
    } catch (err) {
      console.error("Error revoking invitation:", err);
      toast.error("Failed to revoke invitation");
    } finally {
      setRevoking(false);
    }
  };

  const handleResend = async (invitation: PendingInvitation) => {
    setResending(invitation.id);

    try {
      // Get the current session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please log in to resend invitations");
        return;
      }

      const response = await supabase.functions.invoke("send-user-invitation", {
        body: {
          email: invitation.email,
          type: invitation.invitation_type,
          organization_id: invitation.organization_id,
          role: invitation.role,
        },
      });

      if (response.error) throw response.error;

      // Delete the old invitation
      await supabase
        .from("user_invitations")
        .update({ status: "revoked" })
        .eq("id", invitation.id);

      toast.success("New invitation sent");
      fetchInvitations();
      onInvitationChange?.();
    } catch (err: any) {
      console.error("Error resending invitation:", err);
      toast.error(err.message || "Failed to resend invitation");
    } finally {
      setResending(null);
    }
  };

  const copyInviteLink = async (invitation: PendingInvitation) => {
    try {
      // We need to get the token - but it's not exposed in the RPC for security
      // Instead, show a message that they need to resend
      toast.info("Use 'Resend' to generate a new invitation link");
    } catch (err) {
      toast.error("Failed to copy link");
    }
  };

  const getExpiryStatus = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const hoursUntilExpiry = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilExpiry < 24) {
      return { variant: "destructive" as const, text: `Expires ${formatDistanceToNow(expiry, { addSuffix: true })}` };
    }
    return { variant: "secondary" as const, text: `Expires ${formatDistanceToNow(expiry, { addSuffix: true })}` };
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (invitations.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No pending invitations</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            {!type && <TableHead>Type</TableHead>}
            {type === "organization_member" || !type ? <TableHead>Organization</TableHead> : null}
            <TableHead>Role</TableHead>
            <TableHead>Sent</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invitations.map((invitation) => {
            const expiryStatus = getExpiryStatus(invitation.expires_at);
            return (
              <TableRow key={invitation.id}>
                <TableCell className="font-medium">{invitation.email}</TableCell>
                {!type && (
                  <TableCell>
                    <Badge variant={invitation.invitation_type === "platform_admin" ? "default" : "outline"}>
                      {invitation.invitation_type === "platform_admin" ? "Platform Admin" : "Org Member"}
                    </Badge>
                  </TableCell>
                )}
                {(type === "organization_member" || !type) && (
                  <TableCell>
                    {invitation.organization_name ? (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {invitation.organization_name}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                )}
                <TableCell>
                  {invitation.role ? (
                    <Badge variant="secondary" className="capitalize">
                      {invitation.role}
                    </Badge>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {formatDistanceToNow(new Date(invitation.created_at), { addSuffix: true })}
                </TableCell>
                <TableCell>
                  <Badge variant={expiryStatus.variant} className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {expiryStatus.text}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResend(invitation)}
                      disabled={resending === invitation.id}
                    >
                      <RotateCcw className={`h-4 w-4 ${resending === invitation.id ? "animate-spin" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedInvitation(invitation);
                        setRevokeDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Invitation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the invitation for{" "}
              <strong>{selectedInvitation?.email}</strong>? The invitation link will no longer work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevoke}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking ? "Revoking..." : "Revoke"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}