/**
 * Permission Checker Utility
 *
 * Provides functions and hooks for checking user permissions in the frontend.
 * Works with the fine-grained permission system stored in Supabase.
 *
 * Permission format: 'category:action'
 * Categories: campaigns, analytics, users, settings, billing, integrations, intelligence, donations
 * Actions: view, create, edit, delete, send, export, invite, manage, remove, configure, view_pii
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// Types
// ============================================================================

export type PermissionCategory =
  | 'campaigns'
  | 'analytics'
  | 'users'
  | 'settings'
  | 'billing'
  | 'integrations'
  | 'intelligence'
  | 'donations';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'send'
  | 'export'
  | 'invite'
  | 'manage'
  | 'remove'
  | 'configure'
  | 'view_pii';

export type Permission = `${PermissionCategory}:${PermissionAction}`;

export interface UserPermission {
  permission_name: string;
  granted: boolean;
}

export interface PermissionCheckResult {
  hasPermission: boolean;
  isLoading: boolean;
  error: Error | null;
}

export interface PermissionsResult {
  permissions: Map<string, boolean>;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// ============================================================================
// Permission Constants
// ============================================================================

/**
 * All available permissions organized by category
 */
export const PERMISSIONS = {
  campaigns: {
    view: 'campaigns:view' as Permission,
    create: 'campaigns:create' as Permission,
    edit: 'campaigns:edit' as Permission,
    delete: 'campaigns:delete' as Permission,
    send: 'campaigns:send' as Permission,
  },
  analytics: {
    view: 'analytics:view' as Permission,
    export: 'analytics:export' as Permission,
  },
  users: {
    view: 'users:view' as Permission,
    invite: 'users:invite' as Permission,
    manage: 'users:manage' as Permission,
    remove: 'users:remove' as Permission,
  },
  settings: {
    view: 'settings:view' as Permission,
    edit: 'settings:edit' as Permission,
  },
  billing: {
    view: 'billing:view' as Permission,
    manage: 'billing:manage' as Permission,
  },
  integrations: {
    view: 'integrations:view' as Permission,
    manage: 'integrations:manage' as Permission,
  },
  intelligence: {
    view: 'intelligence:view' as Permission,
    configure: 'intelligence:configure' as Permission,
  },
  donations: {
    view: 'donations:view' as Permission,
    export: 'donations:export' as Permission,
    view_pii: 'donations:view_pii' as Permission,
  },
} as const;

// ============================================================================
// Core Functions
// ============================================================================

/**
 * Check if a user has a specific permission in an organization.
 * This is a direct function call to the database - prefer using the hook for React components.
 *
 * @param userId - The user's UUID
 * @param organizationId - The organization's UUID
 * @param permission - The permission to check (e.g., 'campaigns:create')
 * @returns Promise<boolean> - True if the user has the permission
 *
 * @example
 * const canCreate = await hasPermission(userId, orgId, 'campaigns:create');
 */
export async function hasPermission(
  userId: string,
  organizationId: string,
  permission: Permission | string
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('user_has_permission', {
      _user_id: userId,
      _organization_id: organizationId,
      _permission_name: permission,
    });

    if (error) {
      console.error('Error checking permission:', error);
      return false;
    }

    return Boolean(data);
  } catch (err) {
    console.error('Error checking permission:', err);
    return false;
  }
}

/**
 * Check if the current authenticated user has a specific permission.
 * Uses the simplified RPC that gets the user's organization automatically.
 *
 * @param permission - The permission to check
 * @returns Promise<boolean> - True if the user has the permission
 *
 * @example
 * const canEdit = await checkPermission('settings:edit');
 */
export async function checkPermission(permission: Permission | string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_permission', {
      _permission_name: permission,
    });

    if (error) {
      console.error('Error checking permission:', error);
      return false;
    }

    return Boolean(data);
  } catch (err) {
    console.error('Error checking permission:', err);
    return false;
  }
}

/**
 * Get all permissions for the current user.
 *
 * @returns Promise<Map<string, boolean>> - Map of permission names to granted status
 *
 * @example
 * const permissions = await getAllPermissions();
 * if (permissions.get('campaigns:create')) {
 *   // Show create button
 * }
 */
export async function getAllPermissions(): Promise<Map<string, boolean>> {
  const permissionsMap = new Map<string, boolean>();

  try {
    const { data, error } = await supabase.rpc('get_user_permissions');

    if (error) {
      console.error('Error fetching permissions:', error);
      return permissionsMap;
    }

    if (data && Array.isArray(data)) {
      data.forEach((p: UserPermission) => {
        permissionsMap.set(p.permission_name, p.granted);
      });
    }

    return permissionsMap;
  } catch (err) {
    console.error('Error fetching permissions:', err);
    return permissionsMap;
  }
}

// ============================================================================
// React Hooks
// ============================================================================

/**
 * Hook to check if the current user has a specific permission.
 *
 * @param permission - The permission to check
 * @returns PermissionCheckResult with hasPermission, isLoading, and error
 *
 * @example
 * function CreateCampaignButton() {
 *   const { hasPermission, isLoading } = usePermission('campaigns:create');
 *
 *   if (isLoading) return <Spinner />;
 *   if (!hasPermission) return null;
 *
 *   return <Button>Create Campaign</Button>;
 * }
 */
export function usePermission(permission: Permission | string): PermissionCheckResult {
  const [hasPermission, setHasPermission] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    const check = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await checkPermission(permission);
        if (isMounted) {
          setHasPermission(result);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
          setHasPermission(false);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    check();

    // Re-check on auth state change
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      check();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [permission]);

  return { hasPermission, isLoading, error };
}

/**
 * Hook to check multiple permissions at once.
 *
 * @param permissions - Array of permissions to check
 * @returns Object with permission results keyed by permission name
 *
 * @example
 * function CampaignActions() {
 *   const perms = usePermissions(['campaigns:edit', 'campaigns:delete']);
 *
 *   return (
 *     <>
 *       {perms['campaigns:edit']?.hasPermission && <EditButton />}
 *       {perms['campaigns:delete']?.hasPermission && <DeleteButton />}
 *     </>
 *   );
 * }
 */
export function useMultiplePermissions(
  permissions: (Permission | string)[]
): Record<string, PermissionCheckResult> {
  const [results, setResults] = useState<Record<string, PermissionCheckResult>>(() => {
    const initial: Record<string, PermissionCheckResult> = {};
    permissions.forEach((p) => {
      initial[p] = { hasPermission: false, isLoading: true, error: null };
    });
    return initial;
  });

  useEffect(() => {
    let isMounted = true;

    const checkAll = async () => {
      const newResults: Record<string, PermissionCheckResult> = {};

      await Promise.all(
        permissions.map(async (permission) => {
          try {
            const hasPermission = await checkPermission(permission);
            newResults[permission] = { hasPermission, isLoading: false, error: null };
          } catch (err) {
            newResults[permission] = {
              hasPermission: false,
              isLoading: false,
              error: err instanceof Error ? err : new Error('Unknown error'),
            };
          }
        })
      );

      if (isMounted) {
        setResults(newResults);
      }
    };

    checkAll();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAll();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [permissions.join(',')]);

  return results;
}

/**
 * Hook to get all permissions for the current user.
 * Useful for building permission-aware UIs where many permissions need to be checked.
 *
 * @returns PermissionsResult with permissions map, isLoading, error, and refresh function
 *
 * @example
 * function SettingsPage() {
 *   const { permissions, isLoading, refresh } = usePermissions();
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <>
 *       {permissions.get('settings:view') && <ViewSettings />}
 *       {permissions.get('settings:edit') && <EditSettings />}
 *       <Button onClick={refresh}>Refresh Permissions</Button>
 *     </>
 *   );
 * }
 */
export function usePermissions(): PermissionsResult {
  const [permissions, setPermissions] = useState<Map<string, boolean>>(new Map());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const perms = await getAllPermissions();
      setPermissions(perms);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const perms = await getAllPermissions();
        if (isMounted) {
          setPermissions(perms);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err : new Error('Unknown error'));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load();
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { permissions, isLoading, error, refresh };
}

// ============================================================================
// React Components
// ============================================================================

interface PermissionGateProps {
  /** The permission(s) required to render children */
  permission: Permission | string | (Permission | string)[];
  /** How to combine multiple permissions: 'all' requires all, 'any' requires at least one */
  mode?: 'all' | 'any';
  /** Content to render when user has permission */
  children: React.ReactNode;
  /** Content to render when user lacks permission (optional) */
  fallback?: React.ReactNode;
  /** Content to render while checking permissions (optional) */
  loading?: React.ReactNode;
}

/**
 * Component that conditionally renders children based on user permissions.
 *
 * @example
 * // Single permission
 * <PermissionGate permission="campaigns:create">
 *   <CreateCampaignButton />
 * </PermissionGate>
 *
 * @example
 * // Multiple permissions (all required)
 * <PermissionGate permission={['users:view', 'users:manage']} mode="all">
 *   <UserManagement />
 * </PermissionGate>
 *
 * @example
 * // With fallback
 * <PermissionGate
 *   permission="billing:manage"
 *   fallback={<p>Contact admin for billing access</p>}
 * >
 *   <BillingSettings />
 * </PermissionGate>
 */
export function PermissionGate({
  permission,
  mode = 'all',
  children,
  fallback = null,
  loading = null,
}: PermissionGateProps): React.ReactNode {
  const permissions = Array.isArray(permission) ? permission : [permission];
  const results = useMultiplePermissions(permissions);

  // Check if any permission is still loading
  const isLoading = useMemo(
    () => Object.values(results).some((r) => r.isLoading),
    [results]
  );

  // Check if user has required permissions
  const hasAccess = useMemo(() => {
    const checks = permissions.map((p) => results[p]?.hasPermission ?? false);

    if (mode === 'all') {
      return checks.every(Boolean);
    } else {
      return checks.some(Boolean);
    }
  }, [results, permissions, mode]);

  if (isLoading) {
    return loading;
  }

  if (!hasAccess) {
    return fallback;
  }

  return children;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a permission string is valid.
 *
 * @param permission - The permission string to validate
 * @returns boolean - True if the permission format is valid
 */
export function isValidPermission(permission: string): permission is Permission {
  const parts = permission.split(':');
  if (parts.length !== 2) return false;

  const [category, action] = parts;
  const validCategories = Object.keys(PERMISSIONS);
  const validActions = [
    'view',
    'create',
    'edit',
    'delete',
    'send',
    'export',
    'invite',
    'manage',
    'remove',
    'configure',
    'view_pii',
  ];

  return validCategories.includes(category) && validActions.includes(action);
}

/**
 * Get all permissions for a category.
 *
 * @param category - The permission category
 * @returns Array of permission strings for that category
 *
 * @example
 * const campaignPermissions = getPermissionsForCategory('campaigns');
 * // ['campaigns:view', 'campaigns:create', 'campaigns:edit', 'campaigns:delete', 'campaigns:send']
 */
export function getPermissionsForCategory(category: PermissionCategory): Permission[] {
  const categoryPerms = PERMISSIONS[category];
  if (!categoryPerms) return [];
  return Object.values(categoryPerms) as Permission[];
}

/**
 * Parse a permission string into its category and action.
 *
 * @param permission - The permission string
 * @returns Object with category and action, or null if invalid
 */
export function parsePermission(
  permission: string
): { category: PermissionCategory; action: PermissionAction } | null {
  if (!isValidPermission(permission)) return null;

  const [category, action] = permission.split(':') as [PermissionCategory, PermissionAction];
  return { category, action };
}
