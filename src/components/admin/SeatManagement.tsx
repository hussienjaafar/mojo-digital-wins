import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Users, Settings, Edit, Search, AlertTriangle } from "lucide-react";
import { V3Button } from "@/components/v3/V3Button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

type OrganizationSeatInfo = {
  id: string;
  name: string;
  seat_limit: number;
  active_members: number;
  pending_invites: number;
  pending_requests: number;
  total_used: number;
};

export function SeatManagement() {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<OrganizationSeatInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingOrg, setEditingOrg] = useState<OrganizationSeatInfo | null>(null);
  const [newSeatLimit, setNewSeatLimit] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    setIsLoading(true);
    try {
      // Get all active organizations with seat limits
      const { data: orgsData, error: orgsError } = await (supabase as any)
        .from('client_organizations')
        .select('id, name, seat_limit')
        .eq('is_active', true)
        .order('name');

      if (orgsError) throw orgsError;

      // For each organization, get seat usage
      const orgsWithUsage: OrganizationSeatInfo[] = await Promise.all(
        (orgsData || []).map(async (org: any) => {
          const { data: usageData } = await supabase.rpc('get_org_seat_usage', {
            org_id: org.id
          });

          // RPC returns an array, get the first element
          const usage = Array.isArray(usageData) ? usageData[0] : usageData;

          return {
            id: org.id,
            name: org.name,
            seat_limit: org.seat_limit || 5,
            active_members: usage?.members_count || 0,
            pending_invites: usage?.pending_invites_count || 0,
            pending_requests: usage?.pending_requests_count || 0,
            total_used: usage?.total_used || 0,
          };
        })
      );

      setOrganizations(orgsWithUsage);
    } catch (error: any) {
      console.error('Error loading organizations:', error);
      toast({
        title: "Error",
        description: "Failed to load organization seat data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (org: OrganizationSeatInfo) => {
    setEditingOrg(org);
    setNewSeatLimit(org.seat_limit.toString());
  };

  const handleUpdateSeatLimit = async () => {
    if (!editingOrg) return;

    const limit = parseInt(newSeatLimit);
    if (isNaN(limit) || limit < 1) {
      toast({
        title: "Invalid limit",
        description: "Seat limit must be at least 1",
        variant: "destructive",
      });
      return;
    }

    if (limit < editingOrg.total_used) {
      toast({
        title: "Limit too low",
        description: `Cannot set limit below current usage (${editingOrg.total_used} seats in use)`,
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const { error } = await (supabase as any)
        .from('client_organizations')
        .update({ seat_limit: limit })
        .eq('id', editingOrg.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Seat limit updated to ${limit} for ${editingOrg.name}`,
      });

      setEditingOrg(null);
      loadOrganizations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update seat limit",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getUsageVariant = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 100) return "destructive";
    if (percentage >= 80) return "warning";
    return "default";
  };

  const getUsageColor = (used: number, limit: number) => {
    const percentage = (used / limit) * 100;
    if (percentage >= 100) return "bg-destructive";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-primary";
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Seat Management
          </CardTitle>
          <CardDescription>Loading organization seat allocations...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
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
              <Settings className="w-5 h-5" />
              Seat Management
            </CardTitle>
            <CardDescription>
              View and adjust seat allocations for each organization
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Total Organizations</p>
            <p className="text-2xl font-bold">{organizations.length}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Total Seats Allocated</p>
            <p className="text-2xl font-bold">{organizations.reduce((sum, org) => sum + org.seat_limit, 0)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">Seats In Use</p>
            <p className="text-2xl font-bold">{organizations.reduce((sum, org) => sum + org.active_members, 0)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-sm text-muted-foreground">At Capacity</p>
            <p className="text-2xl font-bold text-destructive">
              {organizations.filter(org => org.total_used >= org.seat_limit).length}
            </p>
          </div>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Organization</TableHead>
              <TableHead className="text-center">Active Members</TableHead>
              <TableHead className="text-center">Pending</TableHead>
              <TableHead className="text-center">Seat Limit</TableHead>
              <TableHead>Usage</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrganizations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No organizations found
                </TableCell>
              </TableRow>
            ) : (
              filteredOrganizations.map((org) => (
                <TableRow key={org.id}>
                  <TableCell className="font-medium">{org.name}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {org.active_members}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      {org.pending_invites > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {org.pending_invites} invites
                        </Badge>
                      )}
                      {org.pending_requests > 0 && (
                        <Badge variant="outline" className="text-xs">
                          {org.pending_requests} requests
                        </Badge>
                      )}
                      {org.pending_invites === 0 && org.pending_requests === 0 && (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium">{org.seat_limit}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 min-w-[150px]">
                      <Progress 
                        value={Math.min((org.total_used / org.seat_limit) * 100, 100)} 
                        className={`h-2 flex-1 ${getUsageColor(org.total_used, org.seat_limit)}`}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">
                        {org.total_used}/{org.seat_limit}
                      </span>
                      {org.total_used >= org.seat_limit && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <V3Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleEditClick(org)}
                    >
                      <Edit className="h-4 w-4" />
                    </V3Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit Seat Limit Dialog */}
      <Dialog open={!!editingOrg} onOpenChange={(open) => !open && setEditingOrg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Seat Limit</DialogTitle>
            <DialogDescription>
              Adjust the seat allocation for {editingOrg?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Active members:</span>
                <span className="font-medium">{editingOrg?.active_members}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending invites:</span>
                <span className="font-medium">{editingOrg?.pending_invites}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pending requests:</span>
                <span className="font-medium">{editingOrg?.pending_requests}</span>
              </div>
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Total in use:</span>
                <span className="font-bold">{editingOrg?.total_used}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="seat_limit">New Seat Limit</Label>
              <Input
                id="seat_limit"
                type="number"
                min={editingOrg?.total_used || 1}
                value={newSeatLimit}
                onChange={(e) => setNewSeatLimit(e.target.value)}
              />
              {editingOrg && parseInt(newSeatLimit) < editingOrg.total_used && (
                <p className="text-xs text-destructive">
                  Limit cannot be less than current usage ({editingOrg.total_used})
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <V3Button
                variant="outline"
                onClick={() => setEditingOrg(null)}
                disabled={isUpdating}
              >
                Cancel
              </V3Button>
              <V3Button
                onClick={handleUpdateSeatLimit}
                isLoading={isUpdating}
                loadingText="Updating..."
              >
                Update Limit
              </V3Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
