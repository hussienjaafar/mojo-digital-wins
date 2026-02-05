/**
 * CopyExportStep - Step 5 of the Ad Copy Studio wizard
 *
 * Final step to review and export generated ad copy.
 *
 * Features:
 * - Tabs for each audience segment
 * - Copy sections: Primary Text, Headlines, Descriptions
 * - Each variation shows text, character count, copy button
 * - Tracking URL with copy button
 * - Export options: Copy All, Download CSV, Start New
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Copy,
  Download,
  RefreshCw,
  Link,
  CheckCircle,
  FileText,
  Type,
  AlignLeft,
} from 'lucide-react';
import type {
  GeneratedCopy,
  MetaReadyCopy,
  AudienceSegment,
} from '@/types/ad-copy-studio';
import { META_COPY_LIMITS } from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface CopyExportStepProps {
  generatedCopy: GeneratedCopy;
  metaReadyCopy: MetaReadyCopy;
  trackingUrl: string;
  audienceSegments: AudienceSegment[];
  onBack: () => void;
  onStartNew: () => void;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getCharCountColor(count: number, maxRecommended: number, maxAllowed: number): string {
  if (count <= maxRecommended) return 'text-[#22c55e]';
  if (count <= maxAllowed) return 'text-[#f97316]';
  return 'text-[#ef4444]';
}

function formatCopyForClipboard(
  generatedCopy: GeneratedCopy,
  audienceSegments: AudienceSegment[],
  trackingUrl: string
): string {
  let output = '';

  for (const segment of audienceSegments) {
    const copy = generatedCopy[segment.name];
    if (!copy) continue;

    output += `=== ${segment.name.toUpperCase()} ===\n\n`;

    output += 'PRIMARY TEXT:\n';
    copy.primary_texts.forEach((text, i) => {
      output += `${i + 1}. ${text}\n`;
    });
    output += '\n';

    output += 'HEADLINES:\n';
    copy.headlines.forEach((text, i) => {
      output += `${i + 1}. ${text}\n`;
    });
    output += '\n';

    output += 'DESCRIPTIONS:\n';
    copy.descriptions.forEach((text, i) => {
      output += `${i + 1}. ${text}\n`;
    });
    output += '\n\n';
  }

  output += `TRACKING URL:\n${trackingUrl}\n`;

  return output;
}

function generateCSV(
  generatedCopy: GeneratedCopy,
  audienceSegments: AudienceSegment[],
  trackingUrl: string
): string {
  const rows: string[][] = [
    ['Audience', 'Element', 'Variation', 'Copy', 'Character Count', 'Tracking URL'],
  ];

  for (const segment of audienceSegments) {
    const copy = generatedCopy[segment.name];
    if (!copy) continue;

    copy.primary_texts.forEach((text, i) => {
      rows.push([segment.name, 'Primary Text', String(i + 1), text, String(text.length), trackingUrl]);
    });

    copy.headlines.forEach((text, i) => {
      rows.push([segment.name, 'Headline', String(i + 1), text, String(text.length), '']);
    });

    copy.descriptions.forEach((text, i) => {
      rows.push([segment.name, 'Description', String(i + 1), text, String(text.length), '']);
    });
  }

  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
}

// =============================================================================
// Helper Components
// =============================================================================

interface CopyVariationProps {
  index: number;
  text: string;
  charCount: number;
  maxRecommended: number;
  maxAllowed: number;
  onCopy: () => void;
  copied: boolean;
}

function CopyVariation({
  index,
  text,
  charCount,
  maxRecommended,
  maxAllowed,
  onCopy,
  copied,
}: CopyVariationProps) {
  const charColor = getCharCountColor(charCount, maxRecommended, maxAllowed);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded-lg border border-[#1e2a45] bg-[#141b2d] p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1e2a45] text-xs font-medium text-[#94a3b8]">
              {index + 1}
            </span>
          </div>
          <p className="text-sm text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">{text}</p>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={cn('text-xs font-medium tabular-nums', charColor)}>
            {charCount} chars
          </span>
          <button
            type="button"
            onClick={onCopy}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors',
              copied
                ? 'bg-[#22c55e]/20 text-[#22c55e]'
                : 'bg-[#1e2a45] text-[#94a3b8] hover:bg-[#2d3b55] hover:text-[#e2e8f0]'
            )}
          >
            {copied ? (
              <>
                <CheckCircle className="h-3.5 w-3.5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

interface CopySectionProps {
  title: string;
  icon: React.ReactNode;
  maxRecommended: number;
  maxAllowed: number;
  copies: string[];
  copiedIndex: number | null;
  onCopy: (index: number) => void;
}

function CopySection({
  title,
  icon,
  maxRecommended,
  maxAllowed,
  copies,
  copiedIndex,
  onCopy,
}: CopySectionProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[#94a3b8]">{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
          {title}
        </span>
        <span className="text-xs text-[#64748b]">({maxAllowed} chars max)</span>
      </div>
      <div className="space-y-2">
        {copies.map((text, i) => (
          <CopyVariation
            key={i}
            index={i}
            text={text}
            charCount={text.length}
            maxRecommended={maxRecommended}
            maxAllowed={maxAllowed}
            onCopy={() => onCopy(i)}
            copied={copiedIndex === i}
          />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function CopyExportStep({
  generatedCopy,
  metaReadyCopy,
  trackingUrl,
  audienceSegments,
  onBack,
  onStartNew,
}: CopyExportStepProps) {
  // State
  const [activeSegment, setActiveSegment] = useState(audienceSegments[0]?.name || '');
  const [copiedPrimaryIndex, setCopiedPrimaryIndex] = useState<number | null>(null);
  const [copiedHeadlineIndex, setCopiedHeadlineIndex] = useState<number | null>(null);
  const [copiedDescriptionIndex, setCopiedDescriptionIndex] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);

  // Get current segment copy
  const currentCopy = generatedCopy[activeSegment];

  // =========================================================================
  // Handlers
  // =========================================================================

  const handleCopyText = useCallback((text: string, setStateFn: (val: number | null) => void, index: number) => {
    navigator.clipboard.writeText(text);
    setStateFn(index);
    setTimeout(() => setStateFn(null), 2000);
  }, []);

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(trackingUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  }, [trackingUrl]);

  const handleCopyAll = useCallback(() => {
    const formattedCopy = formatCopyForClipboard(generatedCopy, audienceSegments, trackingUrl);
    navigator.clipboard.writeText(formattedCopy);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [generatedCopy, audienceSegments, trackingUrl]);

  const handleDownloadCSV = useCallback(() => {
    const csv = generateCSV(generatedCopy, audienceSegments, trackingUrl);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ad-copy-export-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [generatedCopy, audienceSegments, trackingUrl]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-[#e2e8f0]">Review & Export Copy</h2>
        <p className="mt-2 text-[#94a3b8]">
          Review your generated ad copy and export for Meta Ads Manager
        </p>
      </div>

      {/* Audience Tabs */}
      <Tabs value={activeSegment} onValueChange={setActiveSegment} className="w-full">
        <TabsList className="w-full justify-start gap-1 bg-[#141b2d] border border-[#1e2a45] p-1.5 rounded-lg h-auto flex-wrap">
          {audienceSegments.map((segment) => (
            <TabsTrigger
              key={segment.id}
              value={segment.name}
              className={cn(
                'px-4 py-2 rounded-md transition-colors',
                'data-[state=active]:bg-blue-600 data-[state=active]:text-white',
                'data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#94a3b8]',
                'data-[state=inactive]:hover:bg-[#1e2a45] data-[state=inactive]:hover:text-[#e2e8f0]'
              )}
            >
              {segment.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Tab Content */}
        {audienceSegments.map((segment) => {
          const segmentCopy = generatedCopy[segment.name];

          return (
            <TabsContent key={segment.id} value={segment.name} className="mt-6">
              {segmentCopy ? (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-8 pr-4">
                    {/* Primary Texts */}
                    <CopySection
                      title="Primary Text"
                      icon={<AlignLeft className="h-4 w-4" />}
                      maxRecommended={META_COPY_LIMITS.primary_text_visible}
                      maxAllowed={META_COPY_LIMITS.primary_text_max}
                      copies={segmentCopy.primary_texts}
                      copiedIndex={copiedPrimaryIndex}
                      onCopy={(i) =>
                        handleCopyText(segmentCopy.primary_texts[i], setCopiedPrimaryIndex, i)
                      }
                    />

                    {/* Headlines */}
                    <CopySection
                      title="Headlines"
                      icon={<Type className="h-4 w-4" />}
                      maxRecommended={META_COPY_LIMITS.headline_recommended}
                      maxAllowed={META_COPY_LIMITS.headline_max}
                      copies={segmentCopy.headlines}
                      copiedIndex={copiedHeadlineIndex}
                      onCopy={(i) =>
                        handleCopyText(segmentCopy.headlines[i], setCopiedHeadlineIndex, i)
                      }
                    />

                    {/* Descriptions */}
                    <CopySection
                      title="Descriptions"
                      icon={<FileText className="h-4 w-4" />}
                      maxRecommended={META_COPY_LIMITS.description_recommended}
                      maxAllowed={META_COPY_LIMITS.description_max}
                      copies={segmentCopy.descriptions}
                      copiedIndex={copiedDescriptionIndex}
                      onCopy={(i) =>
                        handleCopyText(segmentCopy.descriptions[i], setCopiedDescriptionIndex, i)
                      }
                    />
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileText className="h-12 w-12 text-[#64748b] mb-4" />
                  <p className="text-[#94a3b8]">No copy generated for this segment</p>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Tracking URL */}
      <div className="rounded-xl border border-[#1e2a45] bg-[#0a0f1a] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Link className="h-4 w-4 text-[#94a3b8]" />
          <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
            Tracking URL
          </span>
        </div>
        <div className="flex items-center gap-3">
          <code className="flex-1 rounded-lg bg-[#141b2d] border border-[#1e2a45] px-4 py-3 text-sm text-[#e2e8f0] font-mono overflow-x-auto">
            {trackingUrl}
          </code>
          <Button
            type="button"
            onClick={handleCopyUrl}
            size="sm"
            className={cn(
              'flex-shrink-0 gap-1.5',
              copiedUrl
                ? 'bg-[#22c55e]/20 text-[#22c55e] hover:bg-[#22c55e]/20'
                : 'bg-[#1e2a45] text-[#e2e8f0] hover:bg-[#2d3b55]'
            )}
          >
            {copiedUrl ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#1e2a45]">
        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          className="gap-2 bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={handleCopyAll}
            variant="outline"
            className={cn(
              'gap-2',
              copiedAll
                ? 'bg-[#22c55e]/20 border-[#22c55e]/30 text-[#22c55e]'
                : 'bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]'
            )}
          >
            {copiedAll ? (
              <>
                <CheckCircle className="h-4 w-4" />
                Copied All
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy All
              </>
            )}
          </Button>

          <Button
            type="button"
            onClick={handleDownloadCSV}
            variant="outline"
            className="gap-2 bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]"
          >
            <Download className="h-4 w-4" />
            Download CSV
          </Button>

          <Button
            type="button"
            onClick={onStartNew}
            className="gap-2 bg-blue-600 hover:bg-blue-500 text-white"
          >
            <RefreshCw className="h-4 w-4" />
            Start New
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CopyExportStep;
