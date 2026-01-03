import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { V3Button } from "@/components/v3/V3Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link2, Plus, Trash2, Target, Wand2, DollarSign, Building2, TrendingUp, CheckCircle, AlertCircle, ChevronDown } from "lucide-react";
import { logger } from "@/lib/logger";
import AttributionMatcher from "./AttributionMatcher";
import { cn } from "@/lib/utils";
import { AdminPageHeader, AdminLoadingState } from "./v3";

type Organization = {
  id: string;
  name: string;
  slug: string;
};

type Attribution = {
  id: string;
  organization_id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  refcode: string | null;
  meta_campaign_id: string | null;
  switchboard_campaign_id: string | null;
  created_at: string;
  match_confidence: number | null;
  is_auto_matched: boolean | null;
  match_reason: string | null;
  attributed_revenue: number | null;
  attributed_transactions: number | null;
};

type MetaCampaign = {
  campaign_id: string;
  campaign_name: string;
};

type ClientStats = {
  totalRevenue: number;
  matchedRevenue: number;
  unmatchedRevenue: number;
  matchRate: number;
  totalTransactions: number;
  matchedTransactions: number;
};

const CampaignAttributionManager = () => {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attributionToDelete, setAttributionToDelete] = useState<string | null>(null);
  const [clientStats, setClientStats] = useState<ClientStats | null>(null);
  const [formData, setFormData] = useState({
    organization_id: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
    refcode: "",
    meta_campaign_id: "",
    switchboard_campaign_id: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedOrgId && selectedOrgId !== "all") {
      loadClientStats(selectedOrgId);
      // Pre-select the org for new attributions
      setFormData(prev => ({ ...prev, organization_id: selectedOrgId }));
    } else {
      setClientStats(null);
    }
  }, [selectedOrgId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: orgsData, error: orgsError } = await (supabase as any)
        .from('client_organizations')
        .select('id, name, slug')
        .eq('is_active', true)
        .order('name');

      if (orgsError) throw orgsError;
      setOrganizations(orgsData || []);

      const { data: attrsData, error: attrsError } = await (supabase as any)
        .from('campaign_attribution')
        .select('*')
        .order('attributed_revenue', { ascending: false, nullsFirst: false });

      if (attrsError) throw attrsError;
      setAttributions(attrsData || []);

      const { data: campaignsData, error: campaignsError } = await (supabase as any)
        .from('meta_campaigns')
        .select('campaign_id, campaign_name')
        .order('campaign_name');

      if (campaignsError) throw campaignsError;
      setMetaCampaigns(campaignsData || []);
    } catch (error: any) {
      logger.error('Failed to load attribution data', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadClientStats = async (orgId: string) => {
    try {
      // Get ActBlue transactions for this org
      const { data: txData } = await (supabase as any)
        .from('actblue_transactions')
        .select('amount, refcode')
        .eq('organization_id', orgId);

      // Get attributions for this org
      const { data: attrData } = await (supabase as any)
        .from('campaign_attribution')
        .select('refcode, attributed_revenue, attributed_transactions')
        .eq('organization_id', orgId);

      if (txData) {
        const totalRevenue = txData.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
        const totalTransactions = txData.length;
        
        const matchedRefcodes = new Set((attrData || []).map((a: any) => a.refcode?.toLowerCase()).filter(Boolean));
        
        const matchedTxs = txData.filter((tx: any) => tx.refcode && matchedRefcodes.has(tx.refcode.toLowerCase()));
        const matchedRevenue = matchedTxs.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
        const matchedTransactions = matchedTxs.length;

        setClientStats({
          totalRevenue,
          matchedRevenue,
          unmatchedRevenue: totalRevenue - matchedRevenue,
          matchRate: totalRevenue > 0 ? (matchedRevenue / totalRevenue) * 100 : 0,
          totalTransactions,
          matchedTransactions,
        });
      }
    } catch (error) {
      logger.error('Failed to load client stats', error);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const orgId = selectedOrgId !== "all" ? selectedOrgId : formData.organization_id;
    if (!orgId) {
      toast({
        title: "Error",
        description: "Please select an organization",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('campaign_attribution')
        .insert([{
          organization_id: orgId,
          utm_source: formData.utm_source || null,
          utm_medium: formData.utm_medium || null,
          utm_campaign: formData.utm_campaign || null,
          refcode: formData.refcode || null,
          meta_campaign_id: formData.meta_campaign_id || null,
          switchboard_campaign_id: formData.switchboard_campaign_id || null,
        }]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Campaign attribution created successfully",
      });

      setShowCreateDialog(false);
      setFormData({
        organization_id: selectedOrgId !== "all" ? selectedOrgId : "",
        utm_source: "",
        utm_medium: "",
        utm_campaign: "",
        refcode: "",
        meta_campaign_id: "",
        switchboard_campaign_id: "",
      });
      loadData();
      if (selectedOrgId !== "all") loadClientStats(selectedOrgId);
    } catch (error: any) {
      logger.error('Failed to create attribution', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create attribution",
        variant: "destructive",
      });
    }
  };

  const handleDeleteClick = (id: string) => {
    setAttributionToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!attributionToDelete) return;

    try {
      const { error } = await (supabase as any)
        .from('campaign_attribution')
        .delete()
        .eq('id', attributionToDelete);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Attribution deleted successfully",
      });

      loadData();
      if (selectedOrgId !== "all") loadClientStats(selectedOrgId);
    } catch (error: any) {
      logger.error('Failed to delete attribution', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete attribution",
        variant: "destructive",
      });
    }
  };

  const getOrganizationName = (orgId: string) => {
    return organizations.find(o => o.id === orgId)?.name || 'Unknown';
  };

  const getMetaCampaignName = (campaignId: string | null) => {
    if (!campaignId) return '-';
    const campaign = metaCampaigns.find(c => c.campaign_id === campaignId);
    return campaign?.campaign_name || campaignId;
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (!confidence) return null;
    if (confidence >= 0.9) {
      return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30 text-xs">High</Badge>;
    }
    if (confidence >= 0.7) {
      return <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30 text-xs">Medium</Badge>;
    }
    return <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-400 border-orange-500/30 text-xs">Low</Badge>;
  };

  // Filter attributions by selected org
  const filteredAttributions = selectedOrgId === "all" 
    ? attributions 
    : attributions.filter(a => a.organization_id === selectedOrgId);

  const selectedOrg = organizations.find(o => o.id === selectedOrgId);

  if (isLoading) {
    return (
      <div className="space-y-6 portal-animate-fade-in">
        <AdminPageHeader
          title="Campaign Attribution"
          description="Loading attribution mappings..."
          icon={Target}
          iconColor="purple"
        />
        <AdminLoadingState variant="card" count={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Client Selector */}
      <AdminPageHeader
        title="Campaign Attribution"
        description={selectedOrgId === "all" 
          ? "Manage attribution across all clients" 
          : `Managing ${selectedOrg?.name || 'client'}`}
        icon={Target}
        iconColor="purple"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground hidden sm:inline">Client:</span>
            </div>
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    All Clients
                  </span>
                </SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Client Stats - Only show when a specific client is selected */}
      {selectedOrgId !== "all" && clientStats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="portal-card border-l-4 border-l-primary">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm portal-text-secondary">Total Revenue</p>
                  <p className="text-xl font-bold portal-text-primary">
                    {formatCurrency(clientStats.totalRevenue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="portal-card border-l-4 border-l-green-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm portal-text-secondary">Attributed</p>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(clientStats.matchedRevenue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="portal-card border-l-4 border-l-amber-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <AlertCircle className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm portal-text-secondary">Unattributed</p>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    {formatCurrency(clientStats.unmatchedRevenue)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="portal-card border-l-4 border-l-blue-500">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm portal-text-secondary">Match Rate</p>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {clientStats.matchRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {clientStats.matchedTransactions}/{clientStats.totalTransactions} txns
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="matcher" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="matcher" className="flex items-center gap-2">
            <Wand2 className="w-4 h-4" />
            Smart Matcher
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            All Mappings ({filteredAttributions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matcher" className="mt-6">
          <AttributionMatcher organizationId={selectedOrgId === "all" ? undefined : selectedOrgId} />
        </TabsContent>

        <TabsContent value="manual" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Link2 className="w-5 h-5" />
                    Attribution Mappings
                    {selectedOrgId !== "all" && (
                      <Badge variant="outline">{selectedOrg?.name}</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {selectedOrgId === "all" 
                      ? "All configured campaign attribution mappings" 
                      : `Attribution mappings for ${selectedOrg?.name}`}
                  </CardDescription>
                </div>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                  <DialogTrigger asChild>
                    <V3Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Manual
                    </V3Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Create Attribution Mapping</DialogTitle>
                      <DialogDescription>
                        Link UTM parameters and refcodes to specific campaigns
                        {selectedOrgId !== "all" && ` for ${selectedOrg?.name}`}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4">
                      {selectedOrgId === "all" && (
                        <div className="space-y-2">
                          <Label htmlFor="organization">Organization *</Label>
                          <select
                            id="organization"
                            value={formData.organization_id}
                            onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
                            className="w-full px-3 py-2 border border-border rounded-md bg-background"
                            required
                          >
                            <option value="">Select organization</option>
                            {organizations.map((org) => (
                              <option key={org.id} value={org.id}>
                                {org.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="utm_source">UTM Source</Label>
                          <Input
                            id="utm_source"
                            value={formData.utm_source}
                            onChange={(e) => setFormData({ ...formData, utm_source: e.target.value })}
                            placeholder="facebook, google, email"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="utm_medium">UTM Medium</Label>
                          <Input
                            id="utm_medium"
                            value={formData.utm_medium}
                            onChange={(e) => setFormData({ ...formData, utm_medium: e.target.value })}
                            placeholder="cpc, email, social"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="utm_campaign">UTM Campaign</Label>
                        <Input
                          id="utm_campaign"
                          value={formData.utm_campaign}
                          onChange={(e) => setFormData({ ...formData, utm_campaign: e.target.value })}
                          placeholder="summer-fundraiser-2024"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="refcode">ActBlue Refcode</Label>
                        <Input
                          id="refcode"
                          value={formData.refcode}
                          onChange={(e) => setFormData({ ...formData, refcode: e.target.value })}
                          placeholder="SUMMER2024"
                        />
                        <p className="text-xs text-muted-foreground">
                          The refcode used in ActBlue donation links
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="meta_campaign_id">Meta Campaign</Label>
                        <select
                          id="meta_campaign_id"
                          value={formData.meta_campaign_id}
                          onChange={(e) => setFormData({ ...formData, meta_campaign_id: e.target.value })}
                          className="w-full px-3 py-2 border border-border rounded-md bg-background"
                        >
                          <option value="">None</option>
                          {metaCampaigns.map((campaign) => (
                            <option key={campaign.campaign_id} value={campaign.campaign_id}>
                              {campaign.campaign_name || campaign.campaign_id}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="switchboard_campaign_id">Switchboard Campaign ID</Label>
                        <Input
                          id="switchboard_campaign_id"
                          value={formData.switchboard_campaign_id}
                          onChange={(e) => setFormData({ ...formData, switchboard_campaign_id: e.target.value })}
                          placeholder="sms_campaign_123"
                        />
                      </div>

                      <div className="flex gap-2 justify-end pt-4">
                        <V3Button type="button" variant="secondary" onClick={() => setShowCreateDialog(false)}>
                          Cancel
                        </V3Button>
                        <V3Button type="submit">Create Attribution</V3Button>
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
                    {selectedOrgId === "all" && <TableHead>Organization</TableHead>}
                    <TableHead>Refcode</TableHead>
                    <TableHead>Meta Campaign</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAttributions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={selectedOrgId === "all" ? 6 : 5} className="text-center text-muted-foreground py-8">
                        <Target className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        No attribution mappings yet. Use Smart Matcher or add one manually!
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAttributions.map((attr) => (
                      <TableRow key={attr.id}>
                        {selectedOrgId === "all" && (
                          <TableCell className="font-medium">
                            {getOrganizationName(attr.organization_id)}
                          </TableCell>
                        )}
                        <TableCell>
                          {attr.refcode ? (
                            <Badge variant="outline" className="font-mono">{attr.refcode}</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {getMetaCampaignName(attr.meta_campaign_id)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getConfidenceBadge(attr.match_confidence)}
                            {attr.is_auto_matched && (
                              <Badge variant="outline" className="text-xs">
                                <Wand2 className="w-3 h-3 mr-1" />
                                Auto
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {attr.attributed_revenue ? (
                            <div className="flex items-center justify-end gap-1 text-green-600 dark:text-green-400">
                              <DollarSign className="w-3 h-3" />
                              {formatCurrency(attr.attributed_revenue)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <V3Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteClick(attr.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </V3Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attribution Mapping</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this attribution mapping? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CampaignAttributionManager;
