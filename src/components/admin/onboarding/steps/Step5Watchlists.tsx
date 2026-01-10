import { useState, useEffect } from 'react';
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
  FileText,
  Search
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

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (entities.length > 0) return;
      
      setIsSuggestingEntities(true);
      try {
        const { data: profile } = await supabase
          .from('organization_profiles')
          .select('focus_areas, interest_topics, key_issues')
          .eq('organization_id', organizationId)
          .maybeSingle();

        const suggestions: WatchlistEntity[] = [];
        
        suggestions.push({ name: 'Healthcare Policy', entity_type: 'topic', is_ai_suggested: true });
        suggestions.push({ name: 'Immigration Reform', entity_type: 'topic', is_ai_suggested: true });
        
        if (profile) {
          const focusAreas = (profile.focus_areas || []) as string[];
          const interestTopics = (profile.interest_topics || []) as string[];
          [...focusAreas, ...interestTopics].slice(0, 3).forEach((area: string) => {
            if (area && !suggestions.some(s => s.name === area)) {
              suggestions.push({ name: area, entity_type: 'topic', is_ai_suggested: true });
            }
          });
        }

        if (suggestions.length > 0) {
          setEntities(suggestions);
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

      await supabase.rpc('log_admin_action', {
        _action_type: 'create_watchlist',
        _table_affected: 'entity_watchlist',
        _record_id: null,
        _old_value: null,
        _new_value: {
          organization_id: organizationId, 
          entities: entities.map(e => e.name),
          breaking_news: alertThresholds.breaking_news,
          sentiment_shift: alertThresholds.sentiment_shift,
          mention_spike: alertThresholds.mention_spike,
          threshold_value: alertThresholds.threshold_value
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
    <div className="space-y-6">
      {/* AI Suggestions Loading */}
      {isSuggestingEntities && (
        <div className="rounded-xl border border-[hsl(var(--portal-accent-purple))]/20 bg-[hsl(var(--portal-accent-purple))]/5 p-4">
          <div className="flex items-center gap-3">
            <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--portal-accent-purple))]" />
            <span className="text-[13px] text-[hsl(var(--portal-text-secondary))]">Generating suggestions based on organization profile...</span>
          </div>
        </div>
      )}

      {/* Add Entity Card */}
      <div className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] overflow-hidden">
        <div className="px-5 py-4 border-b border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-tertiary))]/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10 flex items-center justify-center">
              <Search className="w-[18px] h-[18px] text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div>
              <h3 className="text-[13px] font-semibold text-[hsl(var(--portal-text-primary))]">Add to Watchlist</h3>
              <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">Monitor politicians, organizations, topics, or keywords</p>
            </div>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="entity_name" className="text-[13px] font-medium text-[hsl(var(--portal-text-secondary))]">Entity Name</Label>
              <Input
                id="entity_name"
                placeholder="Enter name to watch"
                value={newEntity.name}
                onChange={e => setNewEntity({ ...newEntity, name: e.target.value })}
                className="h-11 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))] focus:border-[hsl(var(--portal-accent-blue))] focus:ring-1 focus:ring-[hsl(var(--portal-accent-blue))]/20 transition-colors placeholder:text-[hsl(var(--portal-text-muted))]/60"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[13px] font-medium text-[hsl(var(--portal-text-secondary))]">Type</Label>
              <Select
                value={newEntity.entity_type}
                onValueChange={(value: 'politician' | 'organization' | 'topic' | 'keyword') => 
                  setNewEntity({ ...newEntity, entity_type: value })
                }
              >
                <SelectTrigger className="h-11 bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))]">
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
          <Button onClick={addEntity} variant="outline" size="sm" className="h-9">
            <Plus className="h-4 w-4 mr-2" />
            Add to Watchlist
          </Button>
        </div>
      </div>

      {/* Entities List Card */}
      <div className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-tertiary))]/50">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-[hsl(var(--portal-text-primary))]">
              Watchlist Entities
            </span>
            {entities.length > 0 && (
              <Badge variant="secondary" className="text-[11px]">
                {entities.length} item{entities.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
        
        {entities.length > 0 ? (
          <div className="divide-y divide-[hsl(var(--portal-border))]">
            {entities.map(entity => {
              const Icon = getEntityIcon(entity.entity_type);
              return (
                <div key={entity.name} className="px-5 py-3 flex items-center justify-between hover:bg-[hsl(var(--portal-bg-hover))] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[hsl(var(--portal-bg-tertiary))] flex items-center justify-center">
                      <Icon className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[hsl(var(--portal-text-primary))]">{entity.name}</span>
                      {entity.is_ai_suggested && (
                        <Badge variant="secondary" className="text-[10px] bg-[hsl(var(--portal-accent-purple))]/10 text-[hsl(var(--portal-accent-purple))] border-0">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Suggested
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px] capitalize">
                      {entity.entity_type}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeEntity(entity.name)}
                      className="h-8 w-8 text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-error))]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl border-2 border-dashed border-[hsl(var(--portal-border))] flex items-center justify-center">
              <Eye className="h-5 w-5 text-[hsl(var(--portal-text-muted))]" />
            </div>
            <p className="text-[13px] font-medium text-[hsl(var(--portal-text-secondary))]">No entities in watchlist</p>
            <p className="text-[12px] text-[hsl(var(--portal-text-muted))] mt-1">Add entities to monitor for this organization</p>
          </div>
        )}
      </div>

      {/* Alert Configuration Card */}
      <Collapsible open={showAlertConfig} onOpenChange={setShowAlertConfig}>
        <div className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] overflow-hidden">
          <CollapsibleTrigger asChild>
            <div className="px-5 py-4 cursor-pointer hover:bg-[hsl(var(--portal-bg-hover))] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                    <Bell className="w-[18px] h-[18px] text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-[hsl(var(--portal-text-primary))]">Alert Configuration</h3>
                    <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">Customize when and how you receive alerts</p>
                  </div>
                </div>
                <ChevronDown className={`h-4 w-4 text-[hsl(var(--portal-text-muted))] transition-transform ${showAlertConfig ? 'rotate-180' : ''}`} />
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-5 pb-5 space-y-4 border-t border-[hsl(var(--portal-border))] pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-[13px] font-medium text-[hsl(var(--portal-text-primary))]">Breaking News Alerts</p>
                    <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">Get notified of breaking news mentioning watched entities</p>
                  </div>
                  <Switch
                    checked={alertThresholds.breaking_news}
                    onCheckedChange={(checked) => 
                      setAlertThresholds({ ...alertThresholds, breaking_news: checked })
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-[13px] font-medium text-[hsl(var(--portal-text-primary))]">Sentiment Shift Alerts</p>
                    <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">Alert when sentiment significantly changes</p>
                  </div>
                  <Switch
                    checked={alertThresholds.sentiment_shift}
                    onCheckedChange={(checked) => 
                      setAlertThresholds({ ...alertThresholds, sentiment_shift: checked })
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-[13px] font-medium text-[hsl(var(--portal-text-primary))]">Mention Spike Alerts</p>
                    <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">Alert when mentions exceed threshold</p>
                  </div>
                  <Switch
                    checked={alertThresholds.mention_spike}
                    onCheckedChange={(checked) => 
                      setAlertThresholds({ ...alertThresholds, mention_spike: checked })
                    }
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[13px] text-[hsl(var(--portal-text-secondary))]">Threshold Sensitivity</Label>
                    <span className="text-[13px] font-medium text-[hsl(var(--portal-text-primary))]">{alertThresholds.threshold_value}%</span>
                  </div>
                  <Slider
                    value={[alertThresholds.threshold_value]}
                    onValueChange={([value]) => 
                      setAlertThresholds({ ...alertThresholds, threshold_value: value })
                    }
                    min={10}
                    max={100}
                    step={10}
                    className="w-full"
                  />
                  <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">
                    Lower values = more sensitive (more alerts), higher = less sensitive
                  </p>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} className="h-10 px-5">
          Back
        </Button>
        <div className="flex gap-2">
          {entities.length === 0 && (
            <Button variant="ghost" onClick={() => onComplete(5, { entities: [], alert_thresholds: alertThresholds, skipped: true })} disabled={isLoading} className="h-10 px-5">
              Skip for now
            </Button>
          )}
          <Button onClick={handleSubmit} disabled={isLoading} className="h-10 px-5">
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : entities.length > 0 ? (
              'Save & Continue'
            ) : (
              'Continue'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
