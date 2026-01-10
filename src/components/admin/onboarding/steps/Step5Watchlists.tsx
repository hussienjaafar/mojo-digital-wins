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
import { Eye, Plus, Trash2, Sparkles, Bell, ChevronDown, Loader2, User, Building2, Hash, FileText, Settings } from 'lucide-react';

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
  
  const [entities, setEntities] = useState<WatchlistEntity[]>((stepData.entities as WatchlistEntity[]) || []);
  const [alertThresholds, setAlertThresholds] = useState<AlertThresholds>(
    (stepData.alert_thresholds as AlertThresholds) || { breaking_news: true, sentiment_shift: true, mention_spike: true, threshold_value: 50 }
  );
  const [newEntity, setNewEntity] = useState<WatchlistEntity>({ name: '', entity_type: 'politician', is_ai_suggested: false });

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (entities.length > 0) return;
      setIsSuggestingEntities(true);
      try {
        const { data: profile } = await supabase
          .from('organization_profiles')
          .select('focus_areas, interest_topics')
          .eq('organization_id', organizationId)
          .maybeSingle();

        const suggestions: WatchlistEntity[] = [
          { name: 'Healthcare Policy', entity_type: 'topic', is_ai_suggested: true },
          { name: 'Immigration Reform', entity_type: 'topic', is_ai_suggested: true },
        ];
        
        if (profile) {
          const areas = [...(profile.focus_areas || []), ...(profile.interest_topics || [])];
          areas.slice(0, 3).forEach((area: string) => {
            if (area && !suggestions.some(s => s.name === area)) {
              suggestions.push({ name: area, entity_type: 'topic', is_ai_suggested: true });
            }
          });
        }
        if (suggestions.length > 0) setEntities(suggestions);
      } finally {
        setIsSuggestingEntities(false);
      }
    };
    fetchSuggestions();
  }, [organizationId]);

  const addEntity = () => {
    if (!newEntity.name.trim()) return toast({ title: 'Name required', variant: 'destructive' });
    if (entities.some(e => e.name.toLowerCase() === newEntity.name.toLowerCase())) return toast({ title: 'Already exists', variant: 'destructive' });
    setEntities([...entities, { ...newEntity, is_ai_suggested: false }]);
    setNewEntity({ name: '', entity_type: 'politician', is_ai_suggested: false });
  };

  const removeEntity = (name: string) => setEntities(entities.filter(e => e.name !== name));
  const getEntityIcon = (type: string) => ({ politician: User, organization: Building2, topic: FileText, keyword: Hash }[type] || FileText);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      for (const entity of entities) {
        await supabase.from('entity_watchlist').upsert({
          organization_id: organizationId, entity_name: entity.name, entity_type: entity.entity_type, is_active: true, alert_threshold: alertThresholds.threshold_value
        }, { onConflict: 'organization_id,entity_name' });
      }
      toast({ title: 'Watchlist saved', description: `Added ${entities.length} entities` });
      await onComplete(5, { entities, alert_thresholds: alertThresholds });
    } catch (error) {
      toast({ title: 'Error saving watchlist', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {isSuggestingEntities && (
        <div className="flex items-center gap-2 text-sm text-[hsl(var(--portal-text-muted))]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Generating suggestions...
        </div>
      )}

      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10">
            <Eye className="w-4 h-4 text-[hsl(var(--portal-accent-blue))]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[hsl(var(--portal-text-primary))]">Watchlist Entities</h3>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">Add politicians, organizations, topics to monitor</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2 space-y-2">
            <Label className="text-sm">Entity Name</Label>
            <Input placeholder="Enter name" value={newEntity.name} onChange={e => setNewEntity({ ...newEntity, name: e.target.value })} className="h-10 bg-[hsl(var(--portal-bg-secondary))]" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Type</Label>
            <Select value={newEntity.entity_type} onValueChange={(v: any) => setNewEntity({ ...newEntity, entity_type: v })}>
              <SelectTrigger className="h-10 bg-[hsl(var(--portal-bg-secondary))]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="politician">Politician</SelectItem>
                <SelectItem value="organization">Organization</SelectItem>
                <SelectItem value="topic">Topic</SelectItem>
                <SelectItem value="keyword">Keyword</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={addEntity} variant="outline" size="sm"><Plus className="h-4 w-4 mr-2" />Add</Button>
      </section>

      {entities.length > 0 ? (
        <div className="rounded-lg border border-[hsl(var(--portal-border))] overflow-hidden">
          <div className="p-3 border-b border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]/50">
            <span className="text-sm font-medium">Entities ({entities.length})</span>
          </div>
          <div className="divide-y divide-[hsl(var(--portal-border))]">
            {entities.map(entity => {
              const Icon = getEntityIcon(entity.entity_type);
              return (
                <div key={entity.name} className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                    <span className="text-sm">{entity.name}</span>
                    {entity.is_ai_suggested && <Badge variant="secondary" className="text-xs"><Sparkles className="h-3 w-3 mr-1" />Suggested</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{entity.entity_type}</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeEntity(entity.name)}><Trash2 className="h-4 w-4 text-[hsl(var(--portal-error))]" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : !isSuggestingEntities && (
        <div className="text-center py-12 rounded-lg border border-dashed border-[hsl(var(--portal-border))]">
          <Eye className="h-8 w-8 mx-auto mb-3 text-[hsl(var(--portal-text-muted))]/50" />
          <p className="text-sm text-[hsl(var(--portal-text-secondary))]">No entities in watchlist</p>
        </div>
      )}

      <Collapsible open={showAlertConfig} onOpenChange={setShowAlertConfig}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-10">
            <span className="flex items-center gap-2"><Settings className="h-4 w-4" />Alert Settings</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${showAlertConfig ? 'rotate-180' : ''}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <div className="space-y-4 p-4 rounded-lg border border-[hsl(var(--portal-border))]">
            {[{ key: 'breaking_news', label: 'Breaking News' }, { key: 'sentiment_shift', label: 'Sentiment Shifts' }, { key: 'mention_spike', label: 'Mention Spikes' }].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm">{label}</span>
                <Switch checked={alertThresholds[key as keyof AlertThresholds] as boolean} onCheckedChange={c => setAlertThresholds({ ...alertThresholds, [key]: c })} />
              </div>
            ))}
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span>Sensitivity</span><span>{alertThresholds.threshold_value}%</span></div>
              <Slider value={[alertThresholds.threshold_value]} onValueChange={([v]) => setAlertThresholds({ ...alertThresholds, threshold_value: v })} min={10} max={100} step={10} />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex justify-between pt-6 border-t border-[hsl(var(--portal-border))]">
        <Button variant="outline" onClick={onBack} className="h-10">Back</Button>
        <div className="flex gap-3">
          {entities.length === 0 && <Button variant="ghost" onClick={() => onComplete(5, { entities: [], alert_thresholds: alertThresholds, skipped: true })} className="h-10">Skip</Button>}
          <Button onClick={handleSubmit} disabled={isLoading} className="min-w-[140px] h-10">
            {isLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save & Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}
