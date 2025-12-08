import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to check if current user has PII access (can see unmasked donor data)
 * Returns false by default (fail-closed) until explicitly determined
 */
export function usePIIAccess(organizationId?: string) {
  const [hasPIIAccess, setHasPIIAccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkPIIAccess() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setHasPIIAccess(false);
          setIsLoading(false);
          return;
        }

        // Check if system admin
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (roles?.some(r => r.role === 'admin')) {
          setHasPIIAccess(true);
          setIsLoading(false);
          return;
        }

        // Check client_users for org-level access
        const { data: clientUser } = await supabase
          .from('client_users')
          .select('role, mask_pii, organization_id')
          .eq('id', user.id)
          .maybeSingle();

        if (!clientUser) {
          setHasPIIAccess(false);
          setIsLoading(false);
          return;
        }

        // If checking for specific org, verify membership
        if (organizationId && clientUser.organization_id !== organizationId) {
          setHasPIIAccess(false);
          setIsLoading(false);
          return;
        }

        // mask_pii = false means they CAN see PII (admins/managers)
        // mask_pii = true means they CANNOT see PII (viewers)
        setHasPIIAccess(clientUser.mask_pii === false);
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking PII access:', error);
        // Fail closed - no PII access on error
        setHasPIIAccess(false);
        setIsLoading(false);
      }
    }

    checkPIIAccess();
  }, [organizationId]);

  return { hasPIIAccess, isLoading, shouldMaskPII: !hasPIIAccess };
}
