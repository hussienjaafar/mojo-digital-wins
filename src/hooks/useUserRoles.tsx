import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { proxyQuery, proxyRpc } from "@/lib/supabaseProxy";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
  role?: string;
};

type ClientUserWithOrg = {
  organization_id: string;
  role: string;
  client_organizations: {
    id: string;
    name: string;
    logo_url: string | null;
  };
};

type UserRoles = {
  isAdmin: boolean;
  isClientUser: boolean;
  organizations: Organization[];
  hasMultipleRoles: boolean;
  loading: boolean;
  refresh: () => void;
};

export const useUserRoles = (): UserRoles => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isClientUser, setIsClientUser] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setIsAdmin(false);
        setIsClientUser(false);
        setOrganizations([]);
        setLoading(false);
        return;
      }

      // Check admin role using RPC (via proxy for CORS compatibility)
      const { data: adminData } = await proxyRpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      setIsAdmin(!!adminData);

      // Check client user access (via proxy for CORS compatibility)
      const { data: clientData } = await proxyQuery<ClientUserWithOrg[]>({
        table: "client_users",
        select: "organization_id, role, client_organizations(id, name, logo_url)",
        filters: { id: session.user.id },
      });

      if (clientData && clientData.length > 0) {
        setIsClientUser(true);
        const orgs: Organization[] = clientData.map((item) => ({
          id: item.client_organizations.id,
          name: item.client_organizations.name,
          logo_url: item.client_organizations.logo_url,
          role: item.role,
        }));
        setOrganizations(orgs);
      } else {
        setIsClientUser(false);
        setOrganizations([]);
      }
    } catch (error) {
      console.error("Error fetching user roles:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchRoles();
    });

    return () => subscription.unsubscribe();
  }, [fetchRoles]);

  return {
    isAdmin,
    isClientUser,
    organizations,
    hasMultipleRoles: isAdmin && isClientUser,
    loading,
    refresh: fetchRoles,
  };
};
