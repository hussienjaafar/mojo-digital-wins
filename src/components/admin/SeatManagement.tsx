import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Users, Settings, Edit, Search, AlertTriangle, Gift, History } from "lucide-react";
import { V3Button } from "@/components/v3/V3Button";
import { V3Card, V3CardHeader, V3CardTitle, V3CardDescription, V3CardContent } from "@/components/v3/V3Card";
import { V3Badge } from "@/components/v3/V3Badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";

type OrganizationSeatInfo = {
  id: string;
  name: string;
  seat_limit: number;
  bonus_seats: number;
  total_entitled: number;
  active_members: number;
  pending_invites: number;
  pending_requests: number;
  total_used: number;
  bonus_reason: string | null;
};

type SeatChangeLog = {
  id: string;
  organization_id: string;
  organization_name: string;
  change_type: string;
  old_limit: number | null;
  new_limit: number | null;
  old_bonus: number | null;
  new_bonus: number | null;
  reason: string | null;
  created_at: string;
};

export function SeatManagement() {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<OrganizationSeatInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingOrg, setEditingOrg] = useState<OrganizationSeatInfo | null>(null);
  const [newSeatLimit, setNewSeatLimit] = useState("");
  const [newBonusSeats, setNewBonusSeats] = useState("");
  const [bonusReason, setBonusReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [changeLog, setChangeLog] = useState<SeatChangeLog[]>([]);
  const [isLoadingLog, setIsLoadingLog] = useState(false);

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    setIsLoading(true);
    try {
      // Get all active organizations with seat limits and bonus_seats
      const { data: orgsData, error: orgsError } = await (supabase as any)
        .from('client_organizations')
        .select('id, name, seat_limit, bonus_seats, bonus_reason')
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
            seat_limit: org.seat_limit || 2,
            bonus_seats: org.bonus_seats || 0,
            total_entitled: (org.seat_limit || 2) + (org.bonus_seats || 0),
            active_members: usage?.members_count || 0,
            pending_invites: usage?.pending_invites_count || 0,
            pending_requests: usage?.pending_requests_count || 0,
            total_used: usage?.total_used || 0,
            bonus_reason: org.bonus_reason,
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

  const loadChangeLog = async () => {
    setIsLoadingLog(true);
    try {
      const { data, error } = await (supabase as any)
        .from('seat_change_log')
        .select(`
          id,
          organization_id,
          change_type,
          old_limit,
          new_limit,
          old_bonus,
          new_bonus,
          reason,
          created_at,
          client_organizations(name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const logs: SeatChangeLog[] = (data || []).map((log: any) => ({
        ...log,
        organization_name: log.client_organizations?.name || 'Unknown',
      }));

      setChangeLog(logs);
    } catch (error: any) {
      console.error('Error loading change log:', error);
    } finally {
      setIsLoadingLog(false);
    }
  };

  const handleEditClick = (org: OrganizationSeatInfo) => {
    setEditingOrg(org);
    setNewSeatLimit(org.seat_limit.toString());
    setNewBonusSeats(org.bonus_seats.toString());
    setBonusReason(org.bonus_reason || "");
  };

  const handleUpdateSeats = async () => {
    if (!editingOrg) return;

    const limit = parseInt(newSeatLimit);
    const bonus = parseInt(newBonusSeats) || 0;
    
    if (isNaN(limit) || limit < 1) {
      toast({
        title: "Invalid limit",
        description: "Seat limit must be at least 1",
        variant: "destructive",
      });
      return;
    }

    if (bonus < 0) {
      toast({
        title: "Invalid bonus",
        description: "Bonus seats cannot be negative",
        variant: "destructive",
      });
      return;
    }

    const totalEntitled = limit + bonus;
    if (totalEntitled < editingOrg.total_used) {
      toast({
        title: "Total too low",
        description: `Cannot set total seats below current usage (${editingOrg.total_used} seats in use)`,
        variant: "destructive",
      });
      return;
    }

    // Require reason if adding bonus seats
    if (bonus > 0 && !bonusReason.trim()) {
      toast({
        title: "Reason required",
        description: "Please provide a reason for the bonus seats",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      // Determine change type
      let changeType = 'limit_update';
      if (bonus !== editingOrg.bonus_seats) {
        if (bonus > editingOrg.bonus_seats) {
          changeType = editingOrg.bonus_seats === 0 ? 'bonus_added' : 'bonus_updated';
        } else if (bonus === 0) {
          changeType = 'bonus_removed';
        } else {
          changeType = 'bonus_updated';
        }
      }

      // Update organization
      const { error } = await (supabase as any)
        .from('client_organizations')
        .update({ 
          seat_limit: limit,
          bonus_seats: bonus,
          bonus_reason: bonus > 0 ? bonusReason : null,
        })
        .eq('id', editingOrg.id);

      if (error) throw error;

      // Log the change
      await supabase.rpc('log_seat_change', {
        p_org_id: editingOrg.id,
        p_changed_by: userId,
        p_change_type: changeType,
        p_old_limit: editingOrg.seat_limit,
        p_new_limit: limit,
        p_old_bonus: editingOrg.bonus_seats,
        p_new_bonus: bonus,
        p_reason: bonusReason || null,
      });

      toast({
        title: "Success",
        description: `Seat allocation updated for ${editingOrg.name}`,
      });

      setEditingOrg(null);
      loadOrganizations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update seats",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getUsageColor = (used: number, total: number) => {
    const percentage = (used / total) * 100;
    if (percentage >= 100) return "bg-destructive";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-primary";
  };

  const getChangeTypeBadge = (type: string) => {
    switch (type) {
      case 'bonus_added':
        return <V3Badge variant="success">Bonus Added</V3Badge>;
      case 'bonus_removed':
        return <V3Badge variant="error">Bonus Removed</V3Badge>;
      case 'bonus_updated':
        return <V3Badge variant="info">Bonus Updated</V3Badge>;
      case 'limit_update':
        return <V3Badge variant="muted">Limit Changed</V3Badge>;
      default:
        return <V3Badge variant="muted">{type}</V3Badge>;
    }
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <V3Card accent="blue">
        <V3CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[hsl(var(--portal-accent-blue)/0.1)]">
              <Settings className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div>
              <V3CardTitle>Seat Management</V3CardTitle>
              <V3CardDescription>Loading organization seat allocations...</V3CardDescription>
            </div>
          </div>
        </V3CardHeader>
        <V3CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <V3Card accent="blue">
      <V3CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[hsl(var(--portal-accent-blue)/0.1)]">
            <Settings className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
          </div>
          <div>
            <V3CardTitle>Seat Management</V3CardTitle>
            <V3CardDescription>View and adjust seat allocations for each organization</V3CardDescription>
          </div>
        </div>
      </V3CardHeader>
      <V3CardContent className="space-y-4">
        <Tabs defaultValue="organizations" onValueChange={(v) => v === 'history' && loadChangeLog()}>
          <TabsList className="bg-[hsl(var(--portal-bg-tertiary))] p-1 rounded-lg border border-[hsl(var(--portal-border))]">
            <TabsTrigger value="organizations" className="data-[state=active]:bg-[hsl(var(--portal-bg-secondary))] data-[state=active]:shadow-sm rounded-md">
              Organizations
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-[hsl(var(--portal-bg-secondary))] data-[state=active]:shadow-sm rounded-md">
              <History className="h-4 w-4 mr-1" />
              Change History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organizations" className="space-y-4">
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
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
              <div className="bg-[hsl(var(--portal-bg-tertiary))] rounded-lg p-3 border border-[hsl(var(--portal-border))]">
                <p className="text-sm text-[hsl(var(--portal-text-secondary))]">Total Orgs</p>
                <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{organizations.length}</p>
              </div>
              <div className="bg-[hsl(var(--portal-bg-tertiary))] rounded-lg p-3 border border-[hsl(var(--portal-border))]">
                <p className="text-sm text-[hsl(var(--portal-text-secondary))]">Purchased Seats</p>
                <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{organizations.reduce((sum, org) => sum + org.seat_limit, 0)}</p>
              </div>
              <div className="bg-[hsl(var(--portal-bg-tertiary))] rounded-lg p-3 border border-[hsl(var(--portal-border))]">
                <p className="text-sm text-[hsl(var(--portal-text-secondary))]">Bonus Seats</p>
                <p className="text-2xl font-bold text-[hsl(var(--portal-accent-blue))]">{organizations.reduce((sum, org) => sum + org.bonus_seats, 0)}</p>
              </div>
              <div className="bg-[hsl(var(--portal-bg-tertiary))] rounded-lg p-3 border border-[hsl(var(--portal-border))]">
                <p className="text-sm text-[hsl(var(--portal-text-secondary))]">Seats In Use</p>
                <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">{organizations.reduce((sum, org) => sum + org.active_members, 0)}</p>
              </div>
              <div className="bg-[hsl(var(--portal-bg-tertiary))] rounded-lg p-3 border border-[hsl(var(--portal-border))]">
                <p className="text-sm text-[hsl(var(--portal-text-secondary))]">At Capacity</p>
                <p className="text-2xl font-bold text-[hsl(var(--portal-error))]">
                  {organizations.filter(org => org.total_used >= org.total_entitled).length}
                </p>
              </div>
            </div>

            {/* Table */}
            <Table className="[&_th]:bg-[hsl(var(--portal-bg-tertiary))] [&_th]:text-[hsl(var(--portal-text-secondary))] [&_th]:font-medium [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider">
              <TableHeader>
                <TableRow className="border-[hsl(var(--portal-border))]">
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-center">Members</TableHead>
                  <TableHead className="text-center">Purchased</TableHead>
                  <TableHead className="text-center">Bonus</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrganizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-[hsl(var(--portal-text-secondary))] py-8">
                      No organizations found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrganizations.map((org) => (
                    <TableRow key={org.id} className="hover:bg-[hsl(var(--portal-bg-hover))] transition-colors duration-150 border-[hsl(var(--portal-border))]">
                      <TableCell className="font-medium text-[hsl(var(--portal-text-primary))]">{org.name}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1 text-[hsl(var(--portal-text-secondary))]">
                          <Users className="h-4 w-4" />
                          {org.active_members}
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium text-[hsl(var(--portal-text-primary))]">{org.seat_limit}</TableCell>
                      <TableCell className="text-center">
                        {org.bonus_seats > 0 ? (
                          <V3Badge variant="info" className="gap-1">
                            <Gift className="h-3 w-3" />
                            {org.bonus_seats}
                          </V3Badge>
                        ) : (
                          <span className="text-[hsl(var(--portal-text-tertiary))]">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-bold text-[hsl(var(--portal-text-primary))]">{org.total_entitled}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[150px]">
                          <Progress 
                            value={Math.min((org.total_used / org.total_entitled) * 100, 100)} 
                            className={`h-2 flex-1 ${getUsageColor(org.total_used, org.total_entitled)}`}
                          />
                          <span className="text-sm text-[hsl(var(--portal-text-secondary))] whitespace-nowrap">
                            {org.total_used}/{org.total_entitled}
                          </span>
                          {org.total_used >= org.total_entitled && (
                            <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-error))]" />
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
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            {isLoadingLog ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : changeLog.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No seat changes recorded yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Organization</TableHead>
                    <TableHead>Change Type</TableHead>
                    <TableHead>Limit</TableHead>
                    <TableHead>Bonus</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {changeLog.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.organization_name}</TableCell>
                      <TableCell>{getChangeTypeBadge(log.change_type)}</TableCell>
                      <TableCell>
                        {log.old_limit !== log.new_limit ? (
                          <span>{log.old_limit} → {log.new_limit}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {log.old_bonus !== log.new_bonus ? (
                          <span>{log.old_bonus} → {log.new_bonus}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {log.reason || '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </V3CardContent>

      {/* Edit Seat Allocation Dialog */}
      <Dialog open={!!editingOrg} onOpenChange={(open) => !open && setEditingOrg(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Seat Allocation</DialogTitle>
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
              <div className="flex justify-between text-sm border-t pt-2">
                <span className="text-muted-foreground">Total in use:</span>
                <span className="font-bold">{editingOrg?.total_used}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="seat_limit">Purchased Seats</Label>
                <Input
                  id="seat_limit"
                  type="number"
                  min={1}
                  value={newSeatLimit}
                  onChange={(e) => setNewSeatLimit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Billable seats</p>
              </div>
              <div className="space-y-2">
              <Label htmlFor="bonus_seats" className="flex items-center gap-1">
                  <Gift className="h-3 w-3 text-primary" />
                  Bonus Seats
                </Label>
                <Input
                  id="bonus_seats"
                  type="number"
                  min={0}
                  value={newBonusSeats}
                  onChange={(e) => setNewBonusSeats(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Complimentary</p>
              </div>
            </div>

            {parseInt(newBonusSeats) > 0 && (
              <div className="space-y-2">
                <Label htmlFor="bonus_reason">Reason for Bonus Seats *</Label>
                <Textarea
                  id="bonus_reason"
                  placeholder="e.g., Early adopter promotion, customer support accommodation..."
                  value={bonusReason}
                  onChange={(e) => setBonusReason(e.target.value)}
                  rows={2}
                />
              </div>
            )}

            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-sm">
                <span className="text-muted-foreground">Total entitled seats: </span>
                <span className="font-bold">
                  {(parseInt(newSeatLimit) || 0) + (parseInt(newBonusSeats) || 0)}
                </span>
                <span className="text-muted-foreground"> ({newSeatLimit} purchased + {newBonusSeats || 0} bonus)</span>
              </p>
            </div>

            {editingOrg && ((parseInt(newSeatLimit) || 0) + (parseInt(newBonusSeats) || 0)) < editingOrg.total_used && (
              <p className="text-xs text-destructive">
                Total cannot be less than current usage ({editingOrg.total_used})
              </p>
            )}

            <div className="flex gap-2 justify-end">
              <V3Button
                variant="outline"
                onClick={() => setEditingOrg(null)}
                disabled={isUpdating}
              >
                Cancel
              </V3Button>
              <V3Button
                onClick={handleUpdateSeats}
                isLoading={isUpdating}
                loadingText="Updating..."
              >
                Update Allocation
              </V3Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </V3Card>
  );
}
