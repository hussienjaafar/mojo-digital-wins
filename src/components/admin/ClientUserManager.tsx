import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, Mail, Eye, Edit, Trash2, Key, MoreVertical, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { AdminPageHeader, AdminLoadingState } from "./v3";
import { V3Button } from "@/components/v3/V3Button";

type Organization = {
  id: string;
  name: string;
};

type ClientUser = {
  id: string;
  full_name: string;
  organization_id: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
};

const ClientUserManager = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { setImpersonation } = useImpersonation();
  const isMobile = useIsMobile();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ClientUser | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
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
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load organizations
      const { data: orgsData, error: orgsError } = await (supabase as any)
        .from('client_organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (orgsError) throw orgsError;
      setOrganizations(orgsData || []);

      // Load client users
      const { data: usersData, error: usersError } = await (supabase as any)
        .from('client_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (usersError) throw usersError;
      setUsers(usersData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
    <Card key={user.id} className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{user.full_name}</p>
            <p className="text-xs text-muted-foreground">{getOrganizationName(user.organization_id)}</p>
          </div>
          <Badge variant="outline">{user.role}</Badge>
        </div>
        
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Last login: {user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : 'Never'}</span>
          <span>Created: {new Date(user.created_at).toLocaleDateString()}</span>
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
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
            <DropdownMenuContent align="end">
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
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete User
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Organization Members
            </CardTitle>
            <CardDescription>
              Manage user access within client organizations. Roles: Admin (full access), Manager (edit), Viewer (read-only)
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <V3Button variant="primary" className="w-full sm:w-auto" leftIcon={<UserPlus className="w-4 h-4" />}>
                Add User
              </V3Button>
            </DialogTrigger>
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
                <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div className="text-xs text-blue-900 dark:text-blue-100">
                      <p className="font-medium mb-1">Automated Setup</p>
                      <p>A temporary password will be auto-generated and sent to the user via email with login instructions.</p>
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
                      <SelectItem value="viewer">Viewer</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
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
        </div>
      </CardHeader>
      <CardContent>
        {/* Mobile Card View */}
        {isMobile ? (
          <div className="space-y-3">
            {users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No users yet. Create your first one!
              </p>
            ) : (
              users.map(renderMobileUserCard)
            )}
          </div>
        ) : (
          /* Desktop Table View */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No users yet. Create your first one!
                  </TableCell>
                </TableRow>
              ) : (
                users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {getOrganizationName(user.organization_id)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.role}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleDateString()
                        : 'Never'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
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
                          <DropdownMenuContent align="end">
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
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>

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
              <Label htmlFor="edit_full_name">Full Name *</Label>
              <Input
                id="edit_full_name"
                value={editFormData.full_name}
                onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_organization">Organization *</Label>
              <Select
                value={editFormData.organization_id}
                onValueChange={(value) => setEditFormData({ ...editFormData, organization_id: value })}
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
              <Label htmlFor="edit_role">Role *</Label>
              <Select
                value={editFormData.role}
                onValueChange={(value) => setEditFormData({ ...editFormData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Viewer</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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
    </Card>
  );
};

export default ClientUserManager;
