import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { Building2, Plus, Eye, LogIn, MoreVertical, Search, Users, Plug, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Filter } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Organization = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_contact_email: string | null;
  is_active: boolean;
  created_at: string;
};

type OrgStats = {
  userCount: number;
  integrationCount: number;
  lastActivity: string | null;
  hasErrors: boolean;
};

const ClientOrganizationManager = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setImpersonation } = useImpersonation();
  const isMobile = useIsMobile();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [orgStats, setOrgStats] = useState<Record<string, OrgStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterIntegrations, setFilterIntegrations] = useState<boolean>(false);
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);
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
      // Load organizations
      const { data: orgsData, error: orgsError } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .order('created_at', { ascending: false });

      if (orgsError) throw orgsError;
      setOrganizations(orgsData || []);

      // Load user counts per org
      const { data: usersData } = await (supabase as any)
        .from('client_users')
        .select('organization_id');

      // Load credentials per org
      const { data: credsData } = await (supabase as any)
        .from('client_api_credentials')
        .select('organization_id, last_sync_at, last_sync_status, is_active');

      // Build stats
      const stats: Record<string, OrgStats> = {};
      (orgsData || []).forEach((org: Organization) => {
        const orgUsers = (usersData || []).filter((u: any) => u.organization_id === org.id);
        const orgCreds = (credsData || []).filter((c: any) => c.organization_id === org.id);
        const activeCreds = orgCreds.filter((c: any) => c.is_active);
        const hasErrors = orgCreds.some((c: any) => c.last_sync_status === 'error');
        const lastSyncDates = orgCreds
          .map((c: any) => c.last_sync_at)
          .filter(Boolean)
          .sort()
          .reverse();

        stats[org.id] = {
          userCount: orgUsers.length,
          integrationCount: activeCreds.length,
          lastActivity: lastSyncDates[0] || null,
          hasErrors
        };
      });
      setOrgStats(stats);
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

  // Filter organizations
  const filteredOrganizations = useMemo(() => {
    return organizations.filter(org => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          org.name.toLowerCase().includes(query) ||
          org.slug.toLowerCase().includes(query) ||
          (org.primary_contact_email?.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filterStatus === 'active' && !org.is_active) return false;
      if (filterStatus === 'inactive' && org.is_active) return false;

      // Integrations filter
      if (filterIntegrations && (orgStats[org.id]?.integrationCount || 0) === 0) return false;

      return true;
    });
  }, [organizations, searchQuery, filterStatus, filterIntegrations, orgStats]);

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

  const handlePreviewAsClient = async (org: Organization) => {
    try {
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

  const getHealthBadge = (orgId: string, isActive: boolean) => {
    if (!isActive) {
      return (
        <Badge variant="secondary" className="gap-1">
          Inactive
        </Badge>
      );
    }
    
    const stats = orgStats[orgId];
    if (!stats) return null;
    
    if (stats.hasErrors) {
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="w-3 h-3" />
          Error
        </Badge>
      );
    }
    
    if (stats.integrationCount === 0) {
      return (
        <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-200 bg-yellow-50 dark:bg-yellow-950 dark:border-yellow-800">
          <AlertTriangle className="w-3 h-3" />
          No Integrations
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50 dark:bg-green-950 dark:border-green-800">
        <CheckCircle2 className="w-3 h-3" />
        Healthy
      </Badge>
    );
  };

  // Inline stats row
  const OrgStatsRow = ({ org }: { org: Organization }) => {
    const stats = orgStats[org.id];
    return (
      <div className="px-4 py-3 bg-muted/30 border-t space-y-3">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span>{stats?.userCount || 0} Users</span>
          </div>
          <div className="flex items-center gap-2">
            <Plug className="w-4 h-4 text-muted-foreground" />
            <span>{stats?.integrationCount || 0} Integrations</span>
          </div>
          <div className="text-muted-foreground">
            {stats?.lastActivity 
              ? `Last sync: ${new Date(stats.lastActivity).toLocaleDateString()}`
              : 'No activity'}
          </div>
        </div>
        {org.primary_contact_email && (
          <p className="text-sm text-muted-foreground">
            Contact: {org.primary_contact_email}
          </p>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6 portal-animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Client Organizations</h2>
            <p className="text-sm text-muted-foreground">Loading organizations...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-card border rounded-lg p-6 space-y-3" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="h-12 w-12 bg-muted animate-pulse rounded-lg" />
              <div className="h-6 w-3/4 bg-muted animate-pulse rounded" />
              <div className="h-4 w-full bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Mobile card renderer
  const renderMobileCard = (org: Organization) => {
    const stats = orgStats[org.id];
    const isExpanded = expandedOrg === org.id;
    
    return (
      <Card key={org.id} className="overflow-hidden">
        <Collapsible open={isExpanded} onOpenChange={() => setExpandedOrg(isExpanded ? null : org.id)}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-1">
                {org.logo_url && (
                  <img src={org.logo_url} alt={org.name} className="w-10 h-10 rounded" />
                )}
                <div className="min-w-0">
                  <p className="font-medium truncate">{org.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{stats?.userCount || 0} users</span>
                    <span>•</span>
                    <span>{stats?.integrationCount || 0} integrations</span>
                  </div>
                </div>
              </div>
              {getHealthBadge(org.id, org.is_active)}
            </div>
            
            <div className="flex items-center justify-between pt-3 mt-3 border-t">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Eye className="w-4 h-4" />
                  Quick Stats
                </Button>
              </CollapsibleTrigger>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handlePreviewAsClient(org)}>
                    <LogIn className="h-4 w-4 mr-2" />
                    Preview as Client
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => toggleActive(org.id, org.is_active)}>
                    {org.is_active ? "Deactivate" : "Activate"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
          <CollapsibleContent>
            <OrgStatsRow org={org} />
          </CollapsibleContent>
        </Collapsible>
      </Card>
    );
  };

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
      <CardContent className="space-y-4">
        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search organizations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Filters
                {(filterStatus !== 'all' || filterIntegrations) && (
                  <Badge variant="secondary" className="ml-1">
                    {(filterStatus !== 'all' ? 1 : 0) + (filterIntegrations ? 1 : 0)}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuCheckboxItem
                checked={filterStatus === 'active'}
                onCheckedChange={(checked) => setFilterStatus(checked ? 'active' : 'all')}
              >
                Active Only
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={filterStatus === 'inactive'}
                onCheckedChange={(checked) => setFilterStatus(checked ? 'inactive' : 'all')}
              >
                Inactive Only
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={filterIntegrations}
                onCheckedChange={setFilterIntegrations}
              >
                Has Integrations
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Mobile Card View */}
        {isMobile ? (
          <div className="space-y-3">
            {filteredOrganizations.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {searchQuery || filterStatus !== 'all' || filterIntegrations
                  ? 'No organizations match your filters'
                  : 'No organizations yet. Create your first one!'}
              </p>
            ) : (
              filteredOrganizations.map(renderMobileCard)
            )}
          </div>
        ) : (
          /* Desktop Table View */
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Integrations</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrganizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {searchQuery || filterStatus !== 'all' || filterIntegrations
                        ? 'No organizations match your filters'
                        : 'No organizations yet. Create your first one!'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrganizations.map((org) => {
                    const stats = orgStats[org.id];
                    const isExpanded = expandedOrg === org.id;
                    
                    return (
                      <>
                        <TableRow key={org.id} className="group">
                          <TableCell className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => setExpandedOrg(isExpanded ? null : org.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {org.logo_url && (
                                <img src={org.logo_url} alt={org.name} className="w-8 h-8 rounded" />
                              )}
                              <div>
                                <p>{org.name}</p>
                                <p className="text-xs text-muted-foreground">{org.slug}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-muted-foreground" />
                              {stats?.userCount || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Plug className="w-4 h-4 text-muted-foreground" />
                              {stats?.integrationCount || 0}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getHealthBadge(org.id, org.is_active)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(org.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handlePreviewAsClient(org)}
                              >
                                <LogIn className="h-4 w-4 mr-2" />
                                Preview as Client
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setExpandedOrg(isExpanded ? null : org.id)}>
                                    <Eye className="h-4 w-4 mr-2" />
                                    {isExpanded ? 'Hide' : 'Show'} Quick Stats
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => toggleActive(org.id, org.is_active)}>
                                    {org.is_active ? "Deactivate" : "Activate"}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${org.id}-stats`}>
                            <TableCell colSpan={7} className="p-0">
                              <OrgStatsRow org={org} />
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientOrganizationManager;
