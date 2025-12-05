import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link2, Plus, Trash2, Target } from "lucide-react";
import { logger } from "@/lib/logger";

type Organization = {
  id: string;
  name: string;
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
};

type MetaCampaign = {
  campaign_id: string;
  campaign_name: string;
};

const CampaignAttributionManager = () => {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [metaCampaigns, setMetaCampaigns] = useState<MetaCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [attributionToDelete, setAttributionToDelete] = useState<string | null>(null);
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

      // Load attributions
      const { data: attrsData, error: attrsError } = await (supabase as any)
        .from('campaign_attribution')
        .select('*')
        .order('created_at', { ascending: false });

      if (attrsError) throw attrsError;
      setAttributions(attrsData || []);

      // Load Meta campaigns for dropdown
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const { error } = await (supabase as any)
        .from('campaign_attribution')
        .insert([{
          organization_id: formData.organization_id,
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
        organization_id: "",
        utm_source: "",
        utm_medium: "",
        utm_campaign: "",
        refcode: "",
        meta_campaign_id: "",
        switchboard_campaign_id: "",
      });
      loadData();
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

  if (isLoading) {
    return (
      <div className="space-y-6 portal-animate-fade-in">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
            <Target className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold portal-text-primary">Campaign Attribution</h2>
            <p className="text-sm portal-text-secondary">Loading attribution mappings...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="portal-card p-6 space-y-3" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex justify-between items-start">
                <div className="flex-1 space-y-2">
                  <div className="portal-skeleton h-5 w-40" />
                  <div className="portal-skeleton h-4 w-full" />
                </div>
              </div>
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
              <Link2 className="w-5 h-5" />
              Campaign Attribution
            </CardTitle>
            <CardDescription>
              Map tracking codes to campaigns for accurate ROI attribution
            </CardDescription>
          </div>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Attribution
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Attribution Mapping</DialogTitle>
                <DialogDescription>
                  Link UTM parameters and refcodes to specific campaigns
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
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
                  <Label htmlFor="meta_campaign_id">Meta Campaign ID</Label>
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
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">Create Attribution</Button>
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
              <TableHead>Organization</TableHead>
              <TableHead>UTM Parameters</TableHead>
              <TableHead>Refcode</TableHead>
              <TableHead>Meta Campaign</TableHead>
              <TableHead>SMS Campaign</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attributions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No attribution mappings yet. Create your first one!
                </TableCell>
              </TableRow>
            ) : (
              attributions.map((attr) => (
                <TableRow key={attr.id}>
                  <TableCell className="font-medium">
                    {getOrganizationName(attr.organization_id)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {attr.utm_source && <Badge variant="outline">source: {attr.utm_source}</Badge>}
                      {attr.utm_medium && <Badge variant="outline">medium: {attr.utm_medium}</Badge>}
                      {attr.utm_campaign && <Badge variant="outline">campaign: {attr.utm_campaign}</Badge>}
                      {!attr.utm_source && !attr.utm_medium && !attr.utm_campaign && (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {attr.refcode ? (
                      <Badge>{attr.refcode}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {attr.meta_campaign_id || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {attr.switchboard_campaign_id || '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteClick(attr.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

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
    </Card>
  );
};

export default CampaignAttributionManager;
