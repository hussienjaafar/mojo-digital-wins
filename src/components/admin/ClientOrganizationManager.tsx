import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useImpersonation } from "@/contexts/ImpersonationContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Building2, Plus, Eye, LogIn, MoreVertical } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Organization = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_contact_email: string | null;
  is_active: boolean;
  created_at: string;
};

const ClientOrganizationManager = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setImpersonation } = useImpersonation();
  const isMobile = useIsMobile();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    primary_contact_email: "",
    logo_url: "",
  });

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load organizations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData({
      ...formData,
      name,
      slug: generateSlug(name),
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await (supabase as any)
        .from('client_organizations')
        .insert([{
          name: formData.name,
          slug: formData.slug,
          primary_contact_email: formData.primary_contact_email || null,
          logo_url: formData.logo_url || null,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Organization created successfully",
      });

      setShowCreateDialog(false);
      setFormData({ name: "", slug: "", primary_contact_email: "", logo_url: "" });
      loadOrganizations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create organization",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('client_organizations')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Organization ${!currentStatus ? 'activated' : 'deactivated'}`,
      });

      loadOrganizations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update organization",
        variant: "destructive",
      });
    }
  };

  const handleViewPortal = async (org: Organization) => {
    try {
      // Get the first user from this organization
      const { data: users, error } = await (supabase as any)
        .from('client_users')
        .select('id, full_name')
        .eq('organization_id', org.id)
        .limit(1);

      if (error) throw error;

      if (!users || users.length === 0) {
        toast({
          title: "No Users",
          description: "This organization has no users yet. Create a user first.",
          variant: "destructive",
        });
        return;
      }

      const user = users[0];
      setImpersonation(user.id, user.full_name, org.id, org.name);
      navigate('/client/dashboard');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to access portal",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 portal-animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold portal-text-primary">Client Organizations</h2>
            <p className="text-sm portal-text-secondary">Loading organizations...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="portal-card p-6 space-y-3" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="portal-skeleton h-12 w-12 rounded-lg" />
              <div className="portal-skeleton h-6 w-3/4" />
              <div className="portal-skeleton h-4 w-full" />
              <div className="flex gap-2 mt-4">
                <div className="portal-skeleton h-8 w-20" />
                <div className="portal-skeleton h-8 w-20" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Mobile card renderer
  const renderMobileCard = (org: Organization) => (
    <Card key={org.id} className="overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {org.logo_url && (
              <img src={org.logo_url} alt={org.name} className="w-10 h-10 rounded" />
            )}
            <div>
              <p className="font-medium">{org.name}</p>
              <p className="text-xs text-muted-foreground">{org.slug}</p>
            </div>
          </div>
          <Badge variant={org.is_active ? "default" : "secondary"}>
            {org.is_active ? "Active" : "Inactive"}
          </Badge>
        </div>
        
        {org.primary_contact_email && (
          <p className="text-sm text-muted-foreground">{org.primary_contact_email}</p>
        )}
        
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            Created {new Date(org.created_at).toLocaleDateString()}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => navigate(`/admin/client-view/${org.id}`)}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleViewPortal(org)}>
                <LogIn className="h-4 w-4 mr-2" />
                View Portal
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleActive(org.id, org.is_active)}>
                {org.is_active ? "Deactivate" : "Activate"}
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
              <Building2 className="w-5 h-5" />
              Client Organizations
            </CardTitle>
            <CardDescription>
              Manage client organizations and their access
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-2" />
                New Organization
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Organization</DialogTitle>
                <DialogDescription>
                  Add a new client organization to the portal
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Acme Corporation"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">URL Slug *</Label>
                  <Input
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="acme-corporation"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Auto-generated from name, can be customized
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Primary Contact Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.primary_contact_email}
                    onChange={(e) => setFormData({ ...formData, primary_contact_email: e.target.value })}
                    placeholder="contact@acme.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="logo">Logo URL</Label>
                  <Input
                    id="logo"
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Organization</Button>
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
            {organizations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No organizations yet. Create your first one!
              </p>
            ) : (
              organizations.map(renderMobileCard)
            )}
          </div>
        ) : (
          /* Desktop Table View */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No organizations yet. Create your first one!
                  </TableCell>
                </TableRow>
              ) : (
                organizations.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {org.logo_url && (
                          <img src={org.logo_url} alt={org.name} className="w-8 h-8 rounded" />
                        )}
                        {org.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{org.slug}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {org.primary_contact_email || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.is_active ? "default" : "secondary"}>
                        {org.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(org.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(`/admin/client-view/${org.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleViewPortal(org)}
                        >
                          <LogIn className="h-4 w-4 mr-2" />
                          View Portal
                        </Button>
                        <Button
                          size="sm"
                          variant={org.is_active ? "destructive" : "default"}
                          onClick={() => toggleActive(org.id, org.is_active)}
                        >
                          {org.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientOrganizationManager;
