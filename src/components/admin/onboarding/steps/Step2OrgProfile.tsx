import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { V3Button } from '@/components/v3/V3Button';
// Card removed - using integrated layout
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, MapPin, Loader2, Sparkles, ChevronDown, ChevronUp, CheckCircle2, XCircle, Plus, X, Building2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GeoLocationPicker } from '../GeoLocationPicker';
import type { OrgProfileData, OrganizationType, GeoLevel, GeoLocation } from '../types';

const POLICY_DOMAINS = [
  'Healthcare', 'Education', 'Environment', 'Labor & Workers Rights',
  'Civil Rights', 'Immigration', 'Economic Justice', 'Housing',
  'Criminal Justice', 'Voting Rights', 'Foreign Policy', 'Technology',
];

// Organization type options with labels and implied geo levels
const ORG_TYPE_OPTIONS: { value: OrganizationType; label: string; category: string; defaultGeoLevel: GeoLevel }[] = [
  // Campaigns
  { value: 'campaign_federal', label: 'Federal Campaign (Congress/Senate/President)', category: 'Political Campaign', defaultGeoLevel: 'congressional_district' },
  { value: 'campaign_state', label: 'State Campaign (Governor/Legislature)', category: 'Political Campaign', defaultGeoLevel: 'state' },
  { value: 'campaign_local', label: 'Local Campaign (Mayor/Council/County/School Board)', category: 'Political Campaign', defaultGeoLevel: 'city' },
  // C3s
  { value: 'c3_national', label: 'National 501(c)(3) Nonprofit', category: '501(c)(3) Nonprofit', defaultGeoLevel: 'national' },
  { value: 'c3_state', label: 'State 501(c)(3) Nonprofit', category: '501(c)(3) Nonprofit', defaultGeoLevel: 'state' },
  { value: 'c3_local', label: 'Local 501(c)(3) Nonprofit', category: '501(c)(3) Nonprofit', defaultGeoLevel: 'city' },
  // C4s
  { value: 'c4_national', label: 'National 501(c)(4) Advocacy Org', category: '501(c)(4) Advocacy', defaultGeoLevel: 'national' },
  { value: 'c4_state', label: 'State 501(c)(4) Advocacy Org', category: '501(c)(4) Advocacy', defaultGeoLevel: 'state' },
  { value: 'c4_local', label: 'Local 501(c)(4) Advocacy Org', category: '501(c)(4) Advocacy', defaultGeoLevel: 'city' },
  // PACs
  { value: 'pac_federal', label: 'Federal PAC', category: 'PAC', defaultGeoLevel: 'national' },
  { value: 'pac_state', label: 'State PAC', category: 'PAC', defaultGeoLevel: 'state' },
  // International
  { value: 'international', label: 'International Organization/NGO', category: 'International', defaultGeoLevel: 'international' },
  // Other
  { value: 'other', label: 'Other', category: 'Other', defaultGeoLevel: 'national' },
];

// Geo level options with labels
const GEO_LEVEL_OPTIONS: { value: GeoLevel; label: string; description: string }[] = [
  { value: 'national', label: 'National (US-wide)', description: 'Operates across the entire United States' },
  { value: 'multi_state', label: 'Multi-State', description: 'Operates in multiple specific states' },
  { value: 'state', label: 'Single State', description: 'Focused on one state' },
  { value: 'congressional_district', label: 'Congressional District', description: 'Focused on US House district(s)' },
  { value: 'county', label: 'County', description: 'Focused on county-level' },
  { value: 'city', label: 'City/Municipal', description: 'Focused on a city or municipality' },
  { value: 'international', label: 'International', description: 'Operates outside the US or globally' },
];

interface Step2OrgProfileProps {
  organizationId: string;
  websiteUrl?: string;
  initialData?: Partial<OrgProfileData>;
  onComplete: (data: OrgProfileData) => void;
  onBack: () => void;
}

export function Step2OrgProfile({ 
  organizationId, 
  websiteUrl,
  initialData, 
  onComplete, 
  onBack 
}: Step2OrgProfileProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [scrapeMessage, setScrapeMessage] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [extractedFocusAreas, setExtractedFocusAreas] = useState<string[]>([]);
  const [customFocusArea, setCustomFocusArea] = useState('');
  const [formData, setFormData] = useState<OrgProfileData>({
    mission_statement: initialData?.mission_statement || '',
    focus_areas: initialData?.focus_areas || [],
    policy_domains: initialData?.policy_domains || [],
    organization_type: initialData?.organization_type || 'c4_national',
    geo_level: initialData?.geo_level || 'national',
    geo_locations: initialData?.geo_locations || [],
    sentiment_sensitivity: initialData?.sentiment_sensitivity || 'medium',
    risk_tolerance: initialData?.risk_tolerance || 'medium',
  });

  // Update geo level when org type changes
  const handleOrgTypeChange = (newType: OrganizationType) => {
    const orgOption = ORG_TYPE_OPTIONS.find(opt => opt.value === newType);
    setFormData(prev => ({
      ...prev,
      organization_type: newType,
      geo_level: orgOption?.defaultGeoLevel || prev.geo_level,
      geo_locations: [], // Reset locations when changing type
    }));
  };

  const handleGeoLevelChange = (newLevel: GeoLevel) => {
    setFormData(prev => ({
      ...prev,
      geo_level: newLevel,
      geo_locations: [], // Reset locations when changing level
    }));
  };

  // Auto-scrape website on mount if URL provided
  useEffect(() => {
    if (websiteUrl && !formData.mission_statement) {
      handleScrapeWebsite();
    }
  }, [websiteUrl]);

  const handleScrapeWebsite = async () => {
    if (!websiteUrl) return;
    
    setIsScraping(true);
    setScrapeStatus('idle');
    setScrapeMessage('');
    
    try {
      const { data, error } = await supabase.functions.invoke('scrape-organization-website', {
        body: { 
          organizationId: organizationId,
          websiteUrl: websiteUrl,
        },
      });

      if (error) throw error;
      
      if (data?.error) {
        throw new Error(data.error);
      }

      // Map edge function response fields to form fields
      if (data?.profile) {
        const profile = data.profile;
        const focusAreas = profile.focus_areas || [];
        const keyIssues = profile.key_issues || [];
        
        console.log('[Step2OrgProfile] AI Response:', { 
          mission: profile.mission?.substring(0, 50),
          focus_areas: focusAreas,
          key_issues: keyIssues
        });
        
        // Combine and dedupe all extracted areas
        const aiExtractedAreas = [...new Set([...focusAreas, ...keyIssues])];
        
        console.log('[Step2OrgProfile] Combined areas:', aiExtractedAreas);
        
        // Store extracted areas for display
        setExtractedFocusAreas(aiExtractedAreas);
        
        // Auto-select all extracted areas
        setFormData(prev => ({
          ...prev,
          mission_statement: profile.mission || prev.mission_statement,
          focus_areas: aiExtractedAreas, // Replace with all extracted
        }));
        
        setScrapeStatus('success');
        setScrapeMessage(`Extracted mission and ${aiExtractedAreas.length} focus areas`);
        
        toast({
          title: 'Website Analyzed',
          description: `Found ${aiExtractedAreas.length} focus areas. Review and adjust below.`,
        });
      } else {
        throw new Error('No profile data returned');
      }
    } catch (err: any) {
      console.error('[Step2OrgProfile] Scrape error:', err);
      setScrapeStatus('error');
      setScrapeMessage(err.message || 'Could not analyze website');
      
      toast({
        title: 'Scrape Failed',
        description: 'Could not analyze website. Please fill in details manually.',
        variant: 'destructive',
      });
    } finally {
      setIsScraping(false);
    }
  };

  const toggleFocusArea = (area: string) => {
    setFormData(prev => ({
      ...prev,
      focus_areas: prev.focus_areas.includes(area)
        ? prev.focus_areas.filter(a => a !== area)
        : [...prev.focus_areas, area],
    }));
  };

  const addCustomFocusArea = () => {
    const trimmed = customFocusArea.trim();
    if (trimmed && !formData.focus_areas.includes(trimmed)) {
      setFormData(prev => ({
        ...prev,
        focus_areas: [...prev.focus_areas, trimmed],
      }));
      setCustomFocusArea('');
    }
  };

  const removeFocusArea = (area: string) => {
    setFormData(prev => ({
      ...prev,
      focus_areas: prev.focus_areas.filter(a => a !== area),
    }));
    // Also remove from extracted if present
    setExtractedFocusAreas(prev => prev.filter(a => a !== area));
  };

  const toggleDomain = (domain: string) => {
    setFormData(prev => ({
      ...prev,
      policy_domains: prev.policy_domains.includes(domain)
        ? prev.policy_domains.filter(d => d !== domain)
        : [...prev.policy_domains, domain],
    }));
  };

  // Legacy function removed - now using geo_locations

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Build geographies array from new geo_locations
      const geographies = formData.geo_locations.map(loc => loc.value);
      if (geographies.length === 0 && formData.geo_level === 'national') {
        geographies.push('US');
      }

      // Upsert organization profile - map to actual DB columns
      const { error: profileError } = await supabase
        .from('organization_profiles')
        .upsert({
          organization_id: organizationId,
          mission_summary: formData.mission_statement,
          focus_areas: formData.focus_areas,
          interest_topics: formData.policy_domains,
          geographies: geographies,
          org_type: formData.organization_type,
          sensitivity_redlines: {
            sentiment_sensitivity: formData.sentiment_sensitivity,
            risk_tolerance: formData.risk_tolerance,
            geo_level: formData.geo_level,
          },
        }, {
          onConflict: 'organization_id',
        });

      if (profileError) throw profileError;

      // Log audit action
      await supabase.rpc('log_admin_action', {
        _action_type: 'update_organization_profile',
        _table_affected: 'organization_profiles',
        _record_id: organizationId,
        _new_value: JSON.parse(JSON.stringify(formData)),
      });

      toast({
        title: 'Profile Saved',
        description: 'Organization profile has been updated',
      });

      onComplete(formData);
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to save profile',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* AI Scrape Banner */}
      {websiteUrl && (
        <div className={`rounded-lg border p-4 ${
          scrapeStatus === 'success' ? 'bg-green-500/5 border-green-500/30' :
          scrapeStatus === 'error' ? 'bg-destructive/5 border-destructive/30' :
          'bg-[hsl(var(--portal-accent-purple))]/5 border-[hsl(var(--portal-accent-purple))]/30'
        }`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {scrapeStatus === 'success' ? (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              ) : scrapeStatus === 'error' ? (
                <XCircle className="w-5 h-5 text-destructive" />
              ) : (
                <Sparkles className="w-5 h-5 text-[hsl(var(--portal-accent-purple))]" />
              )}
              <div>
                <p className="text-sm font-medium">
                  {scrapeStatus === 'success' ? 'Profile Extracted Successfully' :
                   scrapeStatus === 'error' ? 'Extraction Failed' :
                   'AI-Powered Profile Extraction'}
                </p>
                <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                  {scrapeMessage || 'Extract mission & focus areas from website'}
                </p>
              </div>
            </div>
            <V3Button 
              type="button" 
              variant="secondary" 
              size="sm"
              onClick={handleScrapeWebsite}
              disabled={isScraping}
            >
              {isScraping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : scrapeStatus === 'error' ? (
                'Retry'
              ) : scrapeStatus === 'success' ? (
                'Re-analyze'
              ) : (
                'Analyze Website'
              )}
            </V3Button>
          </div>
        </div>
      )}

      {/* Mission & Focus */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-[hsl(var(--portal-border))]">
          <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10">
            <Target className="w-4 h-4 text-[hsl(var(--portal-accent-blue))]" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Mission & Focus Areas</h3>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">What does this organization care about?</p>
          </div>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mission">Mission Statement</Label>
            <Textarea
              id="mission"
              value={formData.mission_statement}
              onChange={(e) => setFormData(prev => ({ ...prev, mission_statement: e.target.value }))}
              placeholder="Describe the organization's mission and values..."
              rows={3}
              className="bg-[hsl(var(--portal-bg-secondary))]"
            />
          </div>

          {/* AI Extracted Focus Areas */}
          {(extractedFocusAreas.length > 0 || formData.focus_areas.length > 0) && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Focus Areas</Label>
                {extractedFocusAreas.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="w-3 h-3 mr-1" />
                    AI Extracted
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                {extractedFocusAreas.length > 0 
                  ? 'Click to select/deselect extracted areas, or add your own'
                  : 'Areas this organization focuses on'}
              </p>
              <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))]">
                {/* Show all unique areas: extracted + manually added */}
                {[...new Set([...extractedFocusAreas, ...formData.focus_areas])].map(area => {
                  const isSelected = formData.focus_areas.includes(area);
                  const isExtracted = extractedFocusAreas.includes(area);
                  return (
                    <Badge
                      key={area}
                      variant={isSelected ? 'default' : 'outline'}
                      className={`cursor-pointer transition-all hover:opacity-80 pr-1 ${
                        isExtracted && isSelected ? 'bg-[hsl(var(--portal-accent-purple))] hover:bg-[hsl(var(--portal-accent-purple))]/80' : ''
                      }`}
                      onClick={() => toggleFocusArea(area)}
                    >
                      {area}
                      {isSelected && (
                        <button
                          type="button"
                          className="ml-1 p-0.5 rounded-full hover:bg-black/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFocusArea(area);
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </Badge>
                  );
                })}
              </div>
              
              {/* Add custom focus area */}
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom focus area..."
                  value={customFocusArea}
                  onChange={(e) => setCustomFocusArea(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomFocusArea();
                    }
                  }}
                  className="bg-[hsl(var(--portal-bg-secondary))] flex-1"
                />
                <V3Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addCustomFocusArea}
                  disabled={!customFocusArea.trim()}
                >
                  <Plus className="w-4 h-4" />
                </V3Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Policy Domains</Label>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">
              Select all policy areas this organization works on
            </p>
            <div className="flex flex-wrap gap-2">
              {POLICY_DOMAINS.map(domain => (
                <Badge
                  key={domain}
                  variant={formData.policy_domains.includes(domain) ? 'default' : 'outline'}
                  className="cursor-pointer transition-all hover:opacity-80"
                  onClick={() => toggleDomain(domain)}
                >
                  {domain}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Organization Type & Geographic Focus */}
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-2 border-b border-[hsl(var(--portal-border))]">
          <div className="p-2 rounded-lg bg-green-500/10">
            <Building2 className="w-4 h-4 text-green-500" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">Organization Type & Geographic Focus</h3>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">Define the organization's structure and where it operates</p>
          </div>
        </div>
        <div className="space-y-6">
          {/* Step 1: Organization Type */}
          <div className="space-y-2">
            <Label>Organization Type</Label>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">
              Select the type of organization - this will suggest an appropriate geographic scope
            </p>
            <Select
              value={formData.organization_type}
              onValueChange={(value: OrganizationType) => handleOrgTypeChange(value)}
            >
              <SelectTrigger className="bg-[hsl(var(--portal-bg-secondary))]">
                <SelectValue placeholder="Select organization type..." />
              </SelectTrigger>
              <SelectContent className="max-h-80 bg-background">
                {/* Group by category */}
                {['Political Campaign', '501(c)(3) Nonprofit', '501(c)(4) Advocacy', 'PAC', 'International', 'Other'].map(category => (
                  <div key={category}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                      {category}
                    </div>
                    {ORG_TYPE_OPTIONS.filter(opt => opt.category === category).map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Geographic Level */}
          <div className="space-y-2">
            <Label>Geographic Scope</Label>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">
              Adjust if the suggested scope doesn't match your organization
            </p>
            <Select
              value={formData.geo_level}
              onValueChange={(value: GeoLevel) => handleGeoLevelChange(value)}
            >
              <SelectTrigger className="bg-[hsl(var(--portal-bg-secondary))]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background">
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
          </div>

          {/* Step 3: Location Picker */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Target Locations
            </Label>
            <GeoLocationPicker
              geoLevel={formData.geo_level}
              selectedLocations={formData.geo_locations}
              onChange={(locations) => setFormData(prev => ({ ...prev, geo_locations: locations }))}
            />
          </div>
        </div>
      </div>

      {/* Advanced Settings (Collapsed by default) */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <div className="rounded-lg border border-[hsl(var(--portal-border))]">
          <CollapsibleTrigger asChild>
            <div className="cursor-pointer hover:bg-[hsl(var(--portal-bg-hover))] transition-colors p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <AlertCircle className="w-4 h-4 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">Advanced Settings</h3>
                    <p className="text-xs text-[hsl(var(--portal-text-muted))]">Sensitivity & risk configuration</p>
                  </div>
                </div>
                {advancedOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 pt-0 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Sentiment Sensitivity</Label>
                  <Select
                    value={formData.sentiment_sensitivity}
                    onValueChange={(value: 'low' | 'medium' | 'high') => 
                      setFormData(prev => ({ ...prev, sentiment_sensitivity: value }))
                    }
                  >
                    <SelectTrigger className="bg-[hsl(var(--portal-bg-secondary))]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Less frequent alerts</SelectItem>
                      <SelectItem value="medium">Medium - Balanced</SelectItem>
                      <SelectItem value="high">High - More frequent alerts</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Risk Tolerance</Label>
                  <Select
                    value={formData.risk_tolerance}
                    onValueChange={(value: 'low' | 'medium' | 'high') => 
                      setFormData(prev => ({ ...prev, risk_tolerance: value }))
                    }
                  >
                    <SelectTrigger className="bg-[hsl(var(--portal-bg-secondary))]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Flag all potential issues</SelectItem>
                      <SelectItem value="medium">Medium - Balanced</SelectItem>
                      <SelectItem value="high">High - Only major threats</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <div className="flex justify-between pt-4 border-t border-[hsl(var(--portal-border))]">
        <V3Button type="button" variant="secondary" onClick={onBack}>
          Back
        </V3Button>
        <V3Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save & Continue'
          )}
        </V3Button>
      </div>
    </form>
  );
}
