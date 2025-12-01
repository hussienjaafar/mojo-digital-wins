import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, Users, Mail } from "lucide-react";

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
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [users, setUsers] = useState<ClientUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    organization_id: "",
    role: "viewer",
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

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/client-login`,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Failed to create user");

      // Create client user profile
      const { error: profileError } = await (supabase as any)
        .from('client_users')
        .insert([{
          id: authData.user.id,
          full_name: formData.full_name,
          organization_id: formData.organization_id,
          role: formData.role,
        }]);

      if (profileError) throw profileError;

      toast({
        title: "Success",
        description: "Client user created successfully",
      });

      setShowCreateDialog(false);
      setFormData({
        email: "",
        password: "",
        full_name: "",
        organization_id: "",
        role: "viewer",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    }
  };

  const getOrganizationName = (orgId: string) => {
    return organizations.find(o => o.id === orgId)?.name || 'Unknown';
  };

  if (isLoading) {
    return (
      <div className="space-y-6 portal-animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
            <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold portal-text-primary">Client Users</h2>
            <p className="text-sm portal-text-secondary">Loading user accounts...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="portal-card p-4 flex items-center gap-4" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="portal-skeleton h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="portal-skeleton h-5 w-48" />
                <div className="portal-skeleton h-4 w-32" />
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Client Users
            </CardTitle>
            <CardDescription>
              Manage user access to client organizations
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Client User</DialogTitle>
                <DialogDescription>
                  Add a new user to a client organization
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
                <div className="space-y-2">
                  <Label htmlFor="password">Temporary Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    User should change this on first login
                  </p>
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
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create User</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Organization</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Last Login</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default ClientUserManager;
