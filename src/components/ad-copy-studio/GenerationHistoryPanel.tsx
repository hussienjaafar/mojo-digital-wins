/**
 * GenerationHistoryPanel - Displays past ad copy generations for an organization
 * 
 * Features:
 * - List of generation cards with video name, date, segments, model info
 * - Expandable detail view reusing CopyExportStep variation card format
 * - Per-element copy buttons and "Copy All"
 * - Slide-in overlay that replaces wizard content
 */

import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Clock,
  Video,
  Copy,
  CheckCircle,
  FileText,
  Type,
  AlignLeft,
  Loader2,
  Tag,
  Sparkles,
  ChevronRight,
  X,
  Link,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow, format } from 'date-fns';
import { useGenerationHistory, type GenerationHistoryItem } from '@/hooks/useGenerationHistory';
import { META_COPY_LIMITS } from '@/types/ad-copy-studio';
import { getCharCountColor } from '@/components/ad-copy-studio/components/analysis-primitives';

// =============================================================================
// Types
// =============================================================================

interface GenerationHistoryPanelProps {
  organizationId: string;
  organizationName?: string;
  onClose: () => void;
}

// =============================================================================
// Inline Copy Button (reused from CopyExportStep pattern)
// =============================================================================

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
// Generation Card (list item)
// =============================================================================

function GenerationCard({
  item,
  onClick,
}: {
  item: GenerationHistoryItem;
  onClick: () => void;
}) {
  const variationCount = useMemo(() => {
    if (!item.generated_copy) return 0;
    return Math.max(
      ...Object.values(item.generated_copy).map(
        seg => seg?.primary_texts?.length || 0
      )
    );
  }, [item.generated_copy]);

  const segmentCount = Object.keys(item.generated_copy || {}).length;

  const dateStr = item.generated_at
    ? formatDistanceToNow(new Date(item.generated_at), { addSuffix: true })
    : 'Unknown date';

  const fullDate = item.generated_at
    ? format(new Date(item.generated_at), 'MMM d, yyyy \'at\' h:mm a')
    : '';

  const modelLabel = item.generation_model
    ? item.generation_model.replace('google/', '').replace('openai/', '')
    : 'Unknown';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-[#1e2a45] bg-[#0a0f1a] p-4 hover:border-[#2d3b55] hover:bg-[#0d1424] transition-colors group"
    >
      {/* Video name + date */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Video className="h-4 w-4 text-blue-400 shrink-0" />
          <span className="text-sm font-medium text-[#e2e8f0] truncate">
            {item.video_name || 'Unknown video'}
          </span>
        </div>
        <ChevronRight className="h-4 w-4 text-[#64748b] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
      </div>

      <p className="text-xs text-[#64748b] mb-3" title={fullDate}>
        {dateStr}
      </p>

      {/* Audience segments as pills */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {item.audience_segments.map((seg) => (
          <span
            key={seg.id || seg.name}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[11px] font-medium"
          >
            {seg.name}
          </span>
        ))}
      </div>

      {/* Metadata row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#64748b]">
        <span className="flex items-center gap-1">
          <Tag className="h-3 w-3" />
          {item.actblue_form_name}
        </span>
        <span>•</span>
        <span>{item.refcode}</span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          {modelLabel}
          {item.generation_prompt_version && ` v${item.generation_prompt_version}`}
        </span>
        <span>•</span>
        <span>{variationCount} variation{variationCount !== 1 ? 's' : ''} × {segmentCount} segment{segmentCount !== 1 ? 's' : ''}</span>
      </div>
    </button>
  );
}

// =============================================================================
// Generation Detail View
// =============================================================================

function GenerationDetail({
  item,
  organizationName,
  onBack,
}: {
  item: GenerationHistoryItem;
  organizationName?: string;
  onBack: () => void;
}) {
  const [copiedAll, setCopiedAll] = useState(false);

  const handleCopyAll = useCallback(() => {
    if (!item.generated_copy) return;
    let output = organizationName ? `=== ${organizationName.toUpperCase()} - AD COPY ===\n\n` : '';

    for (const [segName, segCopy] of Object.entries(item.generated_copy)) {
      output += `=== ${segName.toUpperCase()} ===\n\n`;
      output += 'PRIMARY TEXT:\n';
      segCopy.primary_texts.forEach((t, i) => { output += `${i + 1}. ${t}\n`; });
      output += '\nHEADLINES:\n';
      segCopy.headlines.forEach((t, i) => { output += `${i + 1}. ${t}\n`; });
      output += '\nDESCRIPTIONS:\n';
      segCopy.descriptions.forEach((t, i) => { output += `${i + 1}. ${t}\n`; });
      output += '\n\n';
    }
    if (item.tracking_url) output += `TRACKING URL:\n${item.tracking_url}\n`;

    navigator.clipboard.writeText(output);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }, [item, organizationName]);

  const fullDate = item.generated_at
    ? format(new Date(item.generated_at), 'EEEE, MMM d, yyyy \'at\' h:mm a')
    : 'Unknown date';

  const modelLabel = item.generation_model
    ? item.generation_model.replace('google/', '').replace('openai/', '')
    : 'Unknown';

  return (
    <div className="flex flex-col h-full">
      {/* Detail Header */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-[#e2e8f0] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to history
        </button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCopyAll}
          className={cn(
            'text-xs',
            copiedAll
              ? 'text-[#22c55e]'
              : 'text-[#94a3b8] hover:text-[#e2e8f0]'
          )}
        >
          {copiedAll ? (
            <><CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Copied All</>
          ) : (
            <><Copy className="h-3.5 w-3.5 mr-1.5" /> Copy All</>
          )}
        </Button>
      </div>

      {/* Meta info card */}
      <div className="rounded-xl border border-[#1e2a45] bg-[#0a0f1a] p-4 mb-4 space-y-2">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-blue-400" />
          <span className="text-sm font-medium text-[#e2e8f0]">{item.video_name || 'Unknown video'}</span>
        </div>
        <p className="text-xs text-[#64748b]">{fullDate}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#64748b]">
          <span className="flex items-center gap-1"><Settings2 className="h-3 w-3" /> {item.actblue_form_name}</span>
          <span className="flex items-center gap-1"><Tag className="h-3 w-3" /> {item.refcode}</span>
          <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> {modelLabel} v{item.generation_prompt_version}</span>
          {item.recurring_default && <span>Recurring ✓</span>}
        </div>
        {item.tracking_url && (
          <div className="flex items-center gap-1.5 pt-1">
            <Link className="h-3 w-3 text-[#64748b]" />
            <span className="text-xs text-blue-400 truncate">{item.tracking_url}</span>
            <InlineCopyButton text={item.tracking_url} label="tracking URL" />
          </div>
        )}
      </div>

      {/* Segments + Copy */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-1 scrollbar-thin scrollbar-thumb-[#1e2a45] scrollbar-track-transparent">
        {item.generated_copy && Object.entries(item.generated_copy).map(([segmentName, segCopy]) => (
          <div key={segmentName}>
            {/* Segment header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-medium">
                {segmentName}
              </span>
            </div>

            {/* Variations */}
            <div className="space-y-3">
              {Array.from(
                { length: Math.max(segCopy.primary_texts.length, segCopy.headlines.length, segCopy.descriptions.length) },
                (_, i) => {
                  const primary = segCopy.primary_texts[i] || '';
                  const headline = segCopy.headlines[i] || '';
                  const description = segCopy.descriptions[i] || '';

                  return (
                    <div
                      key={i}
                      className="rounded-xl border border-[#1e2a45] bg-[#0a0f1a] overflow-hidden"
                    >
                      <div className="flex items-center gap-2 border-b border-[#1e2a45] px-4 py-2.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-medium text-white">
                          {i + 1}
                        </span>
                        <span className="text-xs font-medium text-[#e2e8f0]">Variation {i + 1}</span>
                      </div>

                      <div className="p-4 space-y-3">
                        {/* Primary Text */}
                        {primary && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <AlignLeft className="h-3 w-3 text-[#94a3b8]" />
                              <span className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">Primary Text</span>
                              <span className={cn('text-[10px] tabular-nums', getCharCountColor(primary.length, META_COPY_LIMITS.primary_text_visible, META_COPY_LIMITS.primary_text_max))}>
                                {primary.length} chars
                              </span>
                              <InlineCopyButton text={primary} label="primary text" />
                            </div>
                            <p className="text-sm text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">{primary}</p>
                          </div>
                        )}

                        {/* Headline */}
                        {headline && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Type className="h-3 w-3 text-[#94a3b8]" />
                              <span className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">Headline</span>
                              <span className={cn('text-[10px] tabular-nums', getCharCountColor(headline.length, META_COPY_LIMITS.headline_recommended, META_COPY_LIMITS.headline_max))}>
                                {headline.length} chars
                              </span>
                              <InlineCopyButton text={headline} label="headline" />
                            </div>
                            <p className="text-sm text-[#e2e8f0] font-medium">{headline}</p>
                          </div>
                        )}

                        {/* Description */}
                        {description && (
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="h-3 w-3 text-[#94a3b8]" />
                              <span className="text-[10px] font-medium uppercase tracking-wider text-[#64748b]">Description</span>
                              <span className={cn('text-[10px] tabular-nums', getCharCountColor(description.length, META_COPY_LIMITS.description_recommended, META_COPY_LIMITS.description_max))}>
                                {description.length} chars
                              </span>
                              <InlineCopyButton text={description} label="description" />
                            </div>
                            <p className="text-sm text-[#e2e8f0]">{description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Panel
// =============================================================================

export function GenerationHistoryPanel({
  organizationId,
  organizationName,
  onClose,
}: GenerationHistoryPanelProps) {
  const { generations, isLoading, error } = useGenerationHistory(organizationId);
  const [selectedItem, setSelectedItem] = useState<GenerationHistoryItem | null>(null);

  return (
    <div className="flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-[#e2e8f0]">
            {selectedItem ? 'Generation Detail' : 'Generation History'}
          </h2>
          {!selectedItem && generations.length > 0 && (
            <span className="text-xs text-[#64748b] bg-[#1e2a45] px-2 py-0.5 rounded-full">
              {generations.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-[#64748b] hover:text-[#e2e8f0] hover:bg-[#1e2a45] transition-colors"
          aria-label="Close history"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedItem ? (
            <motion.div
              key="detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              <GenerationDetail
                item={selectedItem}
                organizationName={organizationName}
                onBack={() => setSelectedItem(null)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500 mb-3" />
                  <p className="text-sm text-[#94a3b8]">Loading history...</p>
                </div>
              ) : error ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <p className="text-sm text-[#ef4444] mb-2">Failed to load history</p>
                  <p className="text-xs text-[#64748b]">{error}</p>
                </div>
              ) : generations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Clock className="h-10 w-10 text-[#64748b] mb-3" />
                  <p className="text-sm text-[#94a3b8] mb-1">No generation history</p>
                  <p className="text-xs text-[#64748b]">
                    Past ad copy generations will appear here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {generations.map((item) => (
                    <GenerationCard
                      key={item.id}
                      item={item}
                      onClick={() => setSelectedItem(item)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
