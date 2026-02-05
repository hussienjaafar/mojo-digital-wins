/**
 * AdminAdCopyStudio - Admin page for the Ad Copy Studio feature
 *
 * Wraps the AdCopyWizard with authentication and organization management.
 * - Checks admin role before rendering
 * - Fetches user's organizations
 * - Fetches ActBlue forms for the selected organization
 * - Provides organization switching capability
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { AdCopyWizard } from '@/components/ad-copy-studio/AdCopyWizard';

// =============================================================================
// Types
// =============================================================================

interface Organization {
  id: string;
  name: string;
}

// =============================================================================
// Component
// =============================================================================

export default function AdminAdCopyStudio() {
  const navigate = useNavigate();
  const { isAdmin, isLoading: isAdminLoading } = useIsAdmin();

  // State
  const [userId, setUserId] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [actblueForms, setActblueForms] = useState<string[]>([]);
  const [formsError, setFormsError] = useState<string | null>(null);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [isLoadingForms, setIsLoadingForms] = useState(false);

  // =========================================================================
  // Fetch User and Organizations
  // =========================================================================

  useEffect(() => {
    let isMounted = true;

    const fetchUserAndOrganizations = async () => {
      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (isMounted) navigate('/auth');
          return;
        }
        if (isMounted) setUserId(user.id);

        // For admin users, fetch all organizations they have access to
        // Admins can see all organizations
        const { data: orgs, error } = await supabase
          .from('client_organizations')
          .select('id, name')
          .eq('is_active', true)
          .order('name');

        if (error) {
          console.error('Error fetching organizations:', error);
          return;
        }

        if (orgs && orgs.length > 0 && isMounted) {
          setOrganizations(orgs);
          // Auto-select the first organization
          setSelectedOrgId(orgs[0].id);
        }
      } catch (error) {
        console.error('Error in fetchUserAndOrganizations:', error);
      } finally {
        if (isMounted) setIsLoadingOrgs(false);
      }
    };

    if (!isAdminLoading && isAdmin) {
      fetchUserAndOrganizations();
    }

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate is stable from useNavigate
  }, [isAdmin, isAdminLoading]);

  // =========================================================================
  // Fetch ActBlue Forms for Selected Organization
  // =========================================================================

  useEffect(() => {
    let isMounted = true;

    const fetchActBlueForms = async () => {
      if (!selectedOrgId) {
        if (isMounted) {
          setActblueForms([]);
          setFormsError(null);
        }
        return;
      }

      if (isMounted) setIsLoadingForms(true);
      try {
        // Fetch distinct ActBlue form names from transactions for this organization
        // Using actblue_transactions_secure view (the canonical source)
        const { data, error } = await (supabase as any)
          .from('actblue_transactions_secure')
          .select('contribution_form')
          .eq('organization_id', selectedOrgId)
          .not('contribution_form', 'is', null)
          .limit(1000);

        if (error) {
          console.error('Error fetching ActBlue forms:', error);
          if (isMounted) {
            setFormsError('Failed to load ActBlue forms');
            setActblueForms([]);
          }
          return;
        }

        // Extract unique form names
        const uniqueForms = [...new Set(
          (data || [])
            .map((tx: { contribution_form: string | null }) => tx.contribution_form)
            .filter((form: string | null): form is string => Boolean(form))
        )].sort();

        if (isMounted) {
          setFormsError(null);
          setActblueForms(uniqueForms);
        }
      } catch (error) {
        console.error('Error in fetchActBlueForms:', error);
        if (isMounted) {
          setFormsError('Failed to load ActBlue forms');
          setActblueForms([]);
        }
      } finally {
        if (isMounted) setIsLoadingForms(false);
      }
    };

    fetchActBlueForms();

    return () => {
      isMounted = false;
    };
  }, [selectedOrgId]);

  // =========================================================================
  // Handlers
  // =========================================================================

  const handleOrganizationChange = useCallback((orgId: string) => {
    setSelectedOrgId(orgId);
    // Forms will be refetched via the useEffect above
  }, []);

  const handleBackToAdmin = useCallback(() => {
    navigate('/admin?tab=analytics');
  }, [navigate]);

  // =========================================================================
  // Loading State
  // =========================================================================

  if (isAdminLoading) {
    return (
      <div className="h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center" role="status" aria-live="polite">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-[#e2e8f0] font-medium">Loading...</p>
          <p className="text-[#64748b] text-sm mt-1">Checking permissions</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Access Denied
  // =========================================================================

  if (!isAdmin) {
    return (
      <div className="h-screen bg-[#0a0f1a] flex flex-col items-center justify-center p-4">
        <div className="bg-[#141b2d] border border-[#1e2a45] rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] mb-2">Access Denied</h1>
          <p className="text-[#64748b] mb-6">
            You don't have permission to access Ad Copy Studio. Please contact an administrator.
          </p>
          <Button
            onClick={() => navigate('/')}
            className="bg-[#1e2a45] hover:bg-[#2d3b55] text-[#e2e8f0] border-0"
          >
            Return Home
          </Button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Loading Organizations
  // =========================================================================

  if (isLoadingOrgs) {
    return (
      <div className="h-screen bg-[#0a0f1a] flex items-center justify-center">
        <div className="text-center" role="status" aria-live="polite">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
          <p className="text-[#e2e8f0] font-medium">Loading organizations...</p>
          <p className="text-[#64748b] text-sm mt-1">Please wait</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // No Organizations
  // =========================================================================

  if (organizations.length === 0) {
    return (
      <div className="h-screen bg-[#0a0f1a] flex flex-col items-center justify-center p-4">
        <div className="bg-[#141b2d] border border-[#1e2a45] rounded-2xl p-8 max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-amber-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#e2e8f0] mb-2">No Organizations</h1>
          <p className="text-[#64748b] mb-6">
            There are no active organizations available. Please create or activate an organization first.
          </p>
          <Button
            onClick={handleBackToAdmin}
            className="bg-[#1e2a45] hover:bg-[#2d3b55] text-[#e2e8f0] border-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Admin
          </Button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // Main Content
  // =========================================================================

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex flex-col">
      {/* Header */}
      <header className="bg-[#0a0f1a]/95 backdrop-blur-md border-b border-[#1e2a45] px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToAdmin}
            className="text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1e2a45] rounded-lg"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin
          </Button>
        </div>
        {isLoadingForms && (
          <div className="flex items-center gap-2 text-sm text-[#64748b]" role="status" aria-live="polite">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading forms...
          </div>
        )}
        {formsError && !isLoadingForms && (
          <div className="flex items-center gap-2 text-sm text-amber-500" role="alert">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {formsError}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {userId && selectedOrgId && (
          <AdCopyWizard
            organizationId={selectedOrgId}
            userId={userId}
            organizations={organizations}
            actblueForms={actblueForms}
            onOrganizationChange={handleOrganizationChange}
          />
        )}
      </main>
    </div>
  );
}
