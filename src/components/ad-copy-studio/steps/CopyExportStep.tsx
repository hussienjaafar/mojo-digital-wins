/**
 * CopyExportStep - Step 5 of the Ad Copy Studio wizard
 *
 * Final step to review and export generated ad copy.
 *
 * Features:
 * - Tabs for each audience segment (keyed by id, Issue A5)
 * - Variation view (default) and Element view toggle
 * - Per-element copy buttons in variation view (Issue F2)
 * - Per-segment regeneration (Issue A6)
 * - All Segments tab (Issue F3)
 * - Tracking URL with empty state (Issue #18)
 * - Start New with confirmation (Issue A7 - handled by parent)
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
  LayoutGrid,
  List,
  AlertCircle,
  Loader2,
  Layers,
} from 'lucide-react';
import type {
  GeneratedCopy,
  MetaReadyCopy,
  AudienceSegment,
} from '@/types/ad-copy-studio';
import { META_COPY_LIMITS } from '@/types/ad-copy-studio';
import { getCharCountColor } from '@/components/ad-copy-studio/components/analysis-primitives';

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
  onRegenerateSegment?: (segmentName: string) => Promise<void>;
  isRegenerating?: boolean;
  organizationName?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

function formatCopyForClipboard(
  generatedCopy: GeneratedCopy,
  audienceSegments: AudienceSegment[],
  trackingUrl: string,
  organizationName?: string
): string {
  let output = organizationName ? `=== ${organizationName.toUpperCase()} - AD COPY ===\n\n` : '';

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
      className="rounded-xl border border-[#1e2a45] bg-[#141b2d] p-4"
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
              <><CheckCircle className="h-3.5 w-3.5" /> Copied</>
            ) : (
              <><Copy className="h-3.5 w-3.5" /> Copy</>
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

// Issue F2: Small inline copy button for individual elements in variation view
function InlineCopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        'ml-auto flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] transition-colors',
        copied
          ? 'bg-[#22c55e]/20 text-[#22c55e]'
          : 'bg-[#1e2a45] text-[#64748b] hover:text-[#94a3b8]'
      )}
      aria-label={`Copy ${label}`}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// =============================================================================
// Segment Content Renderer (used for both single and all-segments views)
// =============================================================================

interface SegmentContentProps {
  segmentCopy: GeneratedCopy[string];
  segmentName: string;
  viewMode: 'variation' | 'element';
  copiedVariationIndex: number | null;
  copiedPrimaryIndex: number | null;
  copiedHeadlineIndex: number | null;
  copiedDescriptionIndex: number | null;
  onCopyVariation: (text: string, index: number) => void;
  onCopyText: (text: string, setStateFn: (val: number | null) => void, index: number) => void;
  setCopiedPrimaryIndex: (val: number | null) => void;
  setCopiedHeadlineIndex: (val: number | null) => void;
  setCopiedDescriptionIndex: (val: number | null) => void;
}

function SegmentContent({
  segmentCopy,
  segmentName,
  viewMode,
  copiedVariationIndex,
  copiedPrimaryIndex,
  copiedHeadlineIndex,
  copiedDescriptionIndex,
  onCopyVariation,
  onCopyText,
  setCopiedPrimaryIndex,
  setCopiedHeadlineIndex,
  setCopiedDescriptionIndex,
}: SegmentContentProps) {
  if (!segmentCopy) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-[#64748b] mb-4" />
        <p className="text-[#94a3b8]">No copy generated for this segment</p>
      </div>
    );
  }

  if (viewMode === 'variation') {
    const variationCount = Math.max(
      segmentCopy.primary_texts.length,
      segmentCopy.headlines.length,
      segmentCopy.descriptions.length
    );

    return (
      <div className="space-y-4">
        {Array.from({ length: variationCount }, (_, i) => {
          const primary = segmentCopy.primary_texts[i] || '';
          const headline = segmentCopy.headlines[i] || '';
          const description = segmentCopy.descriptions[i] || '';
          const fullVariation = `PRIMARY TEXT:\n${primary}\n\nHEADLINE:\n${headline}\n\nDESCRIPTION:\n${description}`;
          const isCopied = copiedVariationIndex === i;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-[#1e2a45] bg-[#0a0f1a] overflow-hidden"
            >
              {/* Variation Header */}
              <div className="flex items-center justify-between border-b border-[#1e2a45] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-[#e2e8f0]">Variation {i + 1}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onCopyVariation(fullVariation, i)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-colors',
                    isCopied
                      ? 'bg-[#22c55e]/20 text-[#22c55e]'
                      : 'bg-[#1e2a45] text-[#94a3b8] hover:bg-[#2d3b55] hover:text-[#e2e8f0]'
                  )}
                >
                  {isCopied ? (
                    <><CheckCircle className="h-3.5 w-3.5" /> Copied</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copy All</>
                  )}
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Primary Text */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlignLeft className="h-3.5 w-3.5 text-[#94a3b8]" />
                    <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">Primary Text</span>
                    <span className={cn('text-xs tabular-nums', getCharCountColor(primary.length, META_COPY_LIMITS.primary_text_visible, META_COPY_LIMITS.primary_text_max))}>
                      {primary.length} chars
                    </span>
                    <InlineCopyButton text={primary} label="primary text" />
                  </div>
                  <p className="text-sm text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">{primary}</p>
                </div>

                {/* Headline */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Type className="h-3.5 w-3.5 text-[#94a3b8]" />
                    <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">Headline</span>
                    <span className={cn('text-xs tabular-nums', getCharCountColor(headline.length, META_COPY_LIMITS.headline_recommended, META_COPY_LIMITS.headline_max))}>
                      {headline.length} chars
                    </span>
                    <InlineCopyButton text={headline} label="headline" />
                  </div>
                  <p className="text-sm text-[#e2e8f0] font-medium">{headline}</p>
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <FileText className="h-3.5 w-3.5 text-[#94a3b8]" />
                    <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">Description</span>
                    <span className={cn('text-xs tabular-nums', getCharCountColor(description.length, META_COPY_LIMITS.description_recommended, META_COPY_LIMITS.description_max))}>
                      {description.length} chars
                    </span>
                    <InlineCopyButton text={description} label="description" />
                  </div>
                  <p className="text-sm text-[#e2e8f0]">{description}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    );
  }

  // Element View
  return (
    <div className="space-y-8">
      <CopySection
        title="Primary Text"
        icon={<AlignLeft className="h-4 w-4" />}
        maxRecommended={META_COPY_LIMITS.primary_text_visible}
        maxAllowed={META_COPY_LIMITS.primary_text_max}
        copies={segmentCopy.primary_texts}
        copiedIndex={copiedPrimaryIndex}
        onCopy={(i) => onCopyText(segmentCopy.primary_texts[i], setCopiedPrimaryIndex, i)}
      />
      <CopySection
        title="Headlines"
        icon={<Type className="h-4 w-4" />}
        maxRecommended={META_COPY_LIMITS.headline_recommended}
        maxAllowed={META_COPY_LIMITS.headline_max}
        copies={segmentCopy.headlines}
        copiedIndex={copiedHeadlineIndex}
        onCopy={(i) => onCopyText(segmentCopy.headlines[i], setCopiedHeadlineIndex, i)}
      />
      <CopySection
        title="Descriptions"
        icon={<FileText className="h-4 w-4" />}
        maxRecommended={META_COPY_LIMITS.description_recommended}
        maxAllowed={META_COPY_LIMITS.description_max}
        copies={segmentCopy.descriptions}
        copiedIndex={copiedDescriptionIndex}
        onCopy={(i) => onCopyText(segmentCopy.descriptions[i], setCopiedDescriptionIndex, i)}
      />
    </div>
  );
}

// =============================================================================
// Component
// =============================================================================

const ALL_SEGMENTS_KEY = '__all__';

export function CopyExportStep({
  generatedCopy,
  metaReadyCopy,
  trackingUrl,
  audienceSegments,
  onBack,
  onStartNew,
  onRegenerateSegment,
  isRegenerating,
  organizationName,
}: CopyExportStepProps) {
  // Issue A5: Use segment.id as tab key
  const [activeSegmentId, setActiveSegmentId] = useState(audienceSegments[0]?.id || ALL_SEGMENTS_KEY);
  const [copiedPrimaryIndex, setCopiedPrimaryIndex] = useState<number | null>(null);
  const [copiedHeadlineIndex, setCopiedHeadlineIndex] = useState<number | null>(null);
  const [copiedDescriptionIndex, setCopiedDescriptionIndex] = useState<number | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [viewMode, setViewMode] = useState<'variation' | 'element'>('variation');
  const [copiedVariationIndex, setCopiedVariationIndex] = useState<number | null>(null);

  // Issue A5: Map active segment id back to name for generatedCopy lookup
  const activeSegment = audienceSegments.find(s => s.id === activeSegmentId);
  const activeSegmentName = activeSegment?.name || '';

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
    const formattedCopy = formatCopyForClipboard(generatedCopy, audienceSegments, trackingUrl, organizationName);
    navigator.clipboard.writeText(formattedCopy);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [generatedCopy, audienceSegments, trackingUrl, organizationName]);

  const handleCopyVariation = useCallback((text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedVariationIndex(index);
    setTimeout(() => setCopiedVariationIndex(null), 2000);
  }, []);

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

  // Issue A6: Per-segment regeneration
  const handleRegenerate = useCallback(async () => {
    if (onRegenerateSegment && activeSegmentName) {
      await onRegenerateSegment(activeSegmentName);
    }
  }, [onRegenerateSegment, activeSegmentName]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-[#e2e8f0]">Review & Export Copy</h2>
        <p className="mt-2 text-[#94a3b8]">
          Review your generated ad copy{organizationName ? <> for <span className="text-blue-400 font-medium">{organizationName}</span></> : ''} and export for Meta Ads Manager
        </p>
      </div>

      {/* Audience Tabs + View Toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Tabs value={activeSegmentId} onValueChange={setActiveSegmentId} className="flex-1 min-w-0">
          <TabsList className="w-full justify-start gap-1 bg-[#141b2d] border border-[#1e2a45] p-1.5 rounded-xl h-auto flex-wrap">
            {/* Issue F3: All Segments tab */}
            {audienceSegments.length > 1 && (
              <TabsTrigger
                value={ALL_SEGMENTS_KEY}
                className={cn(
                  'px-4 py-2 rounded-lg transition-colors',
                  'data-[state=active]:bg-[#a855f7] data-[state=active]:text-white',
                  'data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#94a3b8]',
                  'data-[state=inactive]:hover:bg-[#1e2a45] data-[state=inactive]:hover:text-[#e2e8f0]'
                )}
              >
                <Layers className="h-3.5 w-3.5 mr-1.5" />
                All
              </TabsTrigger>
            )}
            {audienceSegments.map((segment) => (
              <TabsTrigger
                key={segment.id}
                value={segment.id}
                className={cn(
                  'px-4 py-2 rounded-lg transition-colors',
                  'data-[state=active]:bg-blue-600 data-[state=active]:text-white',
                  'data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#94a3b8]',
                  'data-[state=inactive]:hover:bg-[#1e2a45] data-[state=inactive]:hover:text-[#e2e8f0]'
                )}
              >
                {segment.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        
        <div className="flex items-center gap-2">
          {/* Issue A6: Per-segment regeneration */}
          {onRegenerateSegment && activeSegmentId !== ALL_SEGMENTS_KEY && (
            <Button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              variant="outline"
              size="sm"
              className="gap-1.5 border-[#1e2a45] bg-[#0a0f1a] text-[#94a3b8] hover:bg-[#1e2a45] hover:text-[#e2e8f0]"
            >
              {isRegenerating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Regenerate
            </Button>
          )}

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 rounded-xl border border-[#1e2a45] bg-[#0a0f1a] p-1">
            <button
              type="button"
              onClick={() => setViewMode('variation')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors',
                viewMode === 'variation'
                  ? 'bg-blue-600 text-white'
                  : 'text-[#94a3b8] hover:text-[#e2e8f0]'
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Variation
            </button>
            <button
              type="button"
              onClick={() => setViewMode('element')}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs transition-colors',
                viewMode === 'element'
                  ? 'bg-blue-600 text-white'
                  : 'text-[#94a3b8] hover:text-[#e2e8f0]'
              )}
            >
              <List className="h-3.5 w-3.5" />
              Element
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-[calc(100vh-420px)] min-h-[300px] pr-1 scrollbar-thin scrollbar-thumb-[#1e2a45] scrollbar-track-transparent">
        <div>
          {activeSegmentId === ALL_SEGMENTS_KEY ? (
            // Issue F3: All segments stacked
            <div className="space-y-8">
              {audienceSegments.map((segment) => (
                <div key={segment.id}>
                  <h3 className="text-lg font-semibold text-[#e2e8f0] mb-4 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    {segment.name}
                  </h3>
                  <SegmentContent
                    segmentCopy={generatedCopy[segment.name]}
                    segmentName={segment.name}
                    viewMode={viewMode}
                    copiedVariationIndex={copiedVariationIndex}
                    copiedPrimaryIndex={copiedPrimaryIndex}
                    copiedHeadlineIndex={copiedHeadlineIndex}
                    copiedDescriptionIndex={copiedDescriptionIndex}
                    onCopyVariation={handleCopyVariation}
                    onCopyText={handleCopyText}
                    setCopiedPrimaryIndex={setCopiedPrimaryIndex}
                    setCopiedHeadlineIndex={setCopiedHeadlineIndex}
                    setCopiedDescriptionIndex={setCopiedDescriptionIndex}
                  />
                </div>
              ))}
            </div>
          ) : (
            <SegmentContent
              segmentCopy={generatedCopy[activeSegmentName]}
              segmentName={activeSegmentName}
              viewMode={viewMode}
              copiedVariationIndex={copiedVariationIndex}
              copiedPrimaryIndex={copiedPrimaryIndex}
              copiedHeadlineIndex={copiedHeadlineIndex}
              copiedDescriptionIndex={copiedDescriptionIndex}
              onCopyVariation={handleCopyVariation}
              onCopyText={handleCopyText}
              setCopiedPrimaryIndex={setCopiedPrimaryIndex}
              setCopiedHeadlineIndex={setCopiedHeadlineIndex}
              setCopiedDescriptionIndex={setCopiedDescriptionIndex}
            />
          )}
        </div>
      </div>

      {/* Tracking URL */}
      <div className="rounded-xl border border-[#1e2a45] bg-[#0a0f1a] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Link className="h-4 w-4 text-[#94a3b8]" />
          <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
            Tracking URL
          </span>
        </div>
        {trackingUrl ? (
          <div className="flex items-center gap-3">
            <code className="flex-1 rounded-xl bg-[#141b2d] border border-[#1e2a45] px-4 py-3 text-sm text-[#e2e8f0] font-mono overflow-x-auto">
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
                <><CheckCircle className="h-4 w-4" /> Copied</>
              ) : (
                <><Copy className="h-4 w-4" /> Copy</>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[#94a3b8]">
            <AlertCircle className="h-4 w-4 text-[#f97316]" />
            <span className="text-sm">No tracking URL generated</span>
          </div>
        )}
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
              <><CheckCircle className="h-4 w-4" /> Copied All</>
            ) : (
              <><Copy className="h-4 w-4" /> Copy All</>
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
