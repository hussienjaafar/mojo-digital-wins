import { useState, useEffect, useCallback, useRef } from 'react';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// ============================================================================
// Types
// ============================================================================

export interface SessionManagerState {
  session: Session | null;
  isLoading: boolean;
  isExpiring: boolean; // true when < 5 min left
  expiresAt: Date | null;
  timeUntilExpiry: number | null; // seconds remaining
  refreshSession: () => Promise<void>;
  signOut: () => Promise<void>;
}

interface SessionManagerOptions {
  /** Time before expiry to show warning (in seconds). Default: 300 (5 minutes) */
  warningThreshold?: number;
  /** Callback when session is about to expire */
  onSessionExpiring?: () => void;
  /** Callback when session expires */
  onSessionExpired?: () => void;
  /** Callback when session is refreshed */
  onSessionRefreshed?: () => void;
  /** Callback when refresh fails */
  onRefreshError?: (error: Error) => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_WARNING_THRESHOLD = 300; // 5 minutes in seconds
const EXPIRY_CHECK_INTERVAL = 30000; // Check every 30 seconds
const MIN_REFRESH_INTERVAL = 60000; // Don't refresh more than once per minute
const SESSION_HEARTBEAT_INTERVAL = 300000; // Update session activity every 5 minutes

// ============================================================================
// Hook
// ============================================================================

export function useSessionManager(options: SessionManagerOptions = {}): SessionManagerState {
  const {
    warningThreshold = DEFAULT_WARNING_THRESHOLD,
    onSessionExpiring,
    onSessionExpired,
    onSessionRefreshed,
    onRefreshError,
  } = options;

  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpiring, setIsExpiring] = useState(false);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number | null>(null);

  const lastRefreshAttempt = useRef<number>(0);
  const hasShownExpiryWarning = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================================
  // Session Expiry Calculation
  // ============================================================================

  const calculateExpiryInfo = useCallback((currentSession: Session | null) => {
    if (!currentSession?.expires_at) {
      setExpiresAt(null);
      setTimeUntilExpiry(null);
      setIsExpiring(false);
      return;
    }

    const expiryTime = new Date(currentSession.expires_at * 1000);
    const now = new Date();
    const secondsRemaining = Math.floor((expiryTime.getTime() - now.getTime()) / 1000);

    setExpiresAt(expiryTime);
    setTimeUntilExpiry(secondsRemaining > 0 ? secondsRemaining : 0);

    const expiring = secondsRemaining > 0 && secondsRemaining <= warningThreshold;

    // Only trigger callback once when entering expiring state
    if (expiring && !hasShownExpiryWarning.current) {
      hasShownExpiryWarning.current = true;
      setIsExpiring(true);
      onSessionExpiring?.();
    } else if (!expiring && secondsRemaining > warningThreshold) {
      // Reset warning flag when session is refreshed
      hasShownExpiryWarning.current = false;
      setIsExpiring(false);
    }

    // Handle expired session
    if (secondsRemaining <= 0) {
      onSessionExpired?.();
    }
  }, [warningThreshold, onSessionExpiring, onSessionExpired]);

  // ============================================================================
  // Session Refresh
  // ============================================================================

  const refreshSession = useCallback(async () => {
    const now = Date.now();

    // Prevent rapid refresh attempts
    if (now - lastRefreshAttempt.current < MIN_REFRESH_INTERVAL) {
      if (import.meta.env.DEV) {
        console.log('[SessionManager] Skipping refresh - too soon since last attempt');
      }
      return;
    }

    lastRefreshAttempt.current = now;

    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        throw error;
      }

      if (data.session) {
        setSession(data.session);
        calculateExpiryInfo(data.session);
        hasShownExpiryWarning.current = false;
        setIsExpiring(false);
        onSessionRefreshed?.();

        if (import.meta.env.DEV) {
          console.log('[SessionManager] Session refreshed successfully');
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[SessionManager] Failed to refresh session:', error);
      }
      onRefreshError?.(error instanceof Error ? error : new Error('Failed to refresh session'));
    }
  }, [calculateExpiryInfo, onSessionRefreshed, onRefreshError]);

  // ============================================================================
  // Sign Out - with session end tracking
  // ============================================================================

  const signOut = useCallback(async () => {
    try {
      // Clear interval before signing out
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }

      // Track session end before signing out (non-blocking)
      if (session?.user?.id) {
        try {
          // Get the current session ID from localStorage if stored
          const currentSessionId = localStorage.getItem('currentSessionId');
          if (currentSessionId) {
            await supabase.rpc('end_user_session', { 
              p_session_id: currentSessionId 
            });
            localStorage.removeItem('currentSessionId');
          }
        } catch (e) {
          // Non-blocking - don't fail sign out if tracking fails
          if (import.meta.env.DEV) {
            console.warn('[SessionManager] Failed to track session end:', e);
          }
        }
      }

      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      // Clear local state
      setSession(null);
      setExpiresAt(null);
      setTimeUntilExpiry(null);
      setIsExpiring(false);
      hasShownExpiryWarning.current = false;

      // Clear localStorage
      localStorage.removeItem('selectedOrganizationId');

      if (import.meta.env.DEV) {
        console.log('[SessionManager] Signed out successfully');
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('[SessionManager] Sign out error:', error);
      }
      throw error;
    }
  }, [session]);

  // ============================================================================
  // Auth State Listener
  // ============================================================================

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession: Session | null) => {
        if (import.meta.env.DEV) {
          console.log('[SessionManager] Auth state changed:', event);
        }

        setSession(newSession);
        calculateExpiryInfo(newSession);

        // Handle specific auth events
        switch (event) {
          case 'SIGNED_IN':
            hasShownExpiryWarning.current = false;
            setIsExpiring(false);
            setIsLoading(false);
            break;
          case 'SIGNED_OUT':
            setExpiresAt(null);
            setTimeUntilExpiry(null);
            setIsExpiring(false);
            hasShownExpiryWarning.current = false;
            setIsLoading(false);
            break;
          case 'TOKEN_REFRESHED':
            hasShownExpiryWarning.current = false;
            setIsExpiring(false);
            onSessionRefreshed?.();
            break;
          case 'USER_UPDATED':
            // Session might have changed
            break;
          default:
            break;
        }
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      calculateExpiryInfo(initialSession);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [calculateExpiryInfo, onSessionRefreshed]);

  // ============================================================================
  // Expiry Check Interval
  // ============================================================================

  useEffect(() => {
    // Start checking expiry periodically
    checkIntervalRef.current = setInterval(() => {
      if (session) {
        calculateExpiryInfo(session);

        // Auto-refresh if session is expiring soon
        if (timeUntilExpiry !== null && timeUntilExpiry > 0 && timeUntilExpiry <= warningThreshold) {
          refreshSession();
        }
      }
    }, EXPIRY_CHECK_INTERVAL);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
    };
  }, [session, timeUntilExpiry, warningThreshold, calculateExpiryInfo, refreshSession]);

  // ============================================================================
  // Session Heartbeat - Update session activity periodically
  // ============================================================================

  useEffect(() => {
    if (!session?.user?.id) {
      return;
    }

    const heartbeatInterval = setInterval(async () => {
      try {
        const currentSessionId = localStorage.getItem('currentSessionId');
        if (currentSessionId) {
          await supabase.rpc('update_session_activity', {
            p_session_id: currentSessionId,
          });
          if (import.meta.env.DEV) {
            console.log('[SessionManager] Session heartbeat sent');
          }
        }
      } catch (e) {
        // Non-blocking - don't fail if heartbeat fails
        if (import.meta.env.DEV) {
          console.warn('[SessionManager] Heartbeat failed:', e);
        }
      }
    }, SESSION_HEARTBEAT_INTERVAL);

    return () => {
      clearInterval(heartbeatInterval);
    };
  }, [session?.user?.id]);

  // ============================================================================
  // Return State
  // ============================================================================

  return {
    session,
    isLoading,
    isExpiring,
    expiresAt,
    timeUntilExpiry,
    refreshSession,
    signOut,
  };
}

// ============================================================================
// Utility: Format time remaining for display
// ============================================================================

export function formatTimeRemaining(seconds: number | null): string {
  if (seconds === null || seconds <= 0) {
    return 'Session expired';
  }

  if (seconds < 60) {
    return `${seconds} seconds`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes} minutes`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours} hours`;
}
