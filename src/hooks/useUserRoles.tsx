import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { proxyQuery, proxyRpc } from "@/lib/supabaseProxy";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
  role?: string;
};

type ClientUserRow = {
  organization_id: string;
  role: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  logo_url: string | null;
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
      const { data: adminData, error: adminError } = await proxyRpc<boolean>("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      if (adminError) {
        console.error("[useUserRoles] Error checking admin role:", adminError);
      }
      setIsAdmin(!!adminData);

      // Check client user access.
      // IMPORTANT: do NOT use an embedded select like `client_organizations(...)` here.
      // There are multiple FK paths between client_users and client_organizations, which
      // causes PostgREST ambiguity (PGRST201) and also breaks our db-proxy limitations.
      const { data: clientUsers, error: clientUsersError } = await proxyQuery<ClientUserRow[]>({
        table: "client_users",
        select: "organization_id, role",
        filters: { id: session.user.id },
      });

      if (clientUsersError) {
        console.error("[useUserRoles] Error fetching client_users:", clientUsersError);
      }

      const rows = clientUsers || [];
      if (rows.length === 0) {
        setIsClientUser(false);
        setOrganizations([]);
        return;
      }

      setIsClientUser(true);

      const uniqueOrgIds = [...new Set(rows.map((r) => r.organization_id).filter(Boolean))];
      const orgResults = await Promise.all(
        uniqueOrgIds.map(async (orgId) => {
          const { data, error } = await proxyQuery<OrganizationRow>({
            table: "client_organizations",
            select: "id, name, logo_url",
            filters: { id: orgId },
            single: true,
          });
          if (error) {
            console.error("[useUserRoles] Error fetching client_organizations:", { orgId, error });
          }
          return data;
        })
      );

      const orgById = new Map(orgResults.filter(Boolean).map((o) => [o!.id, o!] as const));
      const orgs: Organization[] = rows
        .map((r) => {
          const org = orgById.get(r.organization_id);
          if (!org) return null;
          return {
            id: org.id,
            name: org.name,
            logo_url: org.logo_url,
            role: r.role,
          } satisfies Organization;
        })
        .filter(Boolean) as Organization[];

      setOrganizations(orgs);
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
