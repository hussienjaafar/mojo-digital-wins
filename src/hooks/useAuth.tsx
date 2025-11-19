import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
  role: string;
};

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch organizations when user logs in
        if (session?.user) {
          setTimeout(() => {
            fetchUserOrganizations(session.user.id);
          }, 0);
        } else {
          setOrganizations([]);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserOrganizations(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserOrganizations = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_users')
        .select(`
          organization_id,
          role,
          client_organizations (
            id,
            name,
            logo_url
          )
        `)
        .eq('id', userId);

      if (error) throw error;

      const orgs = data?.map((item: any) => ({
        id: item.client_organizations.id,
        name: item.client_organizations.name,
        logo_url: item.client_organizations.logo_url,
        role: item.role,
      })) || [];

      setOrganizations(orgs);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching organizations:', error);
      }
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear local state
      setUser(null);
      setSession(null);
      setOrganizations([]);
      
      // Clear localStorage
      localStorage.removeItem('selectedOrganizationId');
      
      // Navigate to login
      navigate('/client-login');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error logging out:', error);
      }
    }
  };

  const updateLastLogin = async () => {
    if (!user) return;
    
    try {
      await supabase
        .from('client_users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', user.id);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating last login:', error);
      }
    }
  };

  return {
    user,
    session,
    organizations,
    loading,
    logout,
    updateLastLogin,
    isAuthenticated: !!session,
  };
};
