import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { V3Button } from '@/components/v3/V3Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Building2, Save, Loader2, ChevronDown, ChevronUp, Sparkles, X, Plus, Target } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { GeoLocationPicker } from '@/components/admin/onboarding/GeoLocationPicker';
import type { OrgProfileData, OrganizationType, GeoLevel, GeoLocation } from '@/components/admin/onboarding/types';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const POLICY_DOMAINS = [
  'Healthcare', 'Education', 'Environment', 'Labor & Workers Rights',
  'Civil Rights', 'Immigration', 'Economic Justice', 'Housing',
  'Criminal Justice', 'Voting Rights', 'Foreign Policy', 'Technology',
];

const ORG_TYPE_OPTIONS: { value: OrganizationType; label: string; category: string; defaultGeoLevel: GeoLevel }[] = [
  { value: 'campaign_federal', label: 'Federal Campaign (Congress/Senate/President)', category: 'Political Campaign', defaultGeoLevel: 'congressional_district' },
  { value: 'campaign_state', label: 'State Campaign (Governor/Legislature)', category: 'Political Campaign', defaultGeoLevel: 'state' },
  { value: 'campaign_local', label: 'Local Campaign (Mayor/Council/County/School Board)', category: 'Political Campaign', defaultGeoLevel: 'city' },
  { value: 'c3_national', label: 'National 501(c)(3) Nonprofit', category: '501(c)(3) Nonprofit', defaultGeoLevel: 'national' },
  { value: 'c3_state', label: 'State 501(c)(3) Nonprofit', category: '501(c)(3) Nonprofit', defaultGeoLevel: 'state' },
  { value: 'c3_local', label: 'Local 501(c)(3) Nonprofit', category: '501(c)(3) Nonprofit', defaultGeoLevel: 'city' },
  { value: 'c4_national', label: 'National 501(c)(4) Advocacy Org', category: '501(c)(4) Advocacy', defaultGeoLevel: 'national' },
  { value: 'c4_state', label: 'State 501(c)(4) Advocacy Org', category: '501(c)(4) Advocacy', defaultGeoLevel: 'state' },
  { value: 'c4_local', label: 'Local 501(c)(4) Advocacy Org', category: '501(c)(4) Advocacy', defaultGeoLevel: 'city' },
  { value: 'pac_federal', label: 'Federal PAC', category: 'PAC', defaultGeoLevel: 'national' },
  { value: 'pac_state', label: 'State PAC', category: 'PAC', defaultGeoLevel: 'state' },
  { value: 'international', label: 'International Organization/NGO', category: 'International', defaultGeoLevel: 'international' },
  { value: 'other', label: 'Other', category: 'Other', defaultGeoLevel: 'national' },
];

const GEO_LEVEL_OPTIONS: { value: GeoLevel; label: string; description: string }[] = [
  { value: 'national', label: 'National (US-wide)', description: 'Operates across the entire United States' },
  { value: 'multi_state', label: 'Multi-State', description: 'Operates in multiple specific states' },
  { value: 'state', label: 'Single State', description: 'Focused on one state' },
  { value: 'congressional_district', label: 'Congressional District', description: 'Focused on US House district(s)' },
  { value: 'county', label: 'County', description: 'Focused on county-level' },
  { value: 'city', label: 'City/Municipal', description: 'Focused on a city or municipality' },
  { value: 'international', label: 'International', description: 'Operates outside the US or globally' },
];

interface OrganizationProfile {
  id: string;
  organization_id: string;
  organization_type: string | null;
  geo_level: string | null;
  geo_locations: any[];
  mission_statement: string | null;
  focus_areas: string[];
  policy_domains: string[];
  sentiment_sensitivity: string;
  risk_tolerance: string;
}

interface OrganizationProfileFormProps {
  organizationId: string;
  profile: OrganizationProfile | null;
  websiteUrl?: string | null;
  onSave: (data: Partial<OrgProfileData>) => Promise<void>;
}

export function OrganizationProfileForm({ organizationId, profile, websiteUrl, onSave }: OrganizationProfileFormProps) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [customFocusArea, setCustomFocusArea] = useState('');
  
  const [formData, setFormData] = useState<OrgProfileData>({
    mission_statement: profile?.mission_statement || '',
    focus_areas: profile?.focus_areas || [],
    policy_domains: profile?.policy_domains || [],
    organization_type: (profile?.organization_type as OrganizationType) || 'c4_national',
    geo_level: (profile?.geo_level as GeoLevel) || 'national',
    geo_locations: profile?.geo_locations || [],
    sentiment_sensitivity: (profile?.sentiment_sensitivity as 'low' | 'medium' | 'high') || 'medium',
    risk_tolerance: (profile?.risk_tolerance as 'low' | 'medium' | 'high') || 'medium',
  });

  const [hasChanges, setHasChanges] = useState(false);

  // Track changes
  useEffect(() => {
    const originalMission = profile?.mission_statement || '';
    const originalType = profile?.organization_type || 'c4_national';
    const originalGeoLevel = profile?.geo_level || 'national';
    
    const changed = 
      formData.mission_statement !== originalMission ||
      formData.organization_type !== originalType ||
      formData.geo_level !== originalGeoLevel ||
      JSON.stringify(formData.focus_areas) !== JSON.stringify(profile?.focus_areas || []) ||
      JSON.stringify(formData.policy_domains) !== JSON.stringify(profile?.policy_domains || []) ||
      JSON.stringify(formData.geo_locations) !== JSON.stringify(profile?.geo_locations || []) ||
      formData.sentiment_sensitivity !== (profile?.sentiment_sensitivity || 'medium') ||
      formData.risk_tolerance !== (profile?.risk_tolerance || 'medium');
    
    setHasChanges(changed);
  }, [formData, profile]);

  const handleOrgTypeChange = (newType: OrganizationType) => {
    const orgOption = ORG_TYPE_OPTIONS.find(opt => opt.value === newType);
    setFormData(prev => ({
      ...prev,
      organization_type: newType,
      geo_level: orgOption?.defaultGeoLevel || prev.geo_level,
      geo_locations: [],
    }));
  };

  const handleGeoLevelChange = (newLevel: GeoLevel) => {
    setFormData(prev => ({
      ...prev,
      geo_level: newLevel,
      geo_locations: [],
    }));
  };

  const togglePolicyDomain = (domain: string) => {
    setFormData(prev => ({
      ...prev,
      policy_domains: prev.policy_domains.includes(domain)
        ? prev.policy_domains.filter(d => d !== domain)
        : [...prev.policy_domains, domain],
    }));
  };

  const addFocusArea = () => {
    if (customFocusArea.trim() && !formData.focus_areas.includes(customFocusArea.trim())) {
      setFormData(prev => ({
        ...prev,
        focus_areas: [...prev.focus_areas, customFocusArea.trim()],
      }));
      setCustomFocusArea('');
    }
  };

  const removeFocusArea = (area: string) => {
    setFormData(prev => ({
      ...prev,
      focus_areas: prev.focus_areas.filter(a => a !== area),
    }));
  };

  const handleScrapeWebsite = async () => {
    if (!websiteUrl) {
      toast({
        title: 'No Website URL',
        description: 'Please add a website URL in the Details tab first.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsScraping(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-organization-website', {
        body: { 
          organizationId,
          websiteUrl,
        },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      if (data?.profile) {
        const aiProfile = data.profile;
        const focusAreas = aiProfile.focus_areas || [];
        const keyIssues = aiProfile.key_issues || [];
        const aiExtractedAreas = [...new Set([...focusAreas, ...keyIssues])];
        
        setFormData(prev => ({
          ...prev,
          mission_statement: aiProfile.mission || prev.mission_statement,
          focus_areas: aiExtractedAreas.length > 0 ? aiExtractedAreas : prev.focus_areas,
        }));
        
        toast({
          title: 'Website Analyzed',
          description: `Found ${aiExtractedAreas.length} focus areas.`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Analysis Failed',
        description: error.message || 'Could not analyze website',
        variant: 'destructive',
      });
    } finally {
      setIsScraping(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setIsSaving(true);
    try {
      await onSave(formData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Organization Profile
        </CardTitle>
        <CardDescription>
          Mission, focus areas, and geographic scope
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Organization Type */}
          <div className="space-y-2">
            <Label>Organization Type</Label>
            <Select
              value={formData.organization_type}
              onValueChange={(v) => handleOrgTypeChange(v as OrganizationType)}
            >
              <SelectTrigger className="bg-[hsl(var(--portal-bg-secondary))]">
                <SelectValue placeholder="Select organization type" />
              </SelectTrigger>
              <SelectContent>
                {ORG_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.category}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Geographic Scope */}
          <div className="space-y-3">
            <Label>Geographic Scope</Label>
            <Select
              value={formData.geo_level}
              onValueChange={(v) => handleGeoLevelChange(v as GeoLevel)}
            >
              <SelectTrigger className="bg-[hsl(var(--portal-bg-secondary))]">
                <SelectValue placeholder="Select geographic level" />
              </SelectTrigger>
              <SelectContent>
                {GEO_LEVEL_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <GeoLocationPicker
              geoLevel={formData.geo_level}
              selectedLocations={formData.geo_locations}
              onChange={(locations) => setFormData(prev => ({ ...prev, geo_locations: locations }))}
            />
          </div>

          {/* Mission Statement */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="mission">Mission Statement</Label>
              {websiteUrl && (
                <V3Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleScrapeWebsite}
                  disabled={isScraping}
                >
                  {isScraping ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-1" />
                  )}
                  Extract from website
                </V3Button>
              )}
            </div>
            <Textarea
              id="mission"
              value={formData.mission_statement}
              onChange={(e) => setFormData(prev => ({ ...prev, mission_statement: e.target.value }))}
              placeholder="Describe the organization's mission and purpose..."
              rows={4}
              className="bg-[hsl(var(--portal-bg-secondary))]"
            />
          </div>

          {/* Focus Areas */}
          <div className="space-y-2">
            <Label>Focus Areas</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.focus_areas.map(area => (
                <Badge key={area} variant="default" className="gap-1">
                  {area}
                  <button
                    type="button"
                    onClick={() => removeFocusArea(area)}
                    className="ml-1 hover:bg-black/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={customFocusArea}
                onChange={(e) => setCustomFocusArea(e.target.value)}
                placeholder="Add a focus area..."
                className="bg-[hsl(var(--portal-bg-secondary))]"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addFocusArea();
                  }
                }}
              />
              <V3Button
                type="button"
                variant="secondary"
                onClick={addFocusArea}
                disabled={!customFocusArea.trim()}
              >
                <Plus className="w-4 h-4" />
              </V3Button>
            </div>
          </div>

          {/* Policy Domains */}
          <div className="space-y-2">
            <Label>Policy Domains</Label>
            <div className="flex flex-wrap gap-2">
              {POLICY_DOMAINS.map(domain => (
                <Badge
                  key={domain}
                  variant={formData.policy_domains.includes(domain) ? 'default' : 'outline'}
                  className="cursor-pointer transition-all hover:opacity-80"
                  onClick={() => togglePolicyDomain(domain)}
                >
                  {domain}
                </Badge>
              ))}
            </div>
          </div>

          {/* Advanced Settings */}
          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleTrigger asChild>
              <V3Button type="button" variant="ghost" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Advanced Settings
                </span>
                {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </V3Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Sentiment Sensitivity</Label>
                  <Select
                    value={formData.sentiment_sensitivity}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, sentiment_sensitivity: v as 'low' | 'medium' | 'high' }))}
                  >
                    <SelectTrigger className="bg-[hsl(var(--portal-bg-secondary))]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Only major sentiment shifts</SelectItem>
                      <SelectItem value="medium">Medium - Moderate changes</SelectItem>
                      <SelectItem value="high">High - All sentiment changes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Risk Tolerance</Label>
                  <Select
                    value={formData.risk_tolerance}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, risk_tolerance: v as 'low' | 'medium' | 'high' }))}
                  >
                    <SelectTrigger className="bg-[hsl(var(--portal-bg-secondary))]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Alert on all risks</SelectItem>
                      <SelectItem value="medium">Medium - Moderate risks</SelectItem>
                      <SelectItem value="high">High - Only critical risks</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center justify-between pt-4 border-t border-[hsl(var(--portal-border))]">
            <div>
              {hasChanges && (
                <Badge variant="outline" className="text-[hsl(var(--portal-warning))]">
                  Unsaved changes
                </Badge>
              )}
            </div>
            <V3Button
              type="submit"
              disabled={isSaving || !hasChanges}
              isLoading={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Profile
            </V3Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
