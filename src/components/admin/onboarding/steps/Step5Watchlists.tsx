import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { WatchlistEntity, AlertThresholds, WizardStep } from '../types';
import { 
  Eye, 
  Plus, 
  Trash2, 
  Sparkles, 
  Bell,
  ChevronDown,
  Loader2,
  User,
  Building2,
  Hash,
  FileText
} from 'lucide-react';

interface Step5WatchlistsProps {
  organizationId: string;
  stepData: Record<string, unknown>;
  onComplete: (step: WizardStep, data: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}

export function Step5Watchlists({ organizationId, stepData, onComplete, onBack }: Step5WatchlistsProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggestingEntities, setIsSuggestingEntities] = useState(false);
  const [showAlertConfig, setShowAlertConfig] = useState(false);
  
  const [entities, setEntities] = useState<WatchlistEntity[]>(
    (stepData.entities as WatchlistEntity[]) || []
  );
  
  const [alertThresholds, setAlertThresholds] = useState<AlertThresholds>(
    (stepData.alert_thresholds as AlertThresholds) || {
      breaking_news: true,
      sentiment_shift: true,
      mention_spike: true,
      threshold_value: 50
    }
  );
  
  const [newEntity, setNewEntity] = useState<WatchlistEntity>({
    name: '',
    entity_type: 'politician',
    is_ai_suggested: false
  });

  // Fetch AI-suggested entities based on org profile
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (entities.length > 0) return; // Skip if already has entities
      
      setIsSuggestingEntities(true);
      try {
        // Get org profile to inform suggestions
        const { data: profile } = await supabase
          .from('organization_profiles')
          .select('focus_areas, target_states')
          .eq('organization_id', organizationId)
          .maybeSingle();

        if (profile) {
          // Generate suggestions based on profile
          const suggestions: WatchlistEntity[] = [];
          const focusAreas = profile.focus_areas as string[] | null;
          
          // Add default suggestions
          suggestions.push({ name: 'Healthcare Policy', entity_type: 'topic', is_ai_suggested: true });
          suggestions.push({ name: 'Immigration Reform', entity_type: 'topic', is_ai_suggested: true });
          
          // Add topics from focus areas
          focusAreas?.slice(0, 3).forEach((area: string) => {
            suggestions.push({ name: area, entity_type: 'topic', is_ai_suggested: true });
          });

          if (suggestions.length > 0) {
            setEntities(suggestions);
          }
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setIsSuggestingEntities(false);
      }
    };

    fetchSuggestions();
  }, [organizationId]);

  const addEntity = () => {
    if (!newEntity.name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for the watchlist entity.',
        variant: 'destructive'
      });
      return;
    }

    if (entities.some(e => e.name.toLowerCase() === newEntity.name.toLowerCase())) {
      toast({
        title: 'Duplicate entity',
        description: 'This entity is already in the watchlist.',
        variant: 'destructive'
      });
      return;
    }

    setEntities([...entities, { ...newEntity, is_ai_suggested: false }]);
    setNewEntity({ name: '', entity_type: 'politician', is_ai_suggested: false });
  };

  const removeEntity = (name: string) => {
    setEntities(entities.filter(e => e.name !== name));
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'politician': return User;
      case 'organization': return Building2;
      case 'topic': return FileText;
      case 'keyword': return Hash;
      default: return FileText;
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      // Save watchlist entities
      for (const entity of entities) {
        await supabase
          .from('entity_watchlist')
          .upsert({
            organization_id: organizationId,
            entity_name: entity.name,
            entity_type: entity.entity_type,
            is_active: true,
            alert_threshold: alertThresholds.threshold_value
          }, {
            onConflict: 'organization_id,entity_name'
          });
      }

      // Log audit action
      await supabase.rpc('log_admin_action', {
        _action_type: 'create_watchlist',
        _table_affected: 'entity_watchlist',
        _record_id: null,
        _old_value: null,
        _new_value: {
          organization_id: organizationId, 
          entities: entities.map(e => e.name),
          alert_thresholds: alertThresholds
        }
      });

      toast({
        title: 'Watchlist configured',
        description: `Added ${entities.length} entities to watchlist.`
      });

      await onComplete(5, { entities, alert_thresholds: alertThresholds });
    } catch (error) {
      console.error('Error saving watchlist:', error);
      toast({
        title: 'Error',
        description: 'Failed to save watchlist. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Configure Watchlists & Alerts
        </CardTitle>
        <CardDescription>
          Set up entities to monitor and configure alert thresholds.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI Suggestions Loading */}
        {isSuggestingEntities && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Generating suggestions based on organization profile...</span>
          </div>
        )}

        {/* Add Entity */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="entity_name">Entity Name</Label>
              <Input
                id="entity_name"
                placeholder="Enter name to watch"
                value={newEntity.name}
                onChange={e => setNewEntity({ ...newEntity, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={newEntity.entity_type}
                onValueChange={(value: 'politician' | 'organization' | 'topic' | 'keyword') => 
                  setNewEntity({ ...newEntity, entity_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="politician">Politician</SelectItem>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="topic">Topic</SelectItem>
                  <SelectItem value="keyword">Keyword</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={addEntity} variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add to Watchlist
          </Button>
        </div>

        {/* Entities List */}
        {entities.length > 0 && (
          <div className="border rounded-lg">
            <div className="p-3 border-b bg-muted/50">
              <span className="text-sm font-medium">
                Watchlist Entities ({entities.length})
              </span>
            </div>
            <div className="divide-y">
              {entities.map(entity => {
                const Icon = getEntityIcon(entity.entity_type);
                return (
                  <div key={entity.name} className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{entity.name}</span>
                        {entity.is_ai_suggested && (
                          <Badge variant="secondary" className="text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            Suggested
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {entity.entity_type}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeEntity(entity.name)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {entities.length === 0 && !isSuggestingEntities && (
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No entities in watchlist</p>
            <p className="text-sm">Add entities to monitor for this organization</p>
          </div>
        )}

        {/* Alert Configuration */}
        <Collapsible open={showAlertConfig} onOpenChange={setShowAlertConfig}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Alert Configuration
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showAlertConfig ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-4 pt-4">
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Breaking News Alerts</p>
                  <p className="text-xs text-muted-foreground">Get notified of breaking news mentioning watched entities</p>
                </div>
                <Switch
                  checked={alertThresholds.breaking_news}
                  onCheckedChange={(checked) => 
                    setAlertThresholds({ ...alertThresholds, breaking_news: checked })
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Sentiment Shift Alerts</p>
                  <p className="text-xs text-muted-foreground">Alert when sentiment significantly changes</p>
                </div>
                <Switch
                  checked={alertThresholds.sentiment_shift}
                  onCheckedChange={(checked) => 
                    setAlertThresholds({ ...alertThresholds, sentiment_shift: checked })
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Mention Spike Alerts</p>
                  <p className="text-xs text-muted-foreground">Alert when mentions exceed threshold</p>
                </div>
                <Switch
                  checked={alertThresholds.mention_spike}
                  onCheckedChange={(checked) => 
                    setAlertThresholds({ ...alertThresholds, mention_spike: checked })
                  }
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Threshold Sensitivity</Label>
                  <span className="text-sm text-muted-foreground">{alertThresholds.threshold_value}%</span>
                </div>
                <Slider
                  value={[alertThresholds.threshold_value]}
                  onValueChange={([value]) => 
                    setAlertThresholds({ ...alertThresholds, threshold_value: value })
                  }
                  min={10}
                  max={100}
                  step={10}
                />
                <p className="text-xs text-muted-foreground">
                  Lower values = more sensitive (more alerts), higher = less sensitive
                </p>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save & Continue'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
