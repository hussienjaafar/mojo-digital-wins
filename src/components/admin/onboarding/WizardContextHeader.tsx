import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ChevronDown, 
  Building2, 
  Clock, 
  CheckCircle2, 
  Loader2,
  Save,
  RotateCcw,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Organization {
  id: string;
  name: string;
  slug: string;
  is_active: boolean | null;
  onboarding_step?: number;
}

interface WizardContextHeaderProps {
  organizationId: string | null;
  currentStep: number;
  totalSteps: number;
  lastSavedAt?: Date | null;
  isSaving?: boolean;
  onSwitchOrganization?: (orgId: string) => void;
}

export function WizardContextHeader({
  organizationId,
  currentStep,
  totalSteps,
  lastSavedAt,
  isSaving = false,
  onSwitchOrganization,
}: WizardContextHeaderProps) {
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [recentOrgs, setRecentOrgs] = useState<Organization[]>([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);

  // Load current organization
  useEffect(() => {
    if (!organizationId) {
      setOrganization(null);
      return;
    }

    const loadOrganization = async () => {
      const { data, error } = await supabase
        .from('client_organizations')
        .select('id, name, slug, is_active')
        .eq('id', organizationId)
        .single();

      if (!error && data) {
        setOrganization(data);
      }
    };

    loadOrganization();
  }, [organizationId]);

  // Load recent organizations for quick switching
  const loadRecentOrgs = async () => {
    if (recentOrgs.length > 0) return; // Already loaded
    
    setIsLoadingOrgs(true);
    try {
      const { data, error } = await supabase
        .from('client_organizations')
        .select(`
          id, 
          name, 
          slug, 
          is_active,
          org_onboarding_state(current_step, status)
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        const orgsWithStep = data.map((org) => ({
          id: org.id,
          name: org.name,
          slug: org.slug,
          is_active: org.is_active,
          onboarding_step: (org.org_onboarding_state as any)?.[0]?.current_step,
        }));
        setRecentOrgs(orgsWithStep);
      }
    } catch (err) {
      console.error('Failed to load recent orgs:', err);
    } finally {
      setIsLoadingOrgs(false);
    }
  };

  const progressPercentage = Math.round((currentStep / totalSteps) * 100);

  const getStatusBadge = (isActive: boolean | null) => {
    if (isActive === true) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
    }
    if (isActive === false) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    return <Badge variant="outline" className="text-amber-600 border-amber-500/20">Onboarding</Badge>;
  };

  if (!organization) {
    return (
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-muted-foreground">New Organization</p>
            <p className="text-sm text-muted-foreground">Complete step 1 to create</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Step {currentStep} of {totalSteps}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-4 rounded-lg border bg-card/50">
      {/* Left: Organization info with switcher */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        
        <DropdownMenu onOpenChange={(open) => open && loadRecentOrgs()}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
              <div className="flex items-center gap-2">
                <div className="text-left">
                  <p className="font-medium">{organization.name}</p>
                  <p className="text-sm text-muted-foreground">/{organization.slug}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            <div className="px-2 py-1.5 text-sm font-medium text-muted-foreground">
              Switch Organization
            </div>
            <DropdownMenuSeparator />
            {isLoadingOrgs ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <>
                {recentOrgs.map((org) => (
                  <DropdownMenuItem
                    key={org.id}
                    onClick={() => {
                      if (onSwitchOrganization) {
                        onSwitchOrganization(org.id);
                      } else {
                        navigate(`/admin?tab=onboarding-wizard&org=${org.id}`);
                      }
                    }}
                    className={cn(
                      'flex items-center justify-between',
                      org.id === organizationId && 'bg-accent'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{org.name}</p>
                        {org.onboarding_step && org.onboarding_step < totalSteps && (
                          <p className="text-xs text-muted-foreground">
                            Step {org.onboarding_step}/{totalSteps}
                          </p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(org.is_active)}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate('/admin?tab=clients')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View All Organizations
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {getStatusBadge(organization.is_active)}
      </div>

      {/* Center: Progress */}
      <div className="hidden md:flex items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <span className="text-sm text-muted-foreground">
            Step {currentStep}/{totalSteps}
          </span>
        </div>
      </div>

      {/* Right: Auto-save status */}
      <div className="flex items-center gap-2">
        {isSaving ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Saving...</span>
          </div>
        ) : lastSavedAt ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <span>Saved {formatDistanceToNow(lastSavedAt, { addSuffix: true })}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Not saved yet</span>
          </div>
        )}
      </div>
    </div>
  );
}
