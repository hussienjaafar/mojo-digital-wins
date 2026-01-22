import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { proxyRpc } from '@/lib/supabaseProxy';

interface UseIsAdminResult {
  isAdmin: boolean;
  isLoading: boolean;
}

/**
 * Hook to check if the current user has admin role.
 * Uses proxyRpc to check role (CORS-safe for portal.molitico.com).
 *
 * @returns {UseIsAdminResult} Object containing isAdmin boolean and loading state
 *
 * @example
 * const { isAdmin, isLoading } = useIsAdmin();
 * if (isAdmin) {
 *   // Show admin-specific UI
 * }
 */
export const useIsAdmin = (): UseIsAdminResult => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    const checkAdminRole = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.user) {
          if (isMounted) {
            setIsAdmin(false);
            setIsLoading(false);
          }
          return;
        }

        // Use proxyRpc for CORS-safe RPC call on portal.molitico.com
        const { data: hasAdminRole, error } = await proxyRpc<boolean>('has_role', {
          _user_id: session.user.id,
          _role: 'admin',
        });

        if (error) {
          console.error('Error checking admin role:', error);
          if (isMounted) {
            setIsAdmin(false);
          }
        } else if (isMounted) {
          setIsAdmin(Boolean(hasAdminRole));
        }
      } catch (error) {
        console.error('Error checking admin role:', error);
        if (isMounted) {
          setIsAdmin(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkAdminRole();

    // Listen for auth state changes to re-check admin role
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          if (isMounted) {
            setIsAdmin(false);
            setIsLoading(false);
          }
        } else {
          // Re-check admin role on auth state change
          checkAdminRole();
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { isAdmin, isLoading };
};
