import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { V3Button } from '@/components/v3/V3Button';
import { AdminPageHeader, AdminLoadingState } from '@/components/admin/v3';
import { Building2, ArrowLeft, Settings2, FileText, Activity, Users, Plug, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  OrganizationDetailsForm,
  OrganizationProfileForm,
  OrganizationSettingsForm,
} from '@/components/admin/organization';
import type { OrgProfileData } from '@/components/admin/onboarding/types';

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_contact_email: string | null;
  website_url: string | null;
  timezone: string | null;
  is_active: boolean;
  created_at: string;
  // Settings
  mfa_required: boolean;
  mfa_grace_period_days: number | null;
  purchased_seats: number;
  bonus_seats: number;
  max_concurrent_sessions: number;
}

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

interface OnboardingSummary {
  current_step: number;
  completed_steps: number[];
  onboarding_status: string;
  effective_status: string;
  user_count: number;
  integration_count: number;
  error_count: number;
}

export default function OrganizationDetail() {
  const { organizationId } = useParams<{ organizationId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();
  
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('details');

  useEffect(() => {
    if (organizationId) {
      loadOrganization();
    }
  }, [organizationId]);

  const loadOrganization = async () => {
    if (!organizationId) return;
    
    setIsLoading(true);
    try {
      // Load organization details
      const { data: orgData, error: orgError } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', organizationId)
        .maybeSingle();

      if (orgError) throw orgError;
      if (!orgData) {
        toast({
          title: 'Not Found',
          description: 'Organization not found',
          variant: 'destructive',
        });
        navigate('/admin');
        return;
      }
      
      setOrganization(orgData);

      // Load organization profile
      const { data: profileData, error: profileError } = await (supabase as any)
        .from('organization_profiles')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (!profileError && profileData) {
        setProfile(profileData);
      }

      // Load onboarding summary
      const { data: onboardingData } = await (supabase as any)
        .from('org_onboarding_summary')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (onboardingData) {
        setOnboarding(onboardingData);
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load organization',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isAdminLoading || isLoading) {
    return (
      <div className="p-6 space-y-6">
        <AdminPageHeader
          title="Organization Details"
          description="Loading..."
          icon={Building2}
          iconColor="blue"
        />
        <AdminLoadingState variant="card" count={3} />
      </div>
    );
  }

  if (!isAdmin) {
    navigate('/access-denied');
    return null;
  }

  if (!organization) {
    return (
      <div className="p-6">
        <p>Organization not found.</p>
      </div>
    );
  }

  const handleDetailsUpdate = async (data: Partial<OrganizationData>) => {
    try {
      const { error } = await (supabase as any)
        .from('client_organizations')
        .update(data)
        .eq('id', organizationId);

      if (error) throw error;

      setOrganization(prev => prev ? { ...prev, ...data } : null);
      toast({
        title: 'Success',
        description: 'Organization details updated',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update organization',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleProfileUpdate = async (data: Partial<OrgProfileData>) => {
    try {
      const profilePayload = {
        organization_id: organizationId,
        organization_type: data.organization_type,
        geo_level: data.geo_level,
        geo_locations: data.geo_locations,
        mission_statement: data.mission_statement,
        focus_areas: data.focus_areas || [],
        policy_domains: data.policy_domains || [],
        sentiment_sensitivity: data.sentiment_sensitivity,
        risk_tolerance: data.risk_tolerance,
      };

      const { data: upsertedProfile, error } = await (supabase as any)
        .from('organization_profiles')
        .upsert(profilePayload, { 
          onConflict: 'organization_id',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) throw error;

      setProfile(upsertedProfile);
      toast({
        title: 'Success',
        description: 'Organization profile updated',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleSettingsUpdate = async (data: Partial<OrganizationData>) => {
    try {
      const { error } = await (supabase as any)
        .from('client_organizations')
        .update(data)
        .eq('id', organizationId);

      if (error) throw error;

      setOrganization(prev => prev ? { ...prev, ...data } : null);
      toast({
        title: 'Success',
        description: 'Organization settings updated',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update settings',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <AdminPageHeader
        title={organization.name}
        description={`Manage organization details, profile, and settings`}
        icon={Building2}
        iconColor="blue"
        onRefresh={loadOrganization}
        actions={
          <V3Button
            variant="secondary"
            onClick={() => navigate('/admin?tab=clients')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Organizations
          </V3Button>
        }
      >
        {/* Breadcrumb / Status */}
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={organization.is_active ? 'default' : 'secondary'}>
            {organization.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <span className="text-sm text-[hsl(var(--portal-text-muted))]">
            Slug: <code className="bg-[hsl(var(--portal-bg-tertiary))] px-1 rounded">{organization.slug}</code>
          </span>
        </div>
      </AdminPageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-[hsl(var(--portal-bg-secondary))]">
          <TabsTrigger value="details" className="gap-2">
            <FileText className="w-4 h-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="profile" className="gap-2">
            <Building2 className="w-4 h-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="settings" className="gap-2">
            <Settings2 className="w-4 h-4" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="w-4 h-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <OrganizationDetailsForm
            organization={organization}
            onSave={handleDetailsUpdate}
          />
        </TabsContent>

        <TabsContent value="profile">
          <OrganizationProfileForm
            organizationId={organizationId!}
            profile={profile}
            websiteUrl={organization.website_url}
            onSave={handleProfileUpdate}
          />
        </TabsContent>

        <TabsContent value="settings">
          <OrganizationSettingsForm
            organization={organization}
            onSave={handleSettingsUpdate}
          />
        </TabsContent>

        <TabsContent value="activity">
          <Card className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Activity Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Onboarding Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
                  <div className="flex items-center gap-2 mb-2">
                    {onboarding?.effective_status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-[hsl(var(--portal-success))]" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-[hsl(var(--portal-warning))]" />
                    )}
                    <span className="font-medium">Onboarding</span>
                  </div>
                  <p className="text-2xl font-bold">
                    {onboarding?.effective_status === 'completed' ? 'Complete' : `Step ${onboarding?.current_step || 1} of 6`}
                  </p>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                    {onboarding?.completed_steps?.length || 0} steps completed
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-[hsl(var(--portal-accent-blue))]" />
                    <span className="font-medium">Users</span>
                  </div>
                  <p className="text-2xl font-bold">{onboarding?.user_count || 0}</p>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                    Active members
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
                  <div className="flex items-center gap-2 mb-2">
                    <Plug className="w-5 h-5 text-[hsl(var(--portal-accent-purple))]" />
                    <span className="font-medium">Integrations</span>
                  </div>
                  <p className="text-2xl font-bold">{onboarding?.integration_count || 0}</p>
                  <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                    Connected services
                  </p>
                </div>
              </div>

              {/* Created date */}
              <div className="pt-4 border-t border-[hsl(var(--portal-border))]">
                <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                  Created on {new Date(organization.created_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
