import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
  role?: string;
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

      // Check admin role using RPC
      const { data: adminData } = await supabase.rpc("has_role", {
        _user_id: session.user.id,
        _role: "admin",
      });
      setIsAdmin(!!adminData);

      // Check client user access
      const { data: clientData } = await (supabase as any)
        .from("client_users")
        .select(`
          organization_id,
          role,
          client_organizations (
            id,
            name,
            logo_url
          )
        `)
        .eq("id", session.user.id);

      if (clientData && clientData.length > 0) {
        setIsClientUser(true);
        const orgs: Organization[] = clientData.map((item: any) => ({
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
