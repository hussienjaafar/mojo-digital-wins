/**
 * ImportErrorCard - Shows import error with suggestions and actions
 *
 * Features:
 * - Red error styling with icon
 * - Error message display
 * - Suggestion text for resolution
 * - Dismiss and retry buttons
 * - Animated entry/exit
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AlertCircle, X, RefreshCw, Lightbulb } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface ImportErrorCardProps {
  error: string;
  suggestion?: string;
  onDismiss?: () => void;
  onRetry?: () => void;
  isRetrying?: boolean;
}

// =============================================================================
// Component
// =============================================================================

export function ImportErrorCard({
  error,
  suggestion,
  onDismiss,
  onRetry,
  isRetrying = false,
}: ImportErrorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 overflow-hidden"
      role="alert"
      aria-live="polite"
    >
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-4">
        {/* Error Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ef4444]/20">
            <AlertCircle className="h-4 w-4 text-[#ef4444]" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-[#ef4444]">Import Failed</h4>
          <p className="mt-1 text-sm text-[#ef4444]/90">{error}</p>

          {/* Suggestion */}
          {suggestion && (
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-[#0a0f1a]/50 border border-[#1e2a45] px-3 py-2.5">
              <Lightbulb className="h-4 w-4 text-[#f97316] flex-shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-medium text-[#f97316] uppercase tracking-wider">
                  Suggestion
                </span>
                <p className="mt-0.5 text-sm text-[#94a3b8]">{suggestion}</p>
              </div>
            </div>
          )}
        </div>

        {/* Dismiss Button */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="flex-shrink-0 rounded-md p-1.5 text-[#ef4444]/60 hover:bg-[#ef4444]/20 hover:text-[#ef4444] transition-colors"
            aria-label="Dismiss error"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Actions */}
      {(onRetry || onDismiss) && (
        <div className="flex items-center justify-end gap-2 border-t border-[#ef4444]/20 bg-[#ef4444]/5 px-4 py-3">
          {onDismiss && (
            <Button
              type="button"
              onClick={onDismiss}
              variant="outline"
              size="sm"
              className="bg-transparent border-[#ef4444]/30 text-[#ef4444] hover:bg-[#ef4444]/10 hover:border-[#ef4444]/50"
            >
              Dismiss
            </Button>
          )}
          {onRetry && (
            <Button
              type="button"
              onClick={onRetry}
              disabled={isRetrying}
              size="sm"
              className={cn(
                'gap-1.5',
                isRetrying
                  ? 'bg-[#ef4444]/50 text-white cursor-not-allowed'
                  : 'bg-[#ef4444] hover:bg-[#ef4444]/90 text-white'
              )}
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try Again
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default ImportErrorCard;
