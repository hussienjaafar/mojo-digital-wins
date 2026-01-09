import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
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
import { Search, Shield, Users, Building2, UsersRound } from "lucide-react";
import { V3Button } from "@/components/v3/V3Button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserAccessBadges } from "@/components/admin/UserAccessBadges";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { logger } from "@/lib/logger";

interface Organization {
  org_id: string;
  org_name: string;
  role: string;
}

interface UserWithRolesAndOrgs {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  is_active: boolean;
  roles: string[];
  organizations: Organization[];
}

export const UserManagement = () => {
  const [users, setUsers] = useState<UserWithRolesAndOrgs[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithRolesAndOrgs[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [accessFilter, setAccessFilter] = useState<string>("all");
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'role' | 'status';
    user: UserWithRolesAndOrgs | null;
    action: string;
  }>({ open: false, type: 'role', user: null, action: '' });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Try the new function first, fall back to old one
      const { data, error } = await supabase.rpc('get_users_with_roles_and_orgs');

      if (error) {
        logger.warn('get_users_with_roles_and_orgs failed, falling back to get_users_with_roles', error);
        // Fallback to old function
        const { data: fallbackData, error: fallbackError } = await supabase.rpc('get_users_with_roles');
        if (fallbackError) throw fallbackError;
        
        // Transform old data to new format
        const transformedData = (fallbackData || []).map((user: any) => ({
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          last_sign_in_at: user.last_sign_in_at,
          is_active: user.is_active,
          roles: user.roles || [],
          organizations: []
        }));
        setUsers(transformedData);
        setFilteredUsers(transformedData);
        return;
      }

      // Parse organizations from JSONB
      const parsedData = (data || []).map((user: any) => ({
        ...user,
        roles: user.roles || [],
        organizations: Array.isArray(user.organizations) 
          ? user.organizations.filter((org: any) => org.org_id)
          : []
      }));

      setUsers(parsedData);
      setFilteredUsers(parsedData);
    } catch (error: any) {
      logger.error('Failed to fetch users', error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter users based on search and filters
  useEffect(() => {
    let result = users;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(user =>
        user.email?.toLowerCase().includes(term) ||
        user.organizations.some(org => org.org_name?.toLowerCase().includes(term))
      );
    }

    // Role filter
    if (roleFilter !== "all") {
      if (roleFilter === "admin") {
        result = result.filter(user => user.roles.includes("admin"));
      } else if (roleFilter === "user") {
        result = result.filter(user => !user.roles.includes("admin"));
      }
    }

    // Access filter
    if (accessFilter !== "all") {
      if (accessFilter === "platform-only") {
        result = result.filter(user => user.roles.includes("admin") && user.organizations.length === 0);
      } else if (accessFilter === "org-only") {
        result = result.filter(user => !user.roles.includes("admin") && user.organizations.length > 0);
      } else if (accessFilter === "dual") {
        result = result.filter(user => user.roles.includes("admin") && user.organizations.length > 0);
      }
    }

    setFilteredUsers(result);
  }, [users, searchTerm, roleFilter, accessFilter]);

  // Stats calculations
  const stats = useMemo(() => {
    const total = users.length;
    const platformAdmins = users.filter(u => u.roles.includes("admin")).length;
    const orgMembers = users.filter(u => u.organizations.length > 0).length;
    const dualAccess = users.filter(u => u.roles.includes("admin") && u.organizations.length > 0).length;
    
    return { total, platformAdmins, orgMembers, dualAccess };
  }, [users]);

  const toggleUserRole = async (user: UserWithRolesAndOrgs) => {
    const hasAdminRole = user.roles.includes("admin");
    
    try {
      if (hasAdminRole) {
        // Remove admin role
        const { error } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', user.id)
          .eq('role', 'admin');
        
        if (error) throw error;
      } else {
        // Add admin role
        const { error } = await supabase
          .from('user_roles')
          .insert({ user_id: user.id, role: 'admin' });
        
        if (error) throw error;
      }

      // Log the action
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        await supabase.rpc('log_admin_action', {
          _action_type: hasAdminRole ? 'REMOVE_ADMIN_ROLE' : 'ADD_ADMIN_ROLE',
          _table_affected: 'user_roles',
          _record_id: user.id,
          _old_value: hasAdminRole ? { role: 'admin' } : null,
          _new_value: hasAdminRole ? null : { role: 'admin' }
        });
      }

      toast({
        title: "Success",
        description: hasAdminRole 
          ? "Platform admin role removed" 
          : "Platform admin role granted"
      });

      fetchUsers();
    } catch (error: any) {
      logger.error('Failed to toggle user role', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update role",
        variant: "destructive"
      });
    }
    
    setConfirmDialog({ open: false, type: 'role', user: null, action: '' });
  };

  const toggleUserStatus = async (user: UserWithRolesAndOrgs) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !user.is_active })
        .eq('id', user.id);

      if (error) throw error;

      // Log the action
      const { data: session } = await supabase.auth.getSession();
      if (session?.session?.user) {
        await supabase.rpc('log_admin_action', {
          _action_type: user.is_active ? 'DEACTIVATE_USER' : 'ACTIVATE_USER',
          _table_affected: 'profiles',
          _record_id: user.id,
          _old_value: { is_active: user.is_active },
          _new_value: { is_active: !user.is_active }
        });
      }

      toast({
        title: "Success",
        description: user.is_active ? "User deactivated" : "User activated"
      });

      fetchUsers();
    } catch (error: any) {
      logger.error('Failed to toggle user status', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive"
      });
    }
    
    setConfirmDialog({ open: false, type: 'status', user: null, action: '' });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Platform Admins
          </CardTitle>
          <CardDescription>Loading users...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-600" />
              Platform Admins
            </CardTitle>
            <CardDescription>
              Manage users with platform-wide administrative access to this dashboard
            </CardDescription>
          </div>
          
          <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-900 dark:text-blue-100">
              <strong>Platform admins</strong> have full access to this admin dashboard. 
              For organization-specific user management, see <strong>Organization Members</strong> in the Clients section.
            </AlertDescription>
          </Alert>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Users className="h-4 w-4" />
              Total Users
            </div>
            <p className="text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="p-4 rounded-lg bg-purple-50 dark:bg-purple-950/50">
            <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 mb-1">
              <Shield className="h-4 w-4" />
              Platform Admins
            </div>
            <p className="text-2xl font-semibold text-purple-900 dark:text-purple-100">{stats.platformAdmins}</p>
          </div>
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/50">
            <div className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 mb-1">
              <Building2 className="h-4 w-4" />
              Org Members
            </div>
            <p className="text-2xl font-semibold text-blue-900 dark:text-blue-100">{stats.orgMembers}</p>
          </div>
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/50">
            <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 mb-1">
              <UsersRound className="h-4 w-4" />
              Dual Access
            </div>
            <p className="text-2xl font-semibold text-green-900 dark:text-green-100">{stats.dualAccess}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email or organization..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admins Only</SelectItem>
              <SelectItem value="user">Non-Admins</SelectItem>
            </SelectContent>
          </Select>
          <Select value={accessFilter} onValueChange={setAccessFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by access" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Access Types</SelectItem>
              <SelectItem value="platform-only">Platform Only</SelectItem>
              <SelectItem value="org-only">Org Only</SelectItem>
              <SelectItem value="dual">Dual Access</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    {searchTerm || roleFilter !== "all" || accessFilter !== "all"
                      ? "No users match your filters"
                      : "No users found"
                    }
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.email}</TableCell>
                    <TableCell>
                      <UserAccessBadges
                        platformRoles={user.roles}
                        organizations={user.organizations}
                        compact
                        maxOrgsToShow={2}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.is_active ? "default" : "secondary"}>
                        {user.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.last_sign_in_at
                        ? new Date(user.last_sign_in_at).toLocaleDateString()
                        : "Never"
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <V3Button
                          variant={user.roles.includes("admin") ? "destructive" : "outline"}
                          size="sm"
                          onClick={() => setConfirmDialog({
                            open: true,
                            type: 'role',
                            user,
                            action: user.roles.includes("admin") ? "remove" : "grant"
                          })}
                        >
                          {user.roles.includes("admin") ? "Remove Admin" : "Make Admin"}
                        </V3Button>
                        <V3Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDialog({
                            open: true,
                            type: 'status',
                            user,
                            action: user.is_active ? "deactivate" : "activate"
                          })}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </V3Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Confirmation Dialog */}
      <AlertDialog 
        open={confirmDialog.open} 
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'role'
                ? confirmDialog.action === 'grant'
                  ? "Grant Platform Admin Access?"
                  : "Remove Platform Admin Access?"
                : confirmDialog.action === 'deactivate'
                  ? "Deactivate User?"
                  : "Activate User?"
              }
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === 'role'
                ? confirmDialog.action === 'grant'
                  ? `This will give ${confirmDialog.user?.email} full access to this admin dashboard.`
                  : `This will remove platform admin access from ${confirmDialog.user?.email}. They will lose access to this dashboard.`
                : confirmDialog.action === 'deactivate'
                  ? `This will prevent ${confirmDialog.user?.email} from logging in.`
                  : `This will restore login access for ${confirmDialog.user?.email}.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDialog.user) {
                  if (confirmDialog.type === 'role') {
                    toggleUserRole(confirmDialog.user);
                  } else {
                    toggleUserStatus(confirmDialog.user);
                  }
                }
              }}
              className={confirmDialog.action === 'remove' || confirmDialog.action === 'deactivate' 
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                : ""
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default UserManagement;
