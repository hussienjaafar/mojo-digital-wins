import { useState } from 'react';
import { 
  Settings, 
  Target, 
  MapPin, 
  Bell, 
  Bookmark,
  Shield,
  ChevronRight,
  Plus,
  X,
  Check,
  Edit2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface OrgPreferences {
  priorities: string[];
  geographies: string[];
  watchlistEntities: string[];
  alertThresholds: {
    breakingNews: boolean;
    highConfidence: number;
    velocitySpike: number;
  };
  sourceTrust: {
    preferNews: boolean;
    preferSocial: boolean;
  };
}

interface PersonalizationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preferences: OrgPreferences;
  onPreferencesChange: (preferences: OrgPreferences) => void;
  orgName?: string;
}

const DEFAULT_PRIORITIES = [
  'Healthcare Policy',
  'Climate Action',
  'Immigration Reform',
  'Civil Rights',
  'Education Funding',
  'Economic Policy',
  'Foreign Affairs',
  'Election Integrity',
];

const DEFAULT_GEOGRAPHIES = [
  'Federal',
  'California',
  'Texas',
  'New York',
  'Florida',
  'Pennsylvania',
  'Georgia',
  'Arizona',
];

function TagInput({
  label,
  tags,
  onAddTag,
  onRemoveTag,
  suggestions,
  icon: Icon,
}: {
  label: string;
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  suggestions: string[];
  icon: typeof Target;
}) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const availableSuggestions = suggestions.filter(s => !tags.includes(s));

  const handleAddTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      onAddTag(tag);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">{label}</Label>
      </div>
      
      {/* Current tags */}
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <Badge key={tag} variant="secondary" className="gap-1 py-1 px-2">
            {tag}
            <button
              onClick={() => onRemoveTag(tag)}
              className="ml-1 hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        
        {/* Add new */}
        <div className="relative">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && inputValue) {
                e.preventDefault();
                handleAddTag(inputValue);
              }
            }}
            placeholder="Add..."
            className="h-7 w-28 text-xs"
          />
          
          {showSuggestions && availableSuggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-48 max-h-40 overflow-auto rounded-md border bg-popover p-1 shadow-md z-50">
              {availableSuggestions.slice(0, 5).map(suggestion => (
                <button
                  key={suggestion}
                  onClick={() => handleAddTag(suggestion)}
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-muted transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PersonalizationPanel({
  open,
  onOpenChange,
  preferences,
  onPreferencesChange,
  orgName = 'Your Organization',
}: PersonalizationPanelProps) {
  const updatePreferences = (partial: Partial<OrgPreferences>) => {
    onPreferencesChange({ ...preferences, ...partial });
  };

  const updateAlertThresholds = (partial: Partial<OrgPreferences['alertThresholds']>) => {
    updatePreferences({
      alertThresholds: { ...preferences.alertThresholds, ...partial },
    });
  };

  const updateSourceTrust = (partial: Partial<OrgPreferences['sourceTrust']>) => {
    updatePreferences({
      sourceTrust: { ...preferences.sourceTrust, ...partial },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md p-0">
        <SheetHeader className="px-6 py-5 border-b">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
              <Settings className="h-5 w-5 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-lg">Personalization</SheetTitle>
              <SheetDescription className="text-xs">
                Configure {orgName}'s intelligence preferences
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)]">
          <div className="px-6 py-5 space-y-6">
            {/* Issue Priorities */}
            <TagInput
              label="Issue Priorities"
              tags={preferences.priorities}
              onAddTag={(tag) => updatePreferences({ priorities: [...preferences.priorities, tag] })}
              onRemoveTag={(tag) => updatePreferences({ priorities: preferences.priorities.filter(t => t !== tag) })}
              suggestions={DEFAULT_PRIORITIES}
              icon={Target}
            />

            <Separator />

            {/* Geographies */}
            <TagInput
              label="Geographic Focus"
              tags={preferences.geographies}
              onAddTag={(tag) => updatePreferences({ geographies: [...preferences.geographies, tag] })}
              onRemoveTag={(tag) => updatePreferences({ geographies: preferences.geographies.filter(t => t !== tag) })}
              suggestions={DEFAULT_GEOGRAPHIES}
              icon={MapPin}
            />

            <Separator />

            {/* Watchlist Entities */}
            <TagInput
              label="Watchlist Entities"
              tags={preferences.watchlistEntities}
              onAddTag={(tag) => updatePreferences({ watchlistEntities: [...preferences.watchlistEntities, tag] })}
              onRemoveTag={(tag) => updatePreferences({ watchlistEntities: preferences.watchlistEntities.filter(t => t !== tag) })}
              suggestions={[]}
              icon={Bookmark}
            />

            <Separator />

            {/* Alert Thresholds */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Alert Thresholds</Label>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Breaking News Alerts</Label>
                    <p className="text-xs text-muted-foreground">Get notified for breaking developments</p>
                  </div>
                  <Switch
                    checked={preferences.alertThresholds.breakingNews}
                    onCheckedChange={(checked) => updateAlertThresholds({ breakingNews: checked })}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Confidence Threshold</Label>
                    <span className="text-sm font-medium">{preferences.alertThresholds.highConfidence}%</span>
                  </div>
                  <Slider
                    value={[preferences.alertThresholds.highConfidence]}
                    onValueChange={([value]) => updateAlertThresholds({ highConfidence: value })}
                    min={50}
                    max={95}
                    step={5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Only alert for trends above this confidence level
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Velocity Spike Threshold</Label>
                    <span className="text-sm font-medium">{preferences.alertThresholds.velocitySpike}σ</span>
                  </div>
                  <Slider
                    value={[preferences.alertThresholds.velocitySpike]}
                    onValueChange={([value]) => updateAlertThresholds({ velocitySpike: value })}
                    min={1}
                    max={5}
                    step={0.5}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Alert when velocity exceeds this Z-score
                  </p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Source Trust */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Source Preferences</Label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Prefer News Sources</Label>
                    <p className="text-xs text-muted-foreground">Weight traditional media higher</p>
                  </div>
                  <Switch
                    checked={preferences.sourceTrust.preferNews}
                    onCheckedChange={(checked) => updateSourceTrust({ preferNews: checked })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm">Include Social Signals</Label>
                    <p className="text-xs text-muted-foreground">Factor in social media velocity</p>
                  </div>
                  <Switch
                    checked={preferences.sourceTrust.preferSocial}
                    onCheckedChange={(checked) => updateSourceTrust({ preferSocial: checked })}
                  />
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 px-6 py-4 border-t bg-background">
          <Button className="w-full" onClick={() => onOpenChange(false)}>
            <Check className="h-4 w-4 mr-2" />
            Save Preferences
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
