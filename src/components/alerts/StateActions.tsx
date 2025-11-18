import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LoadingCard } from "@/components/ui/loading-spinner";
import { Building2, RefreshCw, Search, ExternalLink, Plus, MapPin, Download } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { ExportDialog } from "@/components/reports/ExportDialog";

import type { Database } from "@/integrations/supabase/types";

type StateActionRow = Database['public']['Tables']['state_actions']['Row'];

interface StateAction extends StateActionRow {
  state_code?: string;
  state_name?: string;
  official_name?: string;
  official_title?: string;
  action_date?: string;
  auto_tags?: string[];
  affected_organizations?: string[];
  threat_level?: string;
}

const threatLevelColors: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-gray-100 text-gray-800 border-gray-300',
};

const actionTypeLabels: Record<string, string> = {
  executive_order: 'Executive Order',
  designation: 'Designation',
  legislation: 'Legislation',
  lawsuit: 'Lawsuit',
  announcement: 'Announcement',
};

export function StateActions() {
  const [actions, setActions] = useState<StateAction[]>([]);
  const [filteredActions, setFilteredActions] = useState<StateAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [threatFilter, setThreatFilter] = useState<string>("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const { toast } = useToast();

  // Form state for adding manual action
  const [newAction, setNewAction] = useState({
    state_code: '',
    state_name: '',
    action_type: 'designation',
    title: '',
    description: '',
    source_url: '',
    official_name: '',
    official_title: '',
    action_date: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    fetchActions();
  }, []);

  useEffect(() => {
    filterActions();
  }, [actions, searchTerm, stateFilter, threatFilter]);

  const fetchActions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('state_actions')
        .select('*')
        .order('introduced_date', { ascending: false })
        .limit(100);

      if (error) throw error;
      setActions(data || []);
    } catch (error) {
      console.error('Error fetching state actions:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncActions = async () => {
    try {
      setSyncing(true);
      toast({
        title: "Syncing state actions...",
        description: "Fetching from state government RSS feeds",
      });

      const { data, error } = await supabase.functions.invoke('track-state-actions', {
        body: { action: 'fetch' }
      });

      if (error) throw error;

      toast({
        title: "Sync complete",
        description: `Found ${data.relevantFound} relevant state actions`,
      });

      await fetchActions();
    } catch (error) {
      console.error('Error syncing actions:', error);
      toast({
        title: "Sync failed",
        description: "Failed to fetch state actions",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const addManualAction = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('track-state-actions', {
        body: {
          action: 'add',
          ...newAction
        }
      });

      if (error) throw error;

      toast({
        title: "State action added",
        description: `Threat level: ${data.threatLevel}`,
      });

      setShowAddDialog(false);
      setNewAction({
        state_code: '',
        state_name: '',
        action_type: 'designation',
        title: '',
        description: '',
        source_url: '',
        official_name: '',
        official_title: '',
        action_date: new Date().toISOString().split('T')[0],
      });

      await fetchActions();
    } catch (error) {
      console.error('Error adding action:', error);
      toast({
        title: "Failed to add action",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  const filterActions = () => {
    let filtered = [...actions];

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(action =>
        action.title.toLowerCase().includes(search) ||
        action.description?.toLowerCase().includes(search) ||
        action.official_name?.toLowerCase().includes(search) ||
        action.affected_organizations?.some(org => org.toLowerCase().includes(search))
      );
    }

    if (stateFilter !== "all") {
      filtered = filtered.filter(action => action.state_code === stateFilter);
    }

    if (threatFilter !== "all") {
      filtered = filtered.filter(action => action.threat_level === threatFilter);
    }

    setFilteredActions(filtered);
  };

  // Get unique states from actions
  const states = [...new Set(actions.map(a => a.state_code))].sort();

  if (loading) {
    return <LoadingCard />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7" />
            State Actions
          </h2>
          <p className="text-muted-foreground mt-1">
            Tracking {filteredActions.length} state-level actions
          </p>
        </div>
        <div className="flex gap-2">
          <ExportDialog
            reportType="state_actions"
            title="State Actions"
            trigger={
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            }
          />
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Manual
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add State Action</DialogTitle>
                <DialogDescription>
                  Manually add a state-level action for tracking
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="state_code">State Code</Label>
                    <Input
                      id="state_code"
                      placeholder="TX"
                      value={newAction.state_code}
                      onChange={(e) => setNewAction({ ...newAction, state_code: e.target.value.toUpperCase() })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state_name">State Name</Label>
                    <Input
                      id="state_name"
                      placeholder="Texas"
                      value={newAction.state_name}
                      onChange={(e) => setNewAction({ ...newAction, state_name: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action_type">Action Type</Label>
                  <Select
                    value={newAction.action_type}
                    onValueChange={(value) => setNewAction({ ...newAction, action_type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="executive_order">Executive Order</SelectItem>
                      <SelectItem value="designation">Designation</SelectItem>
                      <SelectItem value="legislation">Legislation</SelectItem>
                      <SelectItem value="lawsuit">Lawsuit</SelectItem>
                      <SelectItem value="announcement">Announcement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    placeholder="Governor designates CAIR as terrorist organization"
                    value={newAction.title}
                    onChange={(e) => setNewAction({ ...newAction, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Details about the action..."
                    value={newAction.description}
                    onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="official_name">Official Name</Label>
                    <Input
                      id="official_name"
                      placeholder="Greg Abbott"
                      value={newAction.official_name}
                      onChange={(e) => setNewAction({ ...newAction, official_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="official_title">Title</Label>
                    <Input
                      id="official_title"
                      placeholder="Governor"
                      value={newAction.official_title}
                      onChange={(e) => setNewAction({ ...newAction, official_title: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source_url">Source URL</Label>
                  <Input
                    id="source_url"
                    type="url"
                    placeholder="https://..."
                    value={newAction.source_url}
                    onChange={(e) => setNewAction({ ...newAction, source_url: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="action_date">Action Date</Label>
                  <Input
                    id="action_date"
                    type="date"
                    value={newAction.action_date}
                    onChange={(e) => setNewAction({ ...newAction, action_date: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={addManualAction} disabled={!newAction.title || !newAction.state_code}>
                  Add Action
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={syncActions} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search actions, officials, organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {states.map(state => (
              <SelectItem key={state} value={state}>{state}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={threatFilter} onValueChange={setThreatFilter}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="Threat" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Actions List */}
      {filteredActions.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p className="text-muted-foreground">No state actions found</p>
          <p className="text-sm text-muted-foreground mt-2">
            Use "Add Manual" to track actions like the Abbott/CAIR designation
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredActions.map((action) => (
            <Card key={action.id} className={`${
              action.threat_level === 'critical' ? 'border-red-300 bg-red-50/30' :
              action.threat_level === 'high' ? 'border-orange-300 bg-orange-50/30' : ''
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge className={threatLevelColors[action.threat_level]}>
                        {action.threat_level.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        <MapPin className="h-3 w-3 mr-1" />
                        {action.state_code}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {actionTypeLabels[action.action_type] || action.action_type}
                      </Badge>
                    </div>
                    <CardTitle className="text-base line-clamp-2">
                      {action.title}
                    </CardTitle>
                    {action.official_name && (
                      <CardDescription className="mt-1">
                        {action.official_title} {action.official_name}
                      </CardDescription>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {action.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-3">
                    {action.description}
                  </p>
                )}

                {/* Affected Organizations */}
                {action.affected_organizations?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {action.affected_organizations.map((org) => (
                      <Badge key={org} variant="destructive" className="text-xs">
                        {org}
                      </Badge>
                    ))}
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {action.action_date && format(new Date(action.action_date), 'MMM d, yyyy')}
                  </span>
                  {action.source_url && (
                    <a
                      href={action.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-primary hover:underline"
                    >
                      Source <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
