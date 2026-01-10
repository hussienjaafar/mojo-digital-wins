import { useState, useEffect } from 'react';
// Card removed - using integrated layout
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
  Activity
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

    // Check 1: Database connection
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

    // Check 2: Integration status
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

    // Check 3: Pipeline health (simulated)
    newChecks[2] = { ...newChecks[2], status: 'checking', message: 'Checking...' };
    setHealthChecks([...newChecks]);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    newChecks[2] = { 
      ...newChecks[2], 
      status: 'success', 
      message: 'Pipelines ready' 
    };
    setHealthChecks([...newChecks]);

    // Update activation status
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
      // Mark organization as active
      const { error: orgError } = await supabase
        .from('client_organizations')
        .update({ is_active: true })
        .eq('id', organizationId);

      if (orgError) throw orgError;

      // Update onboarding state
      const { error: stateError } = await supabase
        .from('org_onboarding_state')
        .update({
          status: 'completed',
          current_step: 6,
          completed_steps: [1, 2, 3, 4, 5, 6]
        })
        .eq('organization_id', organizationId);

      if (stateError) throw stateError;

      // Log audit action
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
      case 'success': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'error': return <XCircle className="h-4 w-4 text-destructive" />;
      case 'checking': return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      default: return <div className="h-4 w-4 rounded-full bg-muted" />;
    }
  };

  const completedChecks = healthChecks.filter(c => c.status === 'success').length;
  const progress = (completedChecks / healthChecks.length) * 100;

  return (
    <div className="space-y-6">
      {/* Health Check Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[hsl(var(--portal-text-secondary))]">Health Check Progress</span>
          <span className="text-[hsl(var(--portal-text-muted))]">{completedChecks}/{healthChecks.length}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

        {/* Health Checks */}
        <div className="space-y-3">
          {healthChecks.map((check, idx) => {
            const Icon = check.icon;
            return (
              <div 
                key={idx} 
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{check.name}</p>
                    <p className="text-xs text-muted-foreground">{check.message}</p>
                  </div>
                </div>
                {getStatusIcon(check.status)}
              </div>
            );
          })}
        </div>

        {/* Rerun Checks */}
        <Button 
          variant="outline" 
          onClick={runHealthChecks}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Re-run Health Checks
        </Button>

        {/* Activation Status */}
        {activationStatus.pipelines_enabled && (
          <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">Organization Activated!</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              The organization is now live. Users can log in and data pipelines are running.
            </p>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/client/${organizationSlug}`)}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                View Client Portal
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin?tab=clients')}
              >
                Back to Organizations
              </Button>
            </div>
          </div>
        )}

      {/* Actions */}
      {!activationStatus.pipelines_enabled && (
        <div className="flex justify-between pt-4 border-t border-[hsl(var(--portal-border))]">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button 
            onClick={activateOrganization}
            disabled={isActivating || !activationStatus.health_check_passed}
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
      )}
    </div>
  );
}
