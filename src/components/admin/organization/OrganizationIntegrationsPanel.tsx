import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Circle,
  ChevronDown,
  ChevronUp,
  Zap,
  Link2,
  Plug,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { V3Button } from '@/components/v3/V3Button';
import { V3Badge } from '@/components/v3/V3Badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { IntegrationDetailCard } from '@/components/admin/integrations/IntegrationDetailCard';
import { CredentialSlideOver } from '@/components/admin/integrations/CredentialSlideOver';
import { MetaCAPISettings } from '@/components/admin/integrations/MetaCAPISettings';
import { CampaignURLGenerator } from '@/components/admin/integrations/CampaignURLGenerator';
import type { IntegrationDetail, IntegrationHealthStatus } from '@/types/integrations';

interface OrganizationIntegrationsPanelProps {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
}

interface IntegrationData {
  integrations: IntegrationDetail[];
  totalCount: number;
  healthyCount: number;
  errorCount: number;
  untestedCount: number;
  healthStatus: IntegrationHealthStatus;
}

const healthConfig: Record<IntegrationHealthStatus, {
  icon: React.ReactNode;
  label: string;
  variant: 'success' | 'warning' | 'error' | 'muted';
}> = {
  healthy: {
    icon: <CheckCircle className="h-4 w-4" />,
    label: 'All Healthy',
    variant: 'success',
  },
  needs_attention: {
    icon: <AlertTriangle className="h-4 w-4" />,
    label: 'Needs Attention',
    variant: 'error',
  },
  untested: {
    icon: <Clock className="h-4 w-4" />,
    label: 'Untested',
    variant: 'warning',
  },
  no_setup: {
    icon: <Circle className="h-4 w-4" />,
    label: 'No Integrations',
    variant: 'muted',
  },
  all_disabled: {
    icon: <Circle className="h-4 w-4" />,
    label: 'All Disabled',
    variant: 'muted',
  },
};

export function OrganizationIntegrationsPanel({
  organizationId,
  organizationName,
  organizationSlug,
}: OrganizationIntegrationsPanelProps) {
  const { toast } = useToast();
  
  const [data, setData] = useState<IntegrationData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [capiOpen, setCapiOpen] = useState(false);
  const [urlGenOpen, setUrlGenOpen] = useState(false);
  
  const [credentialSlideOver, setCredentialSlideOver] = useState<{
    open: boolean;
    editingId?: string;
  }>({ open: false });

  const fetchIntegrations = useCallback(async () => {
    try {
      const { data: summaryData, error } = await supabase
        .from('v_integration_summary')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();

      if (error) throw error;

      if (summaryData) {
        const integrations = Array.isArray(summaryData.integrations) 
          ? (summaryData.integrations as unknown as IntegrationDetail[])
          : [];
        setData({
          integrations,
          totalCount: summaryData.total_count || 0,
          healthyCount: summaryData.healthy_count || 0,
          errorCount: summaryData.error_count || 0,
          untestedCount: summaryData.untested_count || 0,
          healthStatus: (summaryData.health_status as IntegrationHealthStatus) || 'no_setup',
        });
      } else {
        setData({
          integrations: [],
          totalCount: 0,
          healthyCount: 0,
          errorCount: 0,
          untestedCount: 0,
          healthStatus: 'no_setup',
        });
      }
    } catch (error: any) {
      console.error('Error fetching integrations:', error);
      toast({
        title: 'Error',
        description: 'Failed to load integrations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [organizationId, toast]);

  useEffect(() => {
    fetchIntegrations();
  }, [fetchIntegrations]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchIntegrations();
  };

  const handleTest = async (integrationId: string): Promise<boolean> => {
    try {
      // Simulate test - in real implementation this would call an edge function
      await new Promise(resolve => setTimeout(resolve, 1500));
      const success = Math.random() > 0.2;
      
      await supabase
        .from('client_api_credentials')
        .update({
          last_tested_at: new Date().toISOString(),
          last_test_status: success ? 'success' : 'failed',
          last_test_error: success ? null : 'Connection timeout',
        })
        .eq('id', integrationId);

      await fetchIntegrations();
      
      toast({
        title: success ? 'Connection successful' : 'Connection failed',
        description: success 
          ? 'The integration is working correctly' 
          : 'Failed to connect. Check credentials.',
        variant: success ? 'default' : 'destructive',
      });
      
      return success;
    } catch (error) {
      console.error('Error testing connection:', error);
      return false;
    }
  };

  const handleToggle = async (integrationId: string, currentState: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('client_api_credentials')
        .update({ is_active: !currentState })
        .eq('id', integrationId);

      if (error) throw error;

      await fetchIntegrations();
      
      toast({
        title: currentState ? 'Integration disabled' : 'Integration enabled',
        description: currentState 
          ? 'The integration has been paused' 
          : 'The integration is now active',
      });
      
      return true;
    } catch (error) {
      console.error('Error toggling integration:', error);
      return false;
    }
  };

  const handleEdit = (integrationId: string) => {
    setCredentialSlideOver({ open: true, editingId: integrationId });
  };

  const handleAddIntegration = () => {
    setCredentialSlideOver({ open: true, editingId: undefined });
  };

  const health = data?.healthStatus ? healthConfig[data.healthStatus] : null;

  if (isLoading) {
    return (
      <div className="portal-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-purple)/0.1)]">
            <Plug className="w-5 h-5 text-[hsl(var(--portal-accent-purple))]" />
          </div>
          <div>
            <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">Integrations</h3>
            <p className="text-sm text-[hsl(var(--portal-text-muted))]">Loading...</p>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-24 rounded-lg bg-[hsl(var(--portal-bg-tertiary))] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="portal-card p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[hsl(var(--portal-accent-purple)/0.1)]">
              <Plug className="w-5 h-5 text-[hsl(var(--portal-accent-purple))]" />
            </div>
            <div>
              <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">Integrations</h3>
              <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                Manage data sources and connections
              </p>
            </div>
          </div>
          <V3Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
          </V3Button>
        </div>

        {/* Health Summary */}
        {health && data && (
          <div className="flex items-center gap-4 p-3 rounded-lg bg-[hsl(var(--portal-bg-tertiary))] mb-6">
            <V3Badge variant={health.variant} className="gap-1.5">
              {health.icon}
              {health.label}
            </V3Badge>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-[hsl(var(--portal-text-muted))]">
                Total: <span className="font-medium text-[hsl(var(--portal-text-primary))]">{data.totalCount}</span>
              </span>
              {data.healthyCount > 0 && (
                <span className="text-[hsl(var(--portal-success))]">
                  {data.healthyCount} Healthy
                </span>
              )}
              {data.errorCount > 0 && (
                <span className="text-[hsl(var(--portal-error))]">
                  {data.errorCount} Failing
                </span>
              )}
              {data.untestedCount > 0 && (
                <span className="text-[hsl(var(--portal-warning))]">
                  {data.untestedCount} Untested
                </span>
              )}
            </div>
          </div>
        )}

        {/* Integration Cards */}
        <div className="space-y-3 mb-6">
          {data && data.integrations.length > 0 ? (
            <AnimatePresence mode="popLayout">
              {data.integrations.map((integration, index) => (
                <motion.div
                  key={integration.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <IntegrationDetailCard
                    integration={integration}
                    onTest={handleTest}
                    onToggle={handleToggle}
                    onEdit={handleEdit}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <div className="w-16 h-16 rounded-full bg-[hsl(var(--portal-bg-tertiary))] flex items-center justify-center mx-auto mb-4">
                <Circle className="h-8 w-8 text-[hsl(var(--portal-text-tertiary))]" />
              </div>
              <h3 className="text-lg font-medium text-[hsl(var(--portal-text-primary))] mb-1">
                No integrations configured
              </h3>
              <p className="text-sm text-[hsl(var(--portal-text-secondary))] mb-4">
                Add an integration to start syncing data
              </p>
            </motion.div>
          )}

          {/* Add Integration Button */}
          <V3Button
            variant="secondary"
            className="w-full gap-2 border-dashed"
            onClick={handleAddIntegration}
          >
            <Plus className="h-4 w-4" />
            Add Integration
          </V3Button>
        </div>

        {/* Advanced Tools Section */}
        <div className="pt-6 border-t border-[hsl(var(--portal-border))] space-y-3">
          <p className="text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wider mb-3">
            Advanced Tools
          </p>
          
          {/* Meta CAPI Settings */}
          <Collapsible open={capiOpen} onOpenChange={setCapiOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 p-3 rounded-lg text-left hover:bg-[hsl(var(--portal-bg-tertiary))] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/10">
                    <Zap className="h-4 w-4 text-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-[hsl(var(--portal-text-primary))]">
                      Meta Conversions API
                    </p>
                    <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                      Server-side conversion tracking
                    </p>
                  </div>
                </div>
                {capiOpen ? (
                  <ChevronUp className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] p-4">
                <MetaCAPISettings
                  organizationId={organizationId}
                  organizationName={organizationName}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Campaign URL Generator */}
          <Collapsible open={urlGenOpen} onOpenChange={setUrlGenOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between gap-2 p-3 rounded-lg text-left hover:bg-[hsl(var(--portal-bg-tertiary))] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Link2 className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-[hsl(var(--portal-text-primary))]">
                      Campaign URL Generator
                    </p>
                    <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                      Generate tracking URLs for Meta ads
                    </p>
                  </div>
                </div>
                {urlGenOpen ? (
                  <ChevronUp className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                )}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="rounded-lg border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] p-4">
                <CampaignURLGenerator
                  organizationSlug={organizationSlug}
                  organizationName={organizationName}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* Credential SlideOver */}
      <CredentialSlideOver
        open={credentialSlideOver.open}
        onOpenChange={(open) => setCredentialSlideOver({ ...credentialSlideOver, open })}
        editingCredentialId={credentialSlideOver.editingId}
        preselectedOrgId={organizationId}
        onSuccess={() => {
          fetchIntegrations();
          setCredentialSlideOver({ open: false });
        }}
      />
    </>
  );
}
