import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonation } from '@/contexts/ImpersonationContext';

export const useClientOrganization = () => {
  const { impersonatedOrgId, isImpersonating } = useImpersonation();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOrganizationId = async () => {
      if (isImpersonating && impersonatedOrgId) {
        setOrganizationId(impersonatedOrgId);
        setIsLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          setIsLoading(false);
          return;
        }

        const { data: clientUser } = await (supabase as any)
          .from('client_users')
          .select('organization_id')
          .eq('id', session.user.id)
          .maybeSingle();

        if (clientUser) {
          setOrganizationId(clientUser.organization_id);
        }
      } catch (error) {
        console.error('Error loading organization ID:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadOrganizationId();
  }, [impersonatedOrgId, isImpersonating]);

  return { organizationId, isLoading, isImpersonating };
};
