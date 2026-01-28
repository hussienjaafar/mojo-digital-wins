import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { V3Button } from '@/components/v3/V3Button';
import { V3Badge } from '@/components/v3/V3Badge';
import { AdminPageHeader, AdminLoadingState } from '@/components/admin/v3';
import { AdminDetailShell } from '@/components/admin/AdminDetailShell';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  ArrowLeft,
  Settings2,
  FileText,
  Activity,
  Users,
  Plug,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Calendar,
} from 'lucide-react';
import {
  OrganizationDetailsForm,
  OrganizationProfileForm,
  OrganizationSettingsForm,
  OrganizationMembersPanel,
  OrganizationIntegrationsPanel,
} from '@/components/admin/organization';
import type { OrgProfileData } from '@/components/admin/onboarding/types';

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_contact_email: string | null;
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

const tabAnimation = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.2 },
};

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
      <AdminDetailShell>
        <div className="space-y-6">
          <AdminPageHeader
            title="Organization Details"
            description="Loading..."
            icon={Building2}
            iconColor="blue"
          />
          <AdminLoadingState variant="card" count={3} />
        </div>
      </AdminDetailShell>
    );
  }

  if (!isAdmin) {
    navigate('/access-denied');
    return null;
  }

  if (!organization) {
    return (
      <AdminDetailShell>
        <p className="text-[hsl(var(--portal-text-muted))]">Organization not found.</p>
      </AdminDetailShell>
    );
  }

  const handleDetailsUpdate = async (data: Partial<OrganizationData>) => {
    try {
      const { error } = await (supabase as any)
        .from('client_organizations')
        .update(data)
        .eq('id', organizationId);

      if (error) throw error;

      setOrganization(prev => (prev ? { ...prev, ...data } : null));
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
          ignoreDuplicates: false,
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

      setOrganization(prev => (prev ? { ...prev, ...data } : null));
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
    <AdminDetailShell>
      <div className="space-y-6">
        {/* Header */}
        <AdminPageHeader
          title={organization.name}
          description="Manage organization details, profile, members, and settings"
          icon={Building2}
          iconColor="blue"
          onRefresh={loadOrganization}
          actions={
            <V3Button variant="secondary" onClick={() => navigate('/admin?tab=clients')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Organizations
            </V3Button>
          }
        >
          {/* Status & Quick Info */}
          <div className="flex items-center gap-3 flex-wrap">
            <V3Badge variant={organization.is_active ? 'success' : 'muted'}>
              {organization.is_active ? 'Active' : 'Inactive'}
            </V3Badge>
            <div className="flex items-center gap-1.5 text-sm text-[hsl(var(--portal-text-muted))]">
              <Globe className="w-3.5 h-3.5" />
              <code className="bg-[hsl(var(--portal-bg-tertiary))] px-1.5 py-0.5 rounded text-xs font-mono">
                {organization.slug}
              </code>
            </div>
            {organization.logo_url && (
              <img
                src={organization.logo_url}
                alt={`${organization.name} logo`}
                className="h-6 w-6 rounded object-contain bg-[hsl(var(--portal-bg-tertiary))]"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
          </div>
        </AdminPageHeader>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="portal-card p-4"
          >
            <div className="flex items-center gap-2 text-[hsl(var(--portal-text-muted))] mb-2">
              <div className="p-1.5 rounded-md bg-[hsl(var(--portal-accent-blue)/0.1)]">
                <Users className="w-4 h-4 text-[hsl(var(--portal-accent-blue))]" />
              </div>
              <span className="text-xs font-medium">Members</span>
            </div>
            <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
              {onboarding?.user_count || 0}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="portal-card p-4"
          >
            <div className="flex items-center gap-2 text-[hsl(var(--portal-text-muted))] mb-2">
              <div className="p-1.5 rounded-md bg-[hsl(var(--portal-accent-purple)/0.1)]">
                <Plug className="w-4 h-4 text-[hsl(var(--portal-accent-purple))]" />
              </div>
              <span className="text-xs font-medium">Integrations</span>
            </div>
            <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
              {onboarding?.integration_count || 0}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="portal-card p-4"
          >
            <div className="flex items-center gap-2 text-[hsl(var(--portal-text-muted))] mb-2">
              <div className={`p-1.5 rounded-md ${
                onboarding?.effective_status === 'completed' 
                  ? 'bg-[hsl(var(--portal-success)/0.1)]' 
                  : 'bg-[hsl(var(--portal-warning)/0.1)]'
              }`}>
                {onboarding?.effective_status === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 text-[hsl(var(--portal-success))]" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[hsl(var(--portal-warning))]" />
                )}
              </div>
              <span className="text-xs font-medium">Onboarding</span>
            </div>
            <p className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
              {onboarding?.effective_status === 'completed'
                ? 'Complete'
                : `Step ${onboarding?.current_step || 1}/6`}
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="portal-card p-4"
          >
            <div className="flex items-center gap-2 text-[hsl(var(--portal-text-muted))] mb-2">
              <div className="p-1.5 rounded-md bg-[hsl(var(--portal-bg-tertiary))]">
                <Calendar className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium">Created</span>
            </div>
            <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {new Date(organization.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
          </motion.div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="inline-flex h-11 items-center justify-center rounded-lg bg-[hsl(var(--portal-bg-tertiary))] p-1 text-[hsl(var(--portal-text-muted))] border border-[hsl(var(--portal-border))]">
            <TabsTrigger
              value="details"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-secondary))] data-[state=active]:text-[hsl(var(--portal-text-primary))] data-[state=active]:shadow-sm"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">Details</span>
            </TabsTrigger>
            <TabsTrigger
              value="profile"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-secondary))] data-[state=active]:text-[hsl(var(--portal-text-primary))] data-[state=active]:shadow-sm"
            >
              <Building2 className="w-4 h-4" />
              <span className="hidden sm:inline">Profile</span>
            </TabsTrigger>
            <TabsTrigger
              value="settings"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-secondary))] data-[state=active]:text-[hsl(var(--portal-text-primary))] data-[state=active]:shadow-sm"
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
            <TabsTrigger
              value="members"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-secondary))] data-[state=active]:text-[hsl(var(--portal-text-primary))] data-[state=active]:shadow-sm"
            >
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Members</span>
              {onboarding?.user_count ? (
                <V3Badge variant="muted" size="sm" className="hidden sm:flex">
                  {onboarding.user_count}
                </V3Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger
              value="integrations"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-secondary))] data-[state=active]:text-[hsl(var(--portal-text-primary))] data-[state=active]:shadow-sm"
            >
              <Plug className="w-4 h-4" />
              <span className="hidden sm:inline">Integrations</span>
              {onboarding?.integration_count ? (
                <V3Badge variant="muted" size="sm" className="hidden sm:flex">
                  {onboarding.integration_count}
                </V3Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger
              value="activity"
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all gap-2 data-[state=active]:bg-[hsl(var(--portal-bg-secondary))] data-[state=active]:text-[hsl(var(--portal-text-primary))] data-[state=active]:shadow-sm"
            >
              <Activity className="w-4 h-4" />
              <span className="hidden sm:inline">Activity</span>
            </TabsTrigger>
          </TabsList>

          <AnimatePresence mode="wait">
            <TabsContent value="details" className="mt-0">
              <motion.div key="details" {...tabAnimation}>
                <OrganizationDetailsForm organization={organization} onSave={handleDetailsUpdate} />
              </motion.div>
            </TabsContent>

            <TabsContent value="profile" className="mt-0">
              <motion.div key="profile" {...tabAnimation}>
                <OrganizationProfileForm
                  organizationId={organizationId!}
                  profile={profile}
                  onSave={handleProfileUpdate}
                />
              </motion.div>
            </TabsContent>

            <TabsContent value="settings" className="mt-0">
              <motion.div key="settings" {...tabAnimation}>
                <OrganizationSettingsForm organization={organization} onSave={handleSettingsUpdate} />
              </motion.div>
            </TabsContent>

            <TabsContent value="members" className="mt-0">
              <motion.div key="members" {...tabAnimation}>
                <OrganizationMembersPanel
                  organizationId={organizationId!}
                  organizationName={organization.name}
                />
              </motion.div>
            </TabsContent>

            <TabsContent value="integrations" className="mt-0">
              <motion.div key="integrations" {...tabAnimation}>
                <OrganizationIntegrationsPanel
                  organizationId={organizationId!}
                  organizationName={organization.name}
                  organizationSlug={organization.slug}
                />
              </motion.div>
            </TabsContent>

            <TabsContent value="activity" className="mt-0">
              <motion.div key="activity" {...tabAnimation}>
                <div className="portal-card p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
                      <Activity className="w-5 h-5 text-[hsl(var(--portal-accent-blue))]" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">
                        Activity Overview
                      </h3>
                      <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                        Organization onboarding progress and activity metrics
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Onboarding Status Card */}
                    <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-tertiary))] border border-[hsl(var(--portal-border))]">
                      <div className="flex items-center gap-2 mb-3">
                        {onboarding?.effective_status === 'completed' ? (
                          <div className="p-2 rounded-lg bg-[hsl(var(--portal-success)/0.1)]">
                            <CheckCircle2 className="w-5 h-5 text-[hsl(var(--portal-success))]" />
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-[hsl(var(--portal-warning)/0.1)]">
                            <AlertTriangle className="w-5 h-5 text-[hsl(var(--portal-warning))]" />
                          </div>
                        )}
                        <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                          Onboarding
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                        {onboarding?.effective_status === 'completed'
                          ? 'Complete'
                          : `Step ${onboarding?.current_step || 1} of 6`}
                      </p>
                      <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
                        {onboarding?.completed_steps?.length || 0} steps completed
                      </p>
                    </div>

                    {/* Users Card */}
                    <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-tertiary))] border border-[hsl(var(--portal-border))]">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]">
                          <Users className="w-5 h-5 text-[hsl(var(--portal-accent-blue))]" />
                        </div>
                        <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                          Team Members
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                        {onboarding?.user_count || 0}
                      </p>
                      <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">Active members</p>
                    </div>

                    {/* Integrations Card */}
                    <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-tertiary))] border border-[hsl(var(--portal-border))]">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-purple)/0.1)]">
                          <Plug className="w-5 h-5 text-[hsl(var(--portal-accent-purple))]" />
                        </div>
                        <span className="font-medium text-[hsl(var(--portal-text-primary))]">
                          Integrations
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                        {onboarding?.integration_count || 0}
                      </p>
                      <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
                        Connected services
                      </p>
                    </div>
                  </div>

                  {/* Created date footer */}
                  <div className="mt-6 pt-4 border-t border-[hsl(var(--portal-border))]">
                    <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                      Organization created on{' '}
                      {new Date(organization.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
              </motion.div>
            </TabsContent>
          </AnimatePresence>
        </Tabs>
      </div>
    </AdminDetailShell>
  );
}
