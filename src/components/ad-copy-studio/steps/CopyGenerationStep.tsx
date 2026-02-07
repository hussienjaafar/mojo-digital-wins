/**
 * CopyGenerationStep - Step 4 of the Ad Copy Studio wizard
 *
 * Displays generation summary and triggers AI copy generation.
 */

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft,
  Sparkles,
  Users,
  Layers,
  FileText,
  Hash,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { CampaignConfig } from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface CopyGenerationStepProps {
  config: CampaignConfig;
  isGenerating: boolean;
  progress: number;
  currentSegment?: string;
  error: string | null;
  onGenerate: () => Promise<void>;
  onBack: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const VARIATIONS_PER_ELEMENT = 5;
const ELEMENTS = ['Primary Text', 'Headline', 'Description'];

// =============================================================================
// Helper Components
// =============================================================================

interface SummaryItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  highlight?: boolean;
}

function SummaryItem({ icon, label, value, highlight = false }: SummaryItemProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#1e2a45] last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="text-[#94a3b8]">{icon}</span>
        <span className="text-sm text-[#94a3b8]">{label}</span>
      </div>
      <span
        className={cn(
          'text-sm font-medium',
          highlight ? 'text-blue-400' : 'text-[#e2e8f0]'
        )}
      >
        {value}
      </span>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function CopyGenerationStep({
  config,
  isGenerating,
  progress,
  currentSegment,
  error,
  onGenerate,
  onBack,
}: CopyGenerationStepProps) {
  const segmentCount = config.audience_segments.length;
  const totalVariations = segmentCount * VARIATIONS_PER_ELEMENT;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-[#e2e8f0]">Generate Ad Copy</h2>
        <p className="mt-2 text-[#94a3b8]">
          Review your settings and generate personalized ad copy
        </p>
      </div>

      {/* Summary Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-[#1e2a45] bg-[#0a0f1a] overflow-hidden"
      >
        <div className="border-b border-[#1e2a45] px-6 py-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-400" />
            <span className="text-sm font-medium uppercase tracking-wider text-[#64748b]">
              Generation Summary
            </span>
          </div>
        </div>

        <div className="px-6 py-2">
          <SummaryItem
            icon={<Users className="h-4 w-4" />}
            label="Audiences"
            value={`${segmentCount} segment${segmentCount !== 1 ? 's' : ''}`}
          />
          <SummaryItem
            icon={<Layers className="h-4 w-4" />}
            label="Variations per segment"
            value={`${VARIATIONS_PER_ELEMENT} complete ad sets`}
          />
          <SummaryItem
            icon={<FileText className="h-4 w-4" />}
            label="Each variation includes"
            value={ELEMENTS.join(' + ')}
          />
          <SummaryItem
            icon={<Hash className="h-4 w-4" />}
            label="Total variations"
            value={`${totalVariations} ad sets`}
            highlight
          />
        </div>

        {/* Audience Segment List */}
        <div className="border-t border-[#1e2a45] px-6 py-4">
          <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
            Target Audiences
          </span>
          <div className="mt-3 flex flex-wrap gap-2">
            {config.audience_segments.map((segment) => (
              <span
                key={segment.id}
                className={cn(
                  'inline-flex items-center rounded-full border px-3 py-1 text-xs',
                  currentSegment === segment.name
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                    : 'bg-[#141b2d] border-[#1e2a45] text-[#94a3b8]'
                )}
              >
                {segment.name}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Generation State */}
      <AnimatePresence mode="wait">
        {isGenerating ? (
          <motion.div
            key="generating"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-xl border border-[#1e2a45] bg-[#141b2d] p-8"
          >
            <div className="flex flex-col items-center gap-6">
              {/* Animated Icon */}
              <div className="relative">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  className="h-16 w-16 rounded-full border-2 border-blue-500/30 flex items-center justify-center"
                >
                  <Sparkles className="h-8 w-8 text-blue-400" />
                </motion.div>
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-blue-500"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
              </div>

              {/* Progress Text */}
              <div className="text-center">
                <p className="text-lg font-medium text-[#e2e8f0]">Generating...</p>
                {currentSegment && (
                  <p className="mt-1 text-sm text-[#94a3b8]">
                    Generating copy for: <span className="text-blue-400">{currentSegment}</span>
                  </p>
                )}
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md">
                <Progress
                  value={progress}
                  className="h-3 bg-[#1e2a45]"
                  indicatorClassName="bg-blue-500 transition-all duration-500"
                />
                <p className="mt-2 text-center text-sm text-[#64748b]">{progress}%</p>
                <p className="mt-1 text-center text-xs text-[#64748b]">
                  Estimated time: ~{segmentCount * 30} seconds ({segmentCount} segment{segmentCount !== 1 ? 's' : ''} × ~30s each)
                </p>
              </div>
            </div>
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-xl border border-[#ef4444]/30 bg-[#ef4444]/10 p-8"
          >
            <div className="flex flex-col items-center gap-4">
              <AlertCircle className="h-12 w-12 text-[#ef4444]" />
              <div className="text-center">
                <p className="text-lg font-medium text-[#ef4444]">Generation Failed</p>
                <p className="mt-1 text-sm text-[#ef4444]/80">{error}</p>
              </div>
              <Button
                type="button"
                onClick={onGenerate}
                className="gap-2 bg-[#ef4444] hover:bg-[#ef4444]/80 text-white"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="ready"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex justify-center py-8"
          >
            {/* Issue E3: Proportional button sizing */}
            <Button
              type="button"
              onClick={onGenerate}
              disabled={segmentCount === 0}
              size="lg"
              className={cn(
                'gap-3 px-6 py-3 text-base font-medium transition-all',
                segmentCount > 0
                  ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
                  : 'bg-[#1e2a45] text-[#64748b] cursor-not-allowed'
              )}
            >
              <Sparkles className="h-5 w-5" />
              Generate Copy
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <div className="flex items-center justify-start pt-4 border-t border-[#1e2a45]">
        <Button
          type="button"
          onClick={onBack}
          disabled={isGenerating}
          variant="outline"
          className={cn(
            'gap-2 bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]',
            isGenerating && 'opacity-50 cursor-not-allowed'
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>
    </div>
  );
}

export default CopyGenerationStep;
