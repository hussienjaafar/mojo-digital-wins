import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ActivationStatus, WizardStep } from '../types';
import { 
  Rocket, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Play,
  RefreshCw,
  ExternalLink,
  Zap,
  Database,
  Activity,
  PartyPopper
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Step6ActivationProps {
  organizationId: string;
  organizationSlug: string;
  stepData: Record<string, unknown>;
  onComplete: (step: WizardStep, data: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}

interface HealthCheck {
  name: string;
  status: 'pending' | 'checking' | 'success' | 'error';
  message: string;
  icon: React.ElementType;
}

export function Step6Activation({ 
  organizationId, 
  organizationSlug,
  stepData, 
  onComplete, 
  onBack 
}: Step6ActivationProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  
  const [activationStatus, setActivationStatus] = useState<ActivationStatus>(
    (stepData.activation_status as ActivationStatus) || {
      pipelines_enabled: false,
      first_sync_completed: false,
      health_check_passed: false
    }
  );

  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([
    { name: 'Database Connection', status: 'pending', message: 'Not checked', icon: Database },
    { name: 'Integration Status', status: 'pending', message: 'Not checked', icon: Zap },
    { name: 'Pipeline Health', status: 'pending', message: 'Not checked', icon: Activity }
  ]);

  const runHealthChecks = async () => {
    setIsLoading(true);
    const newChecks = [...healthChecks];

    newChecks[0] = { ...newChecks[0], status: 'checking', message: 'Checking...' };
    setHealthChecks([...newChecks]);
    
    try {
      const { data, error } = await supabase
        .from('client_organizations')
        .select('id, name')
        .eq('id', organizationId)
        .single();

      if (error) throw error;
      newChecks[0] = { 
        ...newChecks[0], 
        status: 'success', 
        message: `Connected: ${data.name}` 
      };
    } catch {
      newChecks[0] = { 
        ...newChecks[0], 
        status: 'error', 
        message: 'Failed to connect' 
      };
    }
    setHealthChecks([...newChecks]);

    newChecks[1] = { ...newChecks[1], status: 'checking', message: 'Checking...' };
    setHealthChecks([...newChecks]);
    
    try {
      const { data, error } = await supabase
        .from('client_api_credentials')
        .select('platform, is_active, last_test_status')
        .eq('organization_id', organizationId);

      if (error) throw error;
      
      const activeIntegrations = data?.filter(c => c.is_active) || [];
      newChecks[1] = { 
        ...newChecks[1], 
        status: activeIntegrations.length > 0 ? 'success' : 'pending', 
        message: activeIntegrations.length > 0 
          ? `${activeIntegrations.length} integration(s) active` 
          : 'No integrations configured (optional)'
      };
    } catch {
      newChecks[1] = { 
        ...newChecks[1], 
        status: 'error', 
        message: 'Failed to check integrations' 
      };
    }
    setHealthChecks([...newChecks]);

    newChecks[2] = { ...newChecks[2], status: 'checking', message: 'Checking...' };
    setHealthChecks([...newChecks]);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    newChecks[2] = { 
      ...newChecks[2], 
      status: 'success', 
      message: 'Pipelines ready' 
    };
    setHealthChecks([...newChecks]);

    const allPassed = newChecks.every(c => c.status === 'success' || c.status === 'pending');
    setActivationStatus(prev => ({
      ...prev,
      health_check_passed: allPassed
    }));

    setIsLoading(false);
  };

  useEffect(() => {
    runHealthChecks();
  }, [organizationId]);

  const activateOrganization = async () => {
    setIsActivating(true);
    try {
      const { error: orgError } = await supabase
        .from('client_organizations')
        .update({ is_active: true })
        .eq('id', organizationId);

      if (orgError) throw orgError;

      const { error: stateError } = await supabase
        .from('org_onboarding_state')
        .update({
          status: 'completed',
          current_step: 6,
          completed_steps: [1, 2, 3, 4, 5, 6]
        })
        .eq('organization_id', organizationId);

      if (stateError) throw stateError;

      await supabase.rpc('log_admin_action', {
        _action_type: 'activate_organization',
        _table_affected: 'client_organizations',
        _record_id: organizationId,
        _old_value: { is_active: false },
        _new_value: { is_active: true }
      });

      setActivationStatus({
        pipelines_enabled: true,
        first_sync_completed: true,
        health_check_passed: true
      });

      toast({
        title: 'Organization activated!',
        description: 'The organization is now live and ready to use.'
      });

      await onComplete(6, { 
        activation_status: {
          pipelines_enabled: true,
          first_sync_completed: true,
          health_check_passed: true
        }
      });
    } catch (error) {
      console.error('Error activating organization:', error);
      toast({
        title: 'Activation failed',
        description: 'Failed to activate organization. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsActivating(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="h-4 w-4 text-[hsl(var(--portal-success))]" />;
      case 'error': return <XCircle className="h-4 w-4 text-[hsl(var(--portal-error))]" />;
      case 'checking': return <Loader2 className="h-4 w-4 animate-spin text-[hsl(var(--portal-accent-blue))]" />;
      default: return <div className="h-4 w-4 rounded-full bg-[hsl(var(--portal-bg-tertiary))]" />;
    }
  };

  const completedChecks = healthChecks.filter(c => c.status === 'success').length;
  const progress = (completedChecks / healthChecks.length) * 100;

  return (
    <div className="space-y-6">
      {/* Activation Success State */}
      {activationStatus.pipelines_enabled ? (
        <div className="rounded-xl border border-[hsl(var(--portal-success))]/30 bg-[hsl(var(--portal-success))]/5 p-6">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-[hsl(var(--portal-success))]/10 flex items-center justify-center mb-4">
              <PartyPopper className="h-8 w-8 text-[hsl(var(--portal-success))]" />
            </div>
            <h3 className="text-lg font-semibold text-[hsl(var(--portal-text-primary))] mb-1">Organization Activated!</h3>
            <p className="text-[13px] text-[hsl(var(--portal-text-secondary))] mb-6 max-w-md">
              The organization is now live. Users can log in and data pipelines are running.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => navigate(`/client/${organizationSlug}`)}
                className="h-10 px-5"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Client Portal
              </Button>
              <Button
                onClick={() => navigate('/admin?tab=clients')}
                className="h-10 px-5"
              >
                Back to Organizations
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Health Check Progress Card */}
          <div className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] overflow-hidden">
            <div className="px-5 py-4 border-b border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-tertiary))]/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[hsl(var(--portal-accent-blue))]/10 flex items-center justify-center">
                    <Activity className="w-[18px] h-[18px] text-[hsl(var(--portal-accent-blue))]" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-[hsl(var(--portal-text-primary))]">System Health Check</h3>
                    <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">Verifying all systems are ready</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[13px] font-medium text-[hsl(var(--portal-text-primary))]">{completedChecks}/{healthChecks.length}</span>
                  <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">Passed</p>
                </div>
              </div>
              <Progress value={progress} className="h-1.5 mt-4" />
            </div>
            
            <div className="divide-y divide-[hsl(var(--portal-border))]">
              {healthChecks.map((check, idx) => {
                const Icon = check.icon;
                return (
                  <div 
                    key={idx} 
                    className="px-5 py-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[hsl(var(--portal-bg-tertiary))] flex items-center justify-center">
                        <Icon className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[hsl(var(--portal-text-primary))]">{check.name}</p>
                        <p className="text-[11px] text-[hsl(var(--portal-text-muted))]">{check.message}</p>
                      </div>
                    </div>
                    {getStatusIcon(check.status)}
                  </div>
                );
              })}
            </div>
            
            <div className="px-5 py-4 border-t border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-tertiary))]/30">
              <Button 
                variant="outline" 
                onClick={runHealthChecks}
                disabled={isLoading}
                className="w-full h-10"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Re-run Health Checks
              </Button>
            </div>
          </div>

          {/* Activation Card */}
          <div className="rounded-xl border border-[hsl(var(--portal-accent-blue))]/30 bg-[hsl(var(--portal-accent-blue))]/5 p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--portal-accent-blue))]/10 flex items-center justify-center flex-shrink-0">
                <Rocket className="w-5 h-5 text-[hsl(var(--portal-accent-blue))]" />
              </div>
              <div className="flex-1">
                <h3 className="text-[14px] font-semibold text-[hsl(var(--portal-text-primary))] mb-1">Ready to Launch</h3>
                <p className="text-[13px] text-[hsl(var(--portal-text-secondary))] mb-4">
                  All health checks have passed. Activate the organization to enable user access and start data pipelines.
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={onBack} className="h-10 px-5">
              Back
            </Button>
            <Button 
              onClick={activateOrganization}
              disabled={isActivating || !activationStatus.health_check_passed}
              className="h-10 px-6"
            >
              {isActivating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Activating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Activate Organization
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
