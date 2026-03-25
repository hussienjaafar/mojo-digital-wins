/**
 * CopyVariationCard - Displays a single copy variation with clipboard functionality
 *
 * Features:
 * - Shows variation text with index number
 * - Character count with color coding (green/yellow/red)
 * - Copy button with checkmark animation
 * - Smooth entry animation
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Copy, CheckCircle } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface CopyVariationCardProps {
  index: number;
  text: string;
  charCount: number;
  maxRecommended: number;
  maxAllowed: number;
  /**
   * Called when the copy button is clicked.
   * Can be async - the component will handle errors gracefully.
   * Success feedback (copied state) is managed by the parent component.
   */
  onCopy: () => void | Promise<void>;
  copied: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getCharCountColor(count: number, maxRecommended: number, maxAllowed: number): string {
  if (count <= maxRecommended) return 'text-[#22c55e]'; // green
  if (count <= maxAllowed) return 'text-[#f97316]'; // orange/yellow
  return 'text-[#ef4444]'; // red
}

function getCharCountBgColor(count: number, maxRecommended: number, maxAllowed: number): string {
  if (count <= maxRecommended) return 'bg-[#22c55e]/10';
  if (count <= maxAllowed) return 'bg-[#f97316]/10';
  return 'bg-[#ef4444]/10';
}

// =============================================================================
// Component
// =============================================================================

export function CopyVariationCard({
  index,
  text,
  charCount,
  maxRecommended,
  maxAllowed,
  onCopy,
  copied,
}: CopyVariationCardProps) {
  const charColor = getCharCountColor(charCount, maxRecommended, maxAllowed);
  const charBgColor = getCharCountBgColor(charCount, maxRecommended, maxAllowed);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg border border-[#1e2a45] bg-[#141b2d] p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {/* Index badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e2a45] text-xs font-medium text-[#94a3b8]">
              {index + 1}
            </span>
          </div>

          {/* Copy text */}
          <p className="text-sm text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {/* Character count badge */}
          <span
            className={cn(
              'text-xs font-medium tabular-nums px-2 py-0.5 rounded-full',
              charColor,
              charBgColor
            )}
          >
            {charCount} / {maxAllowed}
          </span>

          {/* Copy button */}
          <button
            type="button"
            onClick={async () => {
              try {
                await onCopy();
              } catch (error) {
                console.error('Failed to copy:', error);
              }
            }}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-all duration-200',
              copied
                ? 'bg-[#22c55e]/20 text-[#22c55e] border border-[#22c55e]/30'
                : 'bg-[#1e2a45] text-[#94a3b8] hover:bg-[#2d3b55] hover:text-[#e2e8f0] border border-transparent'
            )}
            aria-label={copied ? 'Copied to clipboard' : 'Copy to clipboard'}
          >
            {copied ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1.5"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Copied
              </motion.div>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Character limit warning */}
      {charCount > maxAllowed && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-3 text-xs text-[#ef4444] flex items-center gap-1.5"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
          Exceeds maximum character limit by {charCount - maxAllowed} characters
        </motion.p>
      )}
    </motion.div>
  );
}

export default CopyVariationCard;
