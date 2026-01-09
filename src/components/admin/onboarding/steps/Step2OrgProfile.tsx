import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { V3Button } from '@/components/v3/V3Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, MapPin, Loader2, Sparkles, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { OrgProfileData } from '../types';

const POLICY_DOMAINS = [
  'Healthcare', 'Education', 'Environment', 'Labor & Workers Rights',
  'Civil Rights', 'Immigration', 'Economic Justice', 'Housing',
  'Criminal Justice', 'Voting Rights', 'Foreign Policy', 'Technology',
];

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
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
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [formData, setFormData] = useState<OrgProfileData>({
    mission_statement: initialData?.mission_statement || '',
    focus_areas: initialData?.focus_areas || [],
    policy_domains: initialData?.policy_domains || [],
    geo_focus: initialData?.geo_focus || 'federal',
    target_states: initialData?.target_states || [],
    sentiment_sensitivity: initialData?.sentiment_sensitivity || 'medium',
    risk_tolerance: initialData?.risk_tolerance || 'medium',
  });

  // Auto-scrape website on mount if URL provided
  useEffect(() => {
    if (websiteUrl && !formData.mission_statement) {
      handleScrapeWebsite();
    }
  }, [websiteUrl]);

  const handleScrapeWebsite = async () => {
    if (!websiteUrl) return;
    
    setIsScraping(true);
    try {
      const { data, error } = await supabase.functions.invoke('scrape-organization-website', {
        body: { 
          organization_id: organizationId,
          url: websiteUrl,
        },
      });

      if (error) throw error;

      if (data?.profile) {
        setFormData(prev => ({
          ...prev,
          mission_statement: data.profile.mission_statement || prev.mission_statement,
          focus_areas: data.profile.focus_areas || prev.focus_areas,
          policy_domains: data.profile.policy_domains || prev.policy_domains,
        }));
        
        toast({
          title: 'Website Analyzed',
          description: 'Organization profile auto-filled from website content',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Scrape Failed',
        description: 'Could not analyze website. Please fill in details manually.',
        variant: 'destructive',
      });
    } finally {
      setIsScraping(false);
    }
  };

  const toggleDomain = (domain: string) => {
    setFormData(prev => ({
      ...prev,
      policy_domains: prev.policy_domains.includes(domain)
        ? prev.policy_domains.filter(d => d !== domain)
        : [...prev.policy_domains, domain],
    }));
  };

  const toggleState = (state: string) => {
    setFormData(prev => ({
      ...prev,
      target_states: prev.target_states.includes(state)
        ? prev.target_states.filter(s => s !== state)
        : [...prev.target_states, state],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Upsert organization profile - map to actual DB columns
      const { error: profileError } = await supabase
        .from('organization_profiles')
        .upsert({
          organization_id: organizationId,
          mission_summary: formData.mission_statement,
          focus_areas: formData.focus_areas,
          interest_topics: formData.policy_domains,
          geographies: formData.geo_focus === 'federal' ? ['Federal'] : 
                       formData.geo_focus === 'state' ? formData.target_states :
                       formData.geo_focus === 'local' ? ['Local'] : 
                       [...formData.target_states, 'Federal'],
          sensitivity_redlines: {
            sentiment_sensitivity: formData.sentiment_sensitivity,
            risk_tolerance: formData.risk_tolerance,
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
        <Card className="border-[hsl(var(--portal-accent-purple))]/30 bg-[hsl(var(--portal-accent-purple))]/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-[hsl(var(--portal-accent-purple))]" />
                <div>
                  <p className="text-sm font-medium">AI-Powered Profile Extraction</p>
                  <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                    Extract mission & focus areas from website
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
                ) : (
                  'Re-analyze Website'
                )}
              </V3Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mission & Focus */}
      <Card className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10">
              <Target className="w-5 h-5 text-[hsl(var(--portal-accent-blue))]" />
            </div>
            <div>
              <CardTitle className="text-lg">Mission & Focus Areas</CardTitle>
              <CardDescription>What does this organization care about?</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <div className="space-y-2">
            <Label>Policy Domains</Label>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">
              Select all areas this organization focuses on
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
        </CardContent>
      </Card>

      {/* Geographic Focus */}
      <Card className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <MapPin className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <CardTitle className="text-lg">Geographic Focus</CardTitle>
              <CardDescription>Where does this organization operate?</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Primary Focus</Label>
            <Select
              value={formData.geo_focus}
              onValueChange={(value: 'federal' | 'state' | 'local' | 'multi') => 
                setFormData(prev => ({ ...prev, geo_focus: value }))
              }
            >
              <SelectTrigger className="bg-[hsl(var(--portal-bg-secondary))]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="federal">Federal (National)</SelectItem>
                <SelectItem value="state">State-level</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="multi">Multi-level</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(formData.geo_focus === 'state' || formData.geo_focus === 'multi') && (
            <div className="space-y-2">
              <Label>Target States</Label>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] max-h-32 overflow-y-auto">
                {US_STATES.map(state => (
                  <Badge
                    key={state}
                    variant={formData.target_states.includes(state) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs"
                    onClick={() => toggleState(state)}
                  >
                    {state}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced Settings (Collapsed by default) */}
      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <Card className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-[hsl(var(--portal-bg-hover))] transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Advanced Settings</CardTitle>
                    <CardDescription>Sensitivity & risk configuration</CardDescription>
                  </div>
                </div>
                {advancedOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4 pt-0">
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
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <div className="flex justify-between">
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
