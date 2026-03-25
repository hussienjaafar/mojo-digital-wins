/**
 * TrackingUrlPreview - Shows the generated ActBlue tracking URL
 *
 * Features:
 * - Displays the full tracking URL
 * - Copy button with feedback
 * - Breakdown of URL components (form name, refcode)
 * - Visual indicator of URL structure
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Link, Copy, CheckCircle, ExternalLink } from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface TrackingUrlPreviewProps {
  trackingUrl: string;
  refcode: string;
  formName: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Parse URL components for display
 */
function parseUrlComponents(url: string): { base: string; params: Record<string, string> } {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return {
      base: `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`,
      params,
    };
  } catch {
    return { base: url, params: {} };
  }
}

// =============================================================================
// Component
// =============================================================================

export function TrackingUrlPreview({
  trackingUrl,
  refcode,
  formName,
}: TrackingUrlPreviewProps) {
  const [copied, setCopied] = useState(false);

  const { base, params } = parseUrlComponents(trackingUrl);

  // =========================================================================
  // Handlers
  // =========================================================================

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      // Could show error toast here
    }
  }, [trackingUrl]);

  const handleOpenUrl = useCallback(() => {
    window.open(trackingUrl, '_blank', 'noopener,noreferrer');
  }, [trackingUrl]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="rounded-xl border border-[#1e2a45] bg-[#0a0f1a] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e2a45] px-4 py-3">
        <div className="flex items-center gap-2">
          <Link className="h-4 w-4 text-[#94a3b8]" />
          <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
            Tracking URL
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleOpenUrl}
            className="flex items-center gap-1.5 text-xs text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Open
          </button>
        </div>
      </div>

      {/* URL Display */}
      <div className="p-4 space-y-4">
        {/* Full URL */}
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded-lg bg-[#141b2d] border border-[#1e2a45] px-4 py-3 text-sm text-[#e2e8f0] font-mono overflow-x-auto whitespace-nowrap">
            {trackingUrl}
          </code>
          <Button
            type="button"
            onClick={handleCopy}
            size="sm"
            className={cn(
              'flex-shrink-0 gap-1.5 transition-all duration-200',
              copied
                ? 'bg-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/20 border border-[#22c55e]/30'
                : 'bg-[#1e2a45] text-[#e2e8f0] hover:bg-[#2d3b55] border border-transparent'
            )}
          >
            {copied ? (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1.5"
              >
                <CheckCircle className="h-4 w-4" />
                Copied
              </motion.div>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        </div>

        {/* URL Components Breakdown */}
        <div className="rounded-lg border border-[#1e2a45] bg-[#141b2d] p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-[#64748b] block mb-3">
            URL Components
          </span>

          <div className="space-y-3">
            {/* Base URL */}
            <div className="flex items-start gap-3">
              <span className="text-xs text-[#64748b] w-20 flex-shrink-0 pt-0.5">Base URL</span>
              <code className="text-sm text-[#94a3b8] font-mono break-all">{base}</code>
            </div>

            {/* Form Name */}
            <div className="flex items-start gap-3">
              <span className="text-xs text-[#64748b] w-20 flex-shrink-0 pt-0.5">Form Name</span>
              <div className="flex items-center gap-2">
                <code className="text-sm text-blue-400 font-mono">{formName}</code>
                <span className="inline-flex rounded-full bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-xs text-blue-400">
                  ActBlue Form
                </span>
              </div>
            </div>

            {/* Refcode */}
            <div className="flex items-start gap-3">
              <span className="text-xs text-[#64748b] w-20 flex-shrink-0 pt-0.5">Refcode</span>
              <div className="flex items-center gap-2">
                <code className="text-sm text-[#22c55e] font-mono">{refcode}</code>
                <span className="inline-flex rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 px-2 py-0.5 text-xs text-[#22c55e]">
                  Tracking
                </span>
              </div>
            </div>

            {/* Additional Params */}
            {Object.entries(params).map(([key, value]) => {
              // Skip refcode if it's already shown
              if (key === 'refcode') return null;
              return (
                <div key={key} className="flex items-start gap-3">
                  <span className="text-xs text-[#64748b] w-20 flex-shrink-0 pt-0.5">{key}</span>
                  <code className="text-sm text-[#94a3b8] font-mono break-all">{value}</code>
                </div>
              );
            })}
          </div>
        </div>

        {/* Usage Tip */}
        <p className="text-xs text-[#64748b]">
          Use this URL as the destination for your Meta ads. The refcode will track donations from this campaign.
        </p>
      </div>
    </div>
  );
}

export default TrackingUrlPreview;
