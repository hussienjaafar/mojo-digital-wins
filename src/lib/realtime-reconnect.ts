/**
 * Realtime reconnection utilities with exponential backoff
 * Provides consistent reconnection behavior across all real-time hooks
 */

import { toast } from 'sonner';

export interface ReconnectConfig {
  initialDelayMs?: number;
  maxDelayMs?: number;
  maxRetries?: number;
  channelName: string;
}

export interface ReconnectState {
  retryCount: number;
  lastAttempt: Date | null;
  isReconnecting: boolean;
}

const DEFAULT_CONFIG: Required<Omit<ReconnectConfig, 'channelName'>> = {
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  maxRetries: 5,
};

/**
 * Calculate exponential backoff delay
 * Doubles each time: 1s, 2s, 4s, 8s, 16s, capped at maxDelay
 */
export function calculateBackoffDelay(
  retryCount: number,
  config: Partial<ReconnectConfig> = {}
): number {
  const { initialDelayMs, maxDelayMs } = { ...DEFAULT_CONFIG, ...config };
  const delay = initialDelayMs * Math.pow(2, retryCount);
  return Math.min(delay, maxDelayMs);
}

/**
 * Check if we should attempt reconnection
 */
export function shouldAttemptReconnect(
  retryCount: number,
  config: Partial<ReconnectConfig> = {}
): boolean {
  const { maxRetries } = { ...DEFAULT_CONFIG, ...config };
  return retryCount < maxRetries;
}

/**
 * Get human-readable time until next retry
 */
export function getRetryMessage(delayMs: number): string {
  const seconds = Math.ceil(delayMs / 1000);
  return seconds === 1 ? '1 second' : `${seconds} seconds`;
}

/**
 * Show reconnection toast notification
 */
export function showReconnectToast(
  channelName: string,
  status: 'disconnected' | 'reconnecting' | 'connected' | 'failed',
  retryInfo?: { retryCount: number; delayMs: number }
) {
  switch (status) {
    case 'disconnected':
      toast.warning(`${channelName} disconnected`, {
        description: retryInfo
          ? `Retrying in ${getRetryMessage(retryInfo.delayMs)}...`
          : 'Connection lost',
        duration: 5000,
      });
      break;
    case 'reconnecting':
      toast.info(`Reconnecting ${channelName}...`, {
        description: retryInfo
          ? `Attempt ${retryInfo.retryCount + 1}`
          : 'Attempting to reconnect',
        duration: 2000,
      });
      break;
    case 'connected':
      toast.success(`${channelName} connected`, {
        description: 'Real-time updates restored',
        duration: 3000,
      });
      break;
    case 'failed':
      toast.error(`${channelName} connection failed`, {
        description: 'Maximum retries reached. Please refresh the page.',
        duration: 10000,
      });
      break;
  }
}

/**
 * Create a reconnection handler for Supabase realtime channels
 * Returns a function that should be called on channel status changes
 */
export function createReconnectHandler(
  subscribeFunction: () => void,
  config: ReconnectConfig
) {
  const { initialDelayMs, maxDelayMs, maxRetries, channelName } = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  let retryCount = 0;
  let retryTimeout: ReturnType<typeof setTimeout> | null = null;
  let wasConnected = false;

  const cleanup = () => {
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      retryTimeout = null;
    }
  };

  const handleStatus = (status: string) => {
    if (status === 'SUBSCRIBED') {
      // Successfully connected
      if (retryCount > 0) {
        // This was a reconnection, show success
        showReconnectToast(channelName, 'connected');
      }
      retryCount = 0;
      wasConnected = true;
      cleanup();
      return 'connected' as const;
    }

    if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
      cleanup();

      if (!shouldAttemptReconnect(retryCount, { maxRetries })) {
        // Max retries reached
        showReconnectToast(channelName, 'failed');
        return 'failed' as const;
      }

      const delayMs = calculateBackoffDelay(retryCount, { initialDelayMs, maxDelayMs });

      // Only show toast if we were previously connected (avoid spam on initial failures)
      if (wasConnected || retryCount > 0) {
        showReconnectToast(channelName, 'disconnected', { retryCount, delayMs });
      }

      retryTimeout = setTimeout(() => {
        console.log(`🔄 Attempting to reconnect ${channelName} (attempt ${retryCount + 1})...`);
        retryCount++;
        subscribeFunction();
      }, delayMs);

      return 'disconnected' as const;
    }

    return 'connecting' as const;
  };

  return {
    handleStatus,
    cleanup,
    getRetryCount: () => retryCount,
    reset: () => {
      retryCount = 0;
      wasConnected = false;
      cleanup();
    },
  };
}
