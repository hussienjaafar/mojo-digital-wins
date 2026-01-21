import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, Mail, Eye, Edit, Trash2, Key, MoreVertical, Send, Search, X, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AdminPageHeader, AdminLoadingState } from "./v3";
import { V3Button } from "@/components/v3/V3Button";
import { V3Card, V3CardHeader, V3CardTitle, V3CardDescription, V3CardContent } from "@/components/v3/V3Card";
import { V3Badge, type V3BadgeVariant } from "@/components/v3/V3Badge";
import { V3FilterPill } from "@/components/v3/V3FilterPill";
import { InviteUserDialog } from "@/components/admin/InviteUserDialog";
import { PendingInvitations } from "@/components/admin/PendingInvitations";
import { UserPagination } from "@/components/admin/UserPagination";
import { BulkUserActions } from "@/components/admin/BulkUserActions";
import { SeatManagement } from "@/components/admin/SeatManagement";
import { MemberRequestQueue } from "@/components/admin/MemberRequestQueue";
import { motion } from "framer-motion";

// Role badge variant helper
const getRoleBadgeVariant = (role: string): V3BadgeVariant => {
  switch (role) {
    case 'admin': return 'info';
    case 'manager': return 'purple';
    case 'editor': return 'success';
    case 'viewer': return 'muted';
    default: return 'muted';
  }
};

// Status badge variant helper
const getStatusBadgeVariant = (status: string): V3BadgeVariant => {
  switch (status) {
    case 'active': return 'success';
    case 'pending': return 'warning';
    case 'suspended': return 'error';
    case 'inactive': return 'muted';
    default: return 'muted';
  }
};

type Organization = {
  id: string;
  name: string;
};

type ClientUser = {
  id: string;
  full_name: string;
  organization_id: string;
  role: string;
  status: 'pending' | 'active' | 'inactive' | 'suspended';
  created_at: string;
  last_login_at: string | null;
};

// Valid org roles
const ORG_ROLES = ['admin', 'manager', 'editor', 'viewer'] as const;
type OrgRole = typeof ORG_ROLES[number];

const ClientUserManager = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setImpersonation } = useImpersonation();
  const isMobile = useIsMobile();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [selectedOrgForInvite, setSelectedOrgForInvite] = useState<Organization | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ClientUser | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [pendingRequestCount, setPendingRequestCount] = useState(0);

  // Filter & pagination state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrgFilter, setSelectedOrgFilter] = useState("all");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [orgSearchOpen, setOrgSearchOpen] = useState(false);
  const [orgSearch, setOrgSearch] = useState("");

  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    organization_id: "",
    role: "viewer",
  });
  const [editFormData, setEditFormData] = useState({
    full_name: "",
    organization_id: "",
    role: "",
  });

  useEffect(() => {
    loadData();
  }, [currentPage, pageSize, searchQuery, selectedOrgFilter, selectedRoles, selectedStatus]);

  // Load organizations (only once)
  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      const { data: orgsData, error: orgsError } = await (supabase as any)
        .from('client_organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (orgsError) throw orgsError;
      setOrganizations(orgsData || []);
    } catch (error: any) {
      console.error('Error loading organizations:', error);
    }
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Build the query with filters
      let query = (supabase as any)
        .from('client_users')
        .select('*', { count: 'exact' });

      // Apply search filter
      if (searchQuery) {
        query = query.or(`full_name.ilike.%${searchQuery}%`);
      }

      // Apply organization filter
      if (selectedOrgFilter !== 'all') {
        query = query.eq('organization_id', selectedOrgFilter);
      }

      // Apply role filter
      if (selectedRoles.length > 0) {
        query = query.in('role', selectedRoles);
      }

      // Apply status filter
      if (selectedStatus !== 'all') {
        query = query.eq('status', selectedStatus);
      }

      // Pagination
      const offset = (currentPage - 1) * pageSize;
      query = query
        .range(offset, offset + pageSize - 1)
        .order('created_at', { ascending: false });

      const { data: usersData, count, error: usersError } = await query;

      if (usersError) throw usersError;
      setUsers(usersData || []);
      setTotalCount(count || 0);

      // Load pending invitation count
      const { data: pendingInviteData } = await supabase
        .from('user_invitations')
        .select('id')
        .eq('invitation_type', 'organization_member')
        .eq('status', 'pending');
      
      setPendingInviteCount(pendingInviteData?.length || 0);

      // Load pending member request count
      const { data: pendingRequestData } = await (supabase as any)
        .from('pending_member_requests')
        .select('id')
        .eq('status', 'pending');
      
      setPendingRequestCount(pendingRequestData?.length || 0);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pageSize, searchQuery, selectedOrgFilter, selectedRoles, selectedStatus, toast]);

  const handleInvite = (org: Organization) => {
    setSelectedOrgForInvite(org);
    setShowInviteDialog(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.full_name || !formData.organization_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Generate a temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase() + "!1";

      // Call edge function to create user
      const { data, error } = await supabase.functions.invoke('create-client-user', {
        body: {
          email: formData.email,
          full_name: formData.full_name,
          organization_id: formData.organization_id,
          role: formData.role,
          password: tempPassword,
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to create user");

      toast({
        title: "Success",
        description: "User created successfully. Welcome email sent with login credentials.",
      });

      setShowCreateDialog(false);
      setFormData({
        email: "",
        full_name: "",
        organization_id: "",
        role: "viewer",
      });
      loadData();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const getOrganizationName = (orgId: string) => {
    return organizations.find(o => o.id === orgId)?.name || 'Unknown';
  };

  const handleViewPortal = (user: ClientUser) => {
    const orgName = getOrganizationName(user.organization_id);
    setImpersonation(user.id, user.full_name, user.organization_id, orgName);
    navigate('/client/dashboard');
  };

  const handleEditClick = (user: ClientUser) => {
    setSelectedUser(user);
    setEditFormData({
      full_name: user.full_name,
      organization_id: user.organization_id,
      role: user.role,
    });
    setShowEditDialog(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsProcessing(true);
    try {
      const { error } = await (supabase as any)
        .from('client_users')
        .update({
          full_name: editFormData.full_name,
          organization_id: editFormData.organization_id,
          role: editFormData.role,
        })
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User updated successfully",
      });

      setShowEditDialog(false);
      setSelectedUser(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteClick = (user: ClientUser) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;

    setIsProcessing(true);
    try {
      // Delete client_users record (auth user will remain)
      const { error } = await (supabase as any)
        .from('client_users')
        .delete()
        .eq('id', selectedUser.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "User removed from organization",
      });

      setShowDeleteDialog(false);
      setSelectedUser(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetPassword = async (user: ClientUser) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-client-password', {
        body: {
          user_id: user.id,
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to reset password");

      toast({
        title: "Success",
        description: "Password reset email sent to user",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to reset password",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="Organization Members"
          description="Loading user accounts..."
          icon={Users}
          iconColor="blue"
        />
        <AdminLoadingState variant="table" count={6} />
      </div>
    );
  }

  // Mobile card renderer for users
  const renderMobileUserCard = (user: ClientUser) => (
    <V3Card key={user.id} className="overflow-hidden">
      <V3CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-[hsl(var(--portal-text-primary))]">{user.full_name}</p>
            <p className="text-xs text-[hsl(var(--portal-text-secondary))]">{getOrganizationName(user.organization_id)}</p>
          </div>
          <V3Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">{user.role}</V3Badge>
        </div>
        
        <div className="flex items-center justify-between text-xs text-[hsl(var(--portal-text-secondary))]">
          <span>Last login: {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}</span>
          <span>Created: {new Date(user.created_at).toLocaleDateString()}</span>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t border-[hsl(var(--portal-border))]">
          <V3Button
            variant="ghost"
            size="sm"
            onClick={() => handleViewPortal(user)}
          >
            <Eye className="h-4 w-4 mr-1" />
            View Portal
          </V3Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <V3Button variant="ghost" size="icon-sm">
                <MoreVertical className="h-4 w-4" />
              </V3Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]">
              <DropdownMenuItem onClick={() => handleEditClick(user)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit User
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                <Key className="h-4 w-4 mr-2" />
                Reset Password
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => handleDeleteClick(user)}
                className="text-[hsl(var(--portal-error))] focus:text-[hsl(var(--portal-error))]"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </V3CardContent>
    </V3Card>
  );

  // Selection handlers
  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUserIds.length === users.length) {
      setSelectedUserIds([]);
    } else {
      setSelectedUserIds(users.map(u => u.id));
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedOrgFilter("all");
    setSelectedRoles([]);
    setSelectedStatus("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || selectedOrgFilter !== "all" || selectedRoles.length > 0 || selectedStatus !== "all";
  const totalPages = Math.ceil(totalCount / pageSize);

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(orgSearch.toLowerCase())
  );

  const selectedOrgName = selectedOrgFilter === "all" 
    ? "All organizations" 
    : organizations.find(o => o.id === selectedOrgFilter)?.name || "Select organization";

  return (
    <V3Card accent="blue">
      <V3CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-[hsl(var(--portal-accent-blue)/0.1)]">
              <Users className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div>
              <V3CardTitle>Organization Members</V3CardTitle>
              <V3CardDescription>Manage user access within client organizations</V3CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Searchable org dropdown for inviting */}
            <Popover>
              <PopoverTrigger asChild>
                <V3Button variant="primary" className="w-full sm:w-auto" leftIcon={<UserPlus className="w-4 h-4" />}>
                  Invite User
                </V3Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px] p-0 bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]" align="end">
                <Command>
                  <CommandInput placeholder="Search organizations..." />
                  <CommandList>
                    <CommandEmpty>No organizations found.</CommandEmpty>
                    <CommandGroup>
                      {organizations.map((org) => (
                        <CommandItem
                          key={org.id}
                          onSelect={() => handleInvite(org)}
                          className="cursor-pointer"
                        >
                          <Send className="w-4 h-4 mr-2" />
                          {org.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </V3CardHeader>
      <V3CardContent>
        <Tabs defaultValue="users" className="w-full">
          <TabsList className="flex-wrap h-auto gap-1 bg-[hsl(var(--portal-bg-tertiary))] p-1 rounded-lg border border-[hsl(var(--portal-border))]">
            <TabsTrigger value="users" className="data-[state=active]:bg-[hsl(var(--portal-bg-secondary))] data-[state=active]:shadow-sm rounded-md">
              Active Members
              <V3Badge variant="muted" className="ml-2">{totalCount}</V3Badge>
            </TabsTrigger>
            <TabsTrigger value="pending" className="data-[state=active]:bg-[hsl(var(--portal-bg-secondary))] data-[state=active]:shadow-sm rounded-md">
              Pending Invites
              {pendingInviteCount > 0 && (
                <V3Badge variant="info" className="ml-2">{pendingInviteCount}</V3Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="requests" className="data-[state=active]:bg-[hsl(var(--portal-bg-secondary))] data-[state=active]:shadow-sm rounded-md">
              Member Requests
              {pendingRequestCount > 0 && (
                <V3Badge variant="error" className="ml-2">{pendingRequestCount}</V3Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="seats" className="data-[state=active]:bg-[hsl(var(--portal-bg-secondary))] data-[state=active]:shadow-sm rounded-md">
              <Settings className="w-4 h-4 mr-1" />
              Seats
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="users" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
              
              {/* Organization filter with search */}
              <Popover open={orgSearchOpen} onOpenChange={setOrgSearchOpen}>
                <PopoverTrigger asChild>
                  <V3Button variant="outline" className="justify-between min-w-[180px]">
                    <span className="truncate">{selectedOrgName}</span>
                  </V3Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search organizations..." 
                      value={orgSearch}
                      onValueChange={setOrgSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No organizations found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          onSelect={() => {
                            setSelectedOrgFilter("all");
                            setOrgSearchOpen(false);
                            setCurrentPage(1);
                          }}
                          className="cursor-pointer"
                        >
                          All organizations
                        </CommandItem>
                        {filteredOrganizations.map((org) => (
                          <CommandItem
                            key={org.id}
                            onSelect={() => {
                              setSelectedOrgFilter(org.id);
                              setOrgSearchOpen(false);
                              setCurrentPage(1);
                            }}
                            className="cursor-pointer"
                          >
                            {org.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Status filter */}
              <Select 
                value={selectedStatus} 
                onValueChange={(v) => {
                  setSelectedStatus(v);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <V3Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </V3Button>
              )}
            </div>

            {/* Role pills */}
            <div className="flex flex-wrap gap-2">
              {ORG_ROLES.map(role => (
                <V3FilterPill
                  key={role}
                  label={role}
                  isActive={selectedRoles.includes(role)}
                  className="capitalize"
                  onClick={() => {
                    setSelectedRoles(prev => 
                      prev.includes(role) 
                        ? prev.filter(r => r !== role)
                        : [...prev, role]
                    );
                    setCurrentPage(1);
                  }}
                />
              ))}
            </div>

            {/* Bulk Actions */}
            {selectedUserIds.length > 0 && selectedOrgFilter !== "all" && (
              <BulkUserActions
                selectedUserIds={selectedUserIds}
                organizationId={selectedOrgFilter}
                onActionComplete={() => {
                  loadData();
                  setSelectedUserIds([]);
                }}
                onClearSelection={() => setSelectedUserIds([])}
              />
            )}

            {/* Mobile Card View */}
            {isMobile ? (
              <div className="space-y-3">
                {users.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    {hasActiveFilters ? "No users match your filters" : "No users yet. Invite your first member!"}
                  </p>
                ) : (
                  users.map(renderMobileUserCard)
                )}
              </div>
            ) : (
              /* Desktop Table View */
              <Table className="[&_th]:bg-[hsl(var(--portal-bg-tertiary))] [&_th]:text-[hsl(var(--portal-text-secondary))] [&_th]:font-medium [&_th]:text-xs [&_th]:uppercase [&_th]:tracking-wider">
                <TableHeader>
                  <TableRow className="border-[hsl(var(--portal-border))]">
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={users.length > 0 && selectedUserIds.length === users.length}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Login</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-[hsl(var(--portal-text-secondary))]">
                        {hasActiveFilters ? "No users match your filters" : "No users yet. Invite your first member!"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.id} className="hover:bg-[hsl(var(--portal-bg-hover))] transition-colors duration-150 border-[hsl(var(--portal-border))]" data-state={selectedUserIds.includes(user.id) ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUserIds.includes(user.id)}
                            onCheckedChange={() => toggleUserSelection(user.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-[hsl(var(--portal-text-primary))]">{user.full_name}</TableCell>
                        <TableCell className="text-[hsl(var(--portal-text-secondary))]">
                          {getOrganizationName(user.organization_id)}
                        </TableCell>
                        <TableCell>
                          <V3Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">{user.role}</V3Badge>
                        </TableCell>
                        <TableCell>
                          <V3Badge variant={getStatusBadgeVariant(user.status)}>
                            {user.status || 'active'}
                          </V3Badge>
                        </TableCell>
                        <TableCell className="text-[hsl(var(--portal-text-secondary))]">
                          {user.last_login_at
                            ? new Date(user.last_login_at).toLocaleDateString()
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-[hsl(var(--portal-text-secondary))]">
                          {new Date(user.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <V3Button variant="ghost" size="icon-sm">
                                <MoreVertical className="h-4 w-4" />
                              </V3Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]">
                              <DropdownMenuItem onClick={() => handleViewPortal(user)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Portal
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditClick(user)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit User
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleResetPassword(user)}>
                                <Key className="h-4 w-4 mr-2" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDeleteClick(user)}
                                className="text-[hsl(var(--portal-error))] focus:text-[hsl(var(--portal-error))]"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <UserPagination
                currentPage={currentPage}
                totalPages={totalPages}
                pageSize={pageSize}
                totalCount={totalCount}
                onPageChange={setCurrentPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            )}
          </TabsContent>
          
          <TabsContent value="pending" className="mt-4">
            <PendingInvitations 
              type="organization_member" 
              onInvitationChange={loadData}
            />
          </TabsContent>

          <TabsContent value="requests" className="mt-4">
            <MemberRequestQueue onRequestProcessed={loadData} />
          </TabsContent>

          <TabsContent value="seats" className="mt-4">
            <SeatManagement />
          </TabsContent>
        </Tabs>
      </V3CardContent>

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Organization Member</DialogTitle>
            <DialogDescription>
              Add a new user to an organization. They will receive login credentials via email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john@example.com"
                required
              />
            </div>
            <div className="space-y-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-start gap-2">
                <Mail className="w-4 h-4 text-primary mt-0.5" />
                <div className="text-xs text-foreground">
                  <p className="font-medium mb-1">Automated Setup</p>
                  <p className="text-muted-foreground">A temporary password will be auto-generated and sent to the user via email with login instructions.</p>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="organization">Organization *</Label>
              <Select
                value={formData.organization_id}
                onValueChange={(value) => setFormData({ ...formData, organization_id: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                  <SelectItem value="editor">Editor (basic editing)</SelectItem>
                  <SelectItem value="manager">Manager (full editing)</SelectItem>
                  <SelectItem value="admin">Admin (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <V3Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowCreateDialog(false)}
                disabled={isCreating}
              >
                Cancel
              </V3Button>
              <V3Button type="submit" isLoading={isCreating} loadingText="Creating...">
                Create User
              </V3Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite Dialog */}
      {selectedOrgForInvite && (
        <InviteUserDialog
          open={showInviteDialog}
          onOpenChange={(open) => {
            setShowInviteDialog(open);
            if (!open) setSelectedOrgForInvite(null);
          }}
          type="organization_member"
          organizationId={selectedOrgForInvite.id}
          organizationName={selectedOrgForInvite.name}
          onSuccess={loadData}
        />
      )}

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit_full_name">Full Name</Label>
              <Input
                id="edit_full_name"
                value={editFormData.full_name}
                onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_organization">Organization</Label>
              <Select
                value={editFormData.organization_id}
                onValueChange={(value) => setEditFormData({ ...editFormData, organization_id: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_role">Role</Label>
              <Select
                value={editFormData.role}
                onValueChange={(value) => setEditFormData({ ...editFormData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer (read-only)</SelectItem>
                  <SelectItem value="editor">Editor (basic editing)</SelectItem>
                  <SelectItem value="manager">Manager (full editing)</SelectItem>
                  <SelectItem value="admin">Admin (full access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <V3Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowEditDialog(false)}
                disabled={isProcessing}
              >
                Cancel
              </V3Button>
              <V3Button type="submit" isLoading={isProcessing} loadingText="Updating...">
                Update User
              </V3Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{selectedUser?.full_name}</strong> from the organization?
              This will revoke their access to the client portal. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              disabled={isProcessing}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isProcessing ? "Deleting..." : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </V3Card>
  );
};

export default ClientUserManager;
