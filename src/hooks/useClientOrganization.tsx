import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonationSafe } from '@/contexts/ImpersonationContext';

export const useClientOrganization = () => {
  const { impersonatedOrgId, isImpersonating } = useImpersonationSafe();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadOrganizationId = async () => {
      // Priority 1: Impersonation context (admin viewing as org or using selector)
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

        // Check if user is admin
        const { data: isAdminUser } = await supabase.rpc("has_role", {
          _user_id: session.user.id,
          _role: "admin",
        });

        if (isAdminUser) {
          // Priority 2: Admin's localStorage selection (from org selector)
          const savedOrgId = localStorage.getItem("selectedOrganizationId");
          if (savedOrgId) {
            setOrganizationId(savedOrgId);
            setIsLoading(false);
            return;
          }
        }

        // Priority 3: Client user's assigned organization
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

  // Listen for storage changes (when admin switches org via selector)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'selectedOrganizationId' && e.newValue) {
        setOrganizationId(e.newValue);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return { organizationId, isLoading, isImpersonating };
};