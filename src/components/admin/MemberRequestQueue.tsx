import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Search, Check, X, Clock, Loader2, Users } from "lucide-react";
import { V3Button } from "@/components/v3/V3Button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

type Organization = {
  id: string;
  name: string;
};

type MemberRequest = {
  id: string;
  organization_id: string;
  organization_name: string;
  requested_by: string;
  requester_name: string;
  email: string;
  full_name: string;
  requested_role: string;
  notes: string | null;
  status: string;
  created_at: string;
};

interface MemberRequestQueueProps {
  onRequestProcessed?: () => void;
}

export function MemberRequestQueue({ onRequestProcessed }: MemberRequestQueueProps) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<MemberRequest[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgFilter, setOrgFilter] = useState("all");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<MemberRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load organizations for filter
      const { data: orgsData } = await (supabase as any)
        .from('client_organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      setOrganizations(orgsData || []);

      // Load pending member requests with organization info
      const { data: requestsData, error } = await (supabase as any)
        .from('pending_member_requests')
        .select(`
          id,
          organization_id,
          requested_by,
          email,
          full_name,
          requested_role,
          notes,
          status,
          created_at,
          client_organizations(name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get requester names
      const requestsWithNames: MemberRequest[] = await Promise.all(
        (requestsData || []).map(async (req: any) => {
          // Get requester name from client_users
          const { data: requesterData } = await (supabase as any)
            .from('client_users')
            .select('full_name')
            .eq('id', req.requested_by)
            .single();

          return {
            id: req.id,
            organization_id: req.organization_id,
            organization_name: req.client_organizations?.name || 'Unknown',
            requested_by: req.requested_by,
            requester_name: requesterData?.full_name || 'Unknown',
            email: req.email,
            full_name: req.full_name,
            requested_role: req.requested_role,
            notes: req.notes,
            status: req.status,
            created_at: req.created_at,
          };
        })
      );

      setRequests(requestsWithNames);
    } catch (error: any) {
      console.error('Error loading requests:', error);
      toast({
        title: "Error",
        description: "Failed to load member requests",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (request: MemberRequest) => {
    setProcessingId(request.id);
    try {
      // Get current user info for actor details
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', session?.user?.id)
        .single();

      // Send invitation via edge function
      const { data, error } = await supabase.functions.invoke('send-user-invitation', {
        body: {
          email: request.email,
          full_name: request.full_name,
          organization_id: request.organization_id,
          role: request.requested_role,
          type: 'organization_member',
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to send invitation');

      // Update request status
      const { error: updateError } = await (supabase as any)
        .from('pending_member_requests')
        .update({
          status: 'approved',
          processed_by: session?.user?.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', request.id);

      if (updateError) throw updateError;

      toast({
        title: "Request Approved",
        description: `Invitation sent to ${request.email}`,
      });

      loadData();
      onRequestProcessed?.();
    } catch (error: any) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to approve request",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectingRequest) return;

    setIsRejecting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const { error } = await (supabase as any)
        .from('pending_member_requests')
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason || null,
          processed_by: session?.user?.id,
          processed_at: new Date().toISOString(),
        })
        .eq('id', rejectingRequest.id);

      if (error) throw error;

      toast({
        title: "Request Rejected",
        description: `Member request for ${rejectingRequest.email} was rejected`,
      });

      setRejectingRequest(null);
      setRejectionReason("");
      loadData();
      onRequestProcessed?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reject request",
        variant: "destructive",
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'manager': return 'secondary';
      case 'editor': return 'outline';
      default: return 'outline';
    }
  };

  const filteredRequests = requests.filter(req => {
    const matchesSearch = 
      req.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      req.organization_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesOrg = orgFilter === 'all' || req.organization_id === orgFilter;
    
    return matchesSearch && matchesOrg;
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Member Requests
          </CardTitle>
          <CardDescription>Loading pending requests...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5" />
              Member Requests
              {requests.length > 0 && (
                <Badge variant="destructive">{requests.length}</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Review and process member requests from organizations
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, or organization..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={orgFilter} onValueChange={setOrgFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="All organizations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All organizations</SelectItem>
              {organizations.map(org => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">No pending requests</h3>
            <p className="text-muted-foreground">
              {requests.length === 0 
                ? "Organizations haven't submitted any member requests yet"
                : "No requests match your current filters"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Requested Member</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{request.full_name}</p>
                      <p className="text-sm text-muted-foreground">{request.email}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {request.organization_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {request.requester_name}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getRoleBadgeVariant(request.requested_role)} className="capitalize">
                      {request.requested_role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <V3Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApprove(request)}
                        disabled={processingId === request.id}
                      >
                        {processingId === request.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </>
                        )}
                      </V3Button>
                      <V3Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRejectingRequest(request)}
                        disabled={processingId === request.id}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </V3Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Reject Dialog */}
      <Dialog open={!!rejectingRequest} onOpenChange={(open) => !open && setRejectingRequest(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Member Request</DialogTitle>
            <DialogDescription>
              Reject the request for {rejectingRequest?.full_name} ({rejectingRequest?.email}) to join {rejectingRequest?.organization_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rejection_reason">Reason (optional)</Label>
              <Textarea
                id="rejection_reason"
                placeholder="Provide a reason for rejection (will be visible to the requester)..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <V3Button
                variant="outline"
                onClick={() => setRejectingRequest(null)}
                disabled={isRejecting}
              >
                Cancel
              </V3Button>
              <V3Button
                variant="destructive"
                onClick={handleReject}
                isLoading={isRejecting}
                loadingText="Rejecting..."
              >
                Reject Request
              </V3Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
