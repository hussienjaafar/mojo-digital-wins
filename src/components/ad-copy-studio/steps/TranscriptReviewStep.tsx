/**
 * TranscriptReviewStep - Step 2 of the Ad Copy Studio wizard
 *
 * Allows users to review transcripts and AI analysis for each uploaded video.
 * 
 * Issue A2: Removed misleading review counter
 * Issue C1: Uses shared analysis primitives
 * Issue D2: Responsive scroll area height
 * Issue D4: Character count on transcript edit
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  Target,
  AlertTriangle,
  Heart,
  Quote,
  CheckCircle,
  Edit3,
  X,
  MessageSquare,
  ChevronDown,
  Loader2,
  RefreshCw,
  Save,
  Info,
  Sparkles,
  ThumbsUp,
  Flame,
  BarChart3,
  Shield,
  Megaphone,
  Tag,
  Gauge,
} from 'lucide-react';
import type { VideoUpload, TranscriptAnalysis } from '@/types/ad-copy-studio';
import type { ReanalyzeOptions, ReanalyzeResult } from '@/hooks/useVideoTranscriptionFlow';
import { AnalysisCard, TagList, BulletList } from '@/components/ad-copy-studio/components/analysis-primitives';

// =============================================================================
// Types
// =============================================================================

export interface TranscriptReviewStepProps {
  videos: VideoUpload[];
  analyses: Record<string, TranscriptAnalysis>;
  transcriptIds: Record<string, string>;
  onBack: () => void;
  onComplete: () => void;
  onReanalyze?: (options: ReanalyzeOptions) => Promise<ReanalyzeResult | null>;
  onSaveTranscript?: (transcriptId: string, transcriptText: string) => Promise<boolean>;
  onAnalysisUpdate?: (videoId: string, analysis: TranscriptAnalysis) => void;
}

// =============================================================================
// Helper Components
// =============================================================================

interface ContextSectionProps {
  userContextPre?: string;
  userContextPost?: string;
  analysisCount?: number;
  lastAnalyzedAt?: string;
  onContextChange: (context: string) => void;
  onReanalyze: () => void;
  isReanalyzing: boolean;
  hasChanges: boolean;
}

function ContextSection({
  userContextPre,
  userContextPost,
  analysisCount,
  lastAnalyzedAt,
  onContextChange,
  onReanalyze,
  isReanalyzing,
  hasChanges,
}: ContextSectionProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [localContext, setLocalContext] = useState(userContextPost || '');

  const handleContextChange = (value: string) => {
    setLocalContext(value);
    onContextChange(value);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="rounded-xl border border-[#1e2a45] bg-[#0a0f1a] overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 hover:bg-[#141b2d] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
                Context & Refinement
              </span>
              {analysisCount && analysisCount > 1 && (
                <span className="inline-flex rounded-full bg-blue-500/20 border border-blue-500/40 px-2 py-0.5 text-xs text-blue-400">
                  Analysis #{analysisCount}
                </span>
              )}
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-[#64748b] transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            {userContextPre && (
              <div className="space-y-2">
                <label className="text-xs text-[#64748b]">Pre-analysis context (read-only)</label>
                <div className="rounded-md bg-[#141b2d] border border-[#1e2a45] px-3 py-2 text-sm text-[#94a3b8]">
                  {userContextPre}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs text-[#64748b]">
                Add context to refine the analysis
              </label>
              <Textarea
                value={localContext}
                onChange={(e) => handleContextChange(e.target.value)}
                placeholder="e.g., 'The opponent mentioned is Senator John Smith' or 'This is a 30-second ad targeting swing voters'"
                className="min-h-[80px] bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] text-sm resize-none"
              />
              <p className="text-xs text-[#64748b]">
                Adding context helps the AI understand nuances like names, abbreviations, or local references.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-xs text-[#64748b]">
                {lastAnalyzedAt && (
                  <span>
                    Last analyzed: {new Date(lastAnalyzedAt).toLocaleString()}
                  </span>
                )}
              </div>
              <Button
                type="button"
                onClick={onReanalyze}
                disabled={isReanalyzing || (!hasChanges && !localContext.trim())}
                size="sm"
                className="gap-2 bg-[#a855f7] hover:bg-[#9333ea] text-white"
              >
                {isReanalyzing ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Reanalyzing...</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Reanalyze</>
                )}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// =============================================================================
// Component
// =============================================================================

export function TranscriptReviewStep({
  videos,
  analyses,
  transcriptIds,
  onBack,
  onComplete,
  onReanalyze,
  onSaveTranscript,
  onAnalysisUpdate,
}: TranscriptReviewStepProps) {
  // State
  const [activeVideoId, setActiveVideoId] = useState(videos[0]?.id || '');
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingContexts, setPendingContexts] = useState<Record<string, string>>({});
  const [transcriptChanges, setTranscriptChanges] = useState<Record<string, string>>({});

  // Issue D3: Focus management ref
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  // Computed
  const activeAnalysis = analyses[activeVideoId];
  const activeTranscriptId = transcriptIds[activeVideoId];

  const hasTranscriptChanges = transcriptChanges[activeVideoId] !== undefined;
  const hasContextChanges = pendingContexts[activeVideoId] !== undefined && 
    pendingContexts[activeVideoId] !== (activeAnalysis?.user_context_post || '');

  const getVideoIndex = (videoId: string) => {
    return videos.findIndex((v) => v.id === videoId) + 1;
  };

  // =========================================================================
  // Handlers
  // =========================================================================

  // Issue A2: Simple tab change without misleading review tracking
  const handleTabChange = useCallback(
    (videoId: string) => {
      setActiveVideoId(videoId);
      setEditingTranscript(false);
      setEditedTranscript('');
    },
    []
  );

  const handleStartEdit = useCallback(() => {
    if (activeAnalysis) {
      const currentText = transcriptChanges[activeVideoId] || activeAnalysis.transcript_text;
      setEditedTranscript(currentText);
      setEditingTranscript(true);
    }
  }, [activeAnalysis, activeVideoId, transcriptChanges]);

  const handleCancelEdit = useCallback(() => {
    setEditingTranscript(false);
    setEditedTranscript('');
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!activeTranscriptId || !onSaveTranscript) {
      setTranscriptChanges((prev) => ({ ...prev, [activeVideoId]: editedTranscript }));
      setEditingTranscript(false);
      toast.success('Transcript changes saved locally');
      return;
    }

    setIsSaving(true);
    try {
      const success = await onSaveTranscript(activeTranscriptId, editedTranscript);
      if (success) {
        setTranscriptChanges((prev) => ({ ...prev, [activeVideoId]: editedTranscript }));
        toast.success('Transcript saved successfully');
        
        if (onAnalysisUpdate && activeAnalysis) {
          onAnalysisUpdate(activeVideoId, {
            ...activeAnalysis,
            transcript_text: editedTranscript,
          });
        }
      } else {
        toast.error('Failed to save transcript');
      }
    } catch (err) {
      console.error('Save error:', err);
      toast.error('Failed to save transcript');
    } finally {
      setIsSaving(false);
      setEditingTranscript(false);
    }
  }, [activeTranscriptId, activeVideoId, editedTranscript, onSaveTranscript, onAnalysisUpdate, activeAnalysis]);

  const handleSaveAndReanalyze = useCallback(async () => {
    if (!activeTranscriptId || !onReanalyze) {
      toast.error('Reanalyze not available');
      return;
    }

    setIsReanalyzing(true);
    try {
      const result = await onReanalyze({
        transcriptId: activeTranscriptId,
        transcriptText: editedTranscript || undefined,
        userContextPre: activeAnalysis?.user_context_pre,
        userContextPost: pendingContexts[activeVideoId] || activeAnalysis?.user_context_post,
      });

      if (result?.success) {
        toast.success(`Analysis updated (version ${result.analysisCount})`);
        
        setTranscriptChanges((prev) => {
          const next = { ...prev };
          delete next[activeVideoId];
          return next;
        });
        setPendingContexts((prev) => {
          const next = { ...prev };
          delete next[activeVideoId];
          return next;
        });
        
        if (onAnalysisUpdate) {
          onAnalysisUpdate(activeVideoId, {
            ...result.analysis,
            transcript_text: editedTranscript || activeAnalysis?.transcript_text || '',
            analysis_count: result.analysisCount,
            last_analyzed_at: result.analyzedAt,
          });
        }
        
        setEditingTranscript(false);
        setEditedTranscript('');
      } else {
        toast.error('Reanalysis failed');
      }
    } catch (err) {
      console.error('Reanalyze error:', err);
      toast.error('Failed to reanalyze transcript');
    } finally {
      setIsReanalyzing(false);
    }
  }, [activeTranscriptId, activeVideoId, activeAnalysis, editedTranscript, pendingContexts, onReanalyze, onAnalysisUpdate]);

  const handleContextChange = useCallback((context: string) => {
    setPendingContexts((prev) => ({ ...prev, [activeVideoId]: context }));
  }, [activeVideoId]);

  const handleReanalyze = useCallback(async () => {
    if (!activeTranscriptId || !onReanalyze) {
      toast.error('Reanalyze not available');
      return;
    }

    setIsReanalyzing(true);
    try {
      const result = await onReanalyze({
        transcriptId: activeTranscriptId,
        transcriptText: transcriptChanges[activeVideoId],
        userContextPre: activeAnalysis?.user_context_pre,
        userContextPost: pendingContexts[activeVideoId] || activeAnalysis?.user_context_post,
      });

      if (result?.success) {
        toast.success(`Analysis updated (version ${result.analysisCount})`);
        
        setTranscriptChanges((prev) => {
          const next = { ...prev };
          delete next[activeVideoId];
          return next;
        });
        setPendingContexts((prev) => {
          const next = { ...prev };
          delete next[activeVideoId];
          return next;
        });
        
        if (onAnalysisUpdate) {
          onAnalysisUpdate(activeVideoId, {
            ...result.analysis,
            transcript_text: transcriptChanges[activeVideoId] || activeAnalysis?.transcript_text || '',
            analysis_count: result.analysisCount,
            last_analyzed_at: result.analyzedAt,
          });
        }
      } else {
        toast.error('Reanalysis failed');
      }
    } catch (err) {
      console.error('Reanalyze error:', err);
      toast.error('Failed to reanalyze transcript');
    } finally {
      setIsReanalyzing(false);
    }
  }, [activeTranscriptId, activeVideoId, activeAnalysis, transcriptChanges, pendingContexts, onReanalyze, onAnalysisUpdate]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <h2 ref={stepHeadingRef} tabIndex={-1} className="text-2xl font-semibold text-[#e2e8f0] outline-none">
          Review Transcripts & Analysis
        </h2>
        <p className="mt-2 text-[#94a3b8]">
          {videos.length} video{videos.length !== 1 ? 's' : ''} available for review. Add context to refine the analysis.
        </p>
      </div>

      {/* Video Tabs */}
      <Tabs value={activeVideoId} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full justify-start gap-1 bg-[#141b2d] border border-[#1e2a45] p-1.5 rounded-xl h-auto flex-wrap">
          {videos.map((video) => {
            const index = getVideoIndex(video.id);
            const hasAnalysis = !!analyses[video.id];

            return (
              <TabsTrigger
                key={video.id}
                value={video.id}
                className={cn(
                  'relative gap-2 px-4 py-2 rounded-lg transition-colors',
                  'data-[state=active]:bg-blue-600 data-[state=active]:text-white',
                  'data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#94a3b8]',
                  'data-[state=inactive]:hover:bg-[#1e2a45] data-[state=inactive]:hover:text-[#e2e8f0]'
                )}
              >
                {hasAnalysis && (
                  <CheckCircle className="h-3.5 w-3.5 text-[#22c55e]" />
                )}
                <span>Video {index}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab Content */}
        {videos.map((video) => {
          const analysis = analyses[video.id];
          const currentTranscript = transcriptChanges[video.id] || analysis?.transcript_text;

          return (
            <TabsContent key={video.id} value={video.id} className="mt-6">
              {analysis ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Panel: Transcript */}
                  <div className="rounded-xl border border-[#1e2a45] bg-[#0a0f1a] overflow-hidden">
                    <div className="flex items-center justify-between border-b border-[#1e2a45] px-4 py-3">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#94a3b8]" />
                        <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
                          Transcript
                        </span>
                        {transcriptChanges[video.id] && (
                          <span className="inline-flex rounded-full bg-[#f97316]/20 border border-[#f97316]/40 px-2 py-0.5 text-xs text-[#f97316]">
                            Edited
                          </span>
                        )}
                      </div>
                      {!editingTranscript && video.id === activeVideoId && (
                        <button
                          type="button"
                          onClick={handleStartEdit}
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                          Edit transcript
                        </button>
                      )}
                    </div>

                    <AnimatePresence mode="wait">
                      {editingTranscript && video.id === activeVideoId ? (
                        <motion.div
                          key="editing"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="p-4"
                        >
                          <Textarea
                            value={editedTranscript}
                            onChange={(e) => setEditedTranscript(e.target.value)}
                            className="min-h-[300px] bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] text-sm leading-relaxed resize-none"
                          />
                          {/* Issue D4: Character/word count */}
                          <div className="flex items-center justify-between mt-2 text-xs text-[#64748b]">
                            <span>{editedTranscript.split(/\s+/).filter(Boolean).length} words</span>
                            <span>{editedTranscript.length} characters</span>
                          </div>
                          <div className="flex justify-end gap-2 mt-4">
                            <Button
                              type="button"
                              onClick={handleCancelEdit}
                              variant="outline"
                              size="sm"
                              className="bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]"
                              disabled={isSaving || isReanalyzing}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              onClick={handleSaveEdit}
                              size="sm"
                              className="gap-1 bg-blue-600 hover:bg-blue-500 text-white"
                              disabled={isSaving || isReanalyzing}
                            >
                              {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                              Save
                            </Button>
                            {onReanalyze && (
                              <Button
                                type="button"
                                onClick={handleSaveAndReanalyze}
                                size="sm"
                                className="gap-1 bg-[#a855f7] hover:bg-[#9333ea] text-white"
                                disabled={isSaving || isReanalyzing}
                              >
                                {isReanalyzing ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                                Save & Reanalyze
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="viewing"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                        >
                          <ScrollArea className="h-[400px]">
                            <div className="p-4">
                              <p className="text-sm text-[#e2e8f0] leading-relaxed whitespace-pre-wrap">
                                "{currentTranscript}"
                              </p>
                            </div>
                          </ScrollArea>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Right Panel: Analysis - Issue D2: Responsive height */}
                  <ScrollArea className="max-h-[calc(100vh-340px)] min-h-[400px]">
                    <div className="space-y-4 pr-4">
                      {/* Context Section */}
                      {onReanalyze && video.id === activeVideoId && (
                        <ContextSection
                          userContextPre={analysis.user_context_pre}
                          userContextPost={pendingContexts[video.id] ?? analysis.user_context_post}
                          analysisCount={analysis.analysis_count}
                          lastAnalyzedAt={analysis.last_analyzed_at}
                          onContextChange={handleContextChange}
                          onReanalyze={handleReanalyze}
                          isReanalyzing={isReanalyzing}
                          hasChanges={hasTranscriptChanges || hasContextChanges}
                        />
                      )}

                      {/* Primary Issue */}
                      <AnalysisCard
                        title="Primary Issue"
                        icon={<Target className="h-4 w-4" />}
                        accentColor="blue"
                      >
                        <div className="space-y-3">
                          {analysis.issue_primary && (
                            <span className="inline-flex rounded-full bg-blue-500/20 border border-blue-500/40 px-3 py-1 text-sm font-medium text-blue-400">
                              {analysis.issue_primary}
                            </span>
                          )}
                          <TagList items={analysis.issue_tags} accentColor="blue" />
                        </div>
                      </AnalysisCard>

                      {/* Tone */}
                      <AnalysisCard
                        title="Tone"
                        icon={<MessageSquare className="h-4 w-4" />}
                        accentColor="purple"
                      >
                        <div className="space-y-3">
                          {analysis.tone_primary && (
                            <span className="inline-flex rounded-full bg-[#a855f7]/20 border border-[#a855f7]/40 px-3 py-1 text-sm font-medium text-[#a855f7]">
                              {analysis.tone_primary}
                            </span>
                          )}
                          <TagList items={analysis.tone_tags} accentColor="purple" />
                        </div>
                      </AnalysisCard>

                      {/* Targets Attacked */}
                      <AnalysisCard
                        title="Targets Attacked"
                        icon={<AlertTriangle className="h-4 w-4" />}
                        accentColor="red"
                      >
                        <BulletList items={analysis.targets_attacked} />
                      </AnalysisCard>

                      {/* Targets Supported */}
                      {analysis.targets_supported && analysis.targets_supported.length > 0 && (
                        <AnalysisCard
                          title="Targets Supported"
                          icon={<ThumbsUp className="h-4 w-4" />}
                          accentColor="green"
                        >
                          <BulletList items={analysis.targets_supported} />
                        </AnalysisCard>
                      )}

                      {/* Pain Points */}
                      <AnalysisCard
                        title="Donor Pain Points"
                        icon={<Heart className="h-4 w-4" />}
                        accentColor="orange"
                      >
                        <BulletList items={analysis.donor_pain_points} />
                      </AnalysisCard>

                      {/* Values Appealed */}
                      {analysis.values_appealed && analysis.values_appealed.length > 0 && (
                        <AnalysisCard
                          title="Values Appealed"
                          icon={<Shield className="h-4 w-4" />}
                          accentColor="blue"
                        >
                          <TagList items={analysis.values_appealed} accentColor="blue" />
                        </AnalysisCard>
                      )}

                      {/* Urgency Drivers */}
                      {analysis.urgency_drivers && analysis.urgency_drivers.length > 0 && (
                        <AnalysisCard
                          title="Urgency Drivers"
                          icon={<Flame className="h-4 w-4" />}
                          accentColor="orange"
                        >
                          <BulletList items={analysis.urgency_drivers} />
                        </AnalysisCard>
                      )}

                      {/* Topic & Urgency Level Row */}
                      <div className="grid grid-cols-2 gap-4">
                        {analysis.topic_primary && (
                          <AnalysisCard
                            title="Topic"
                            icon={<Tag className="h-4 w-4" />}
                            accentColor="purple"
                          >
                            <span className="inline-flex rounded-full bg-[#a855f7]/20 border border-[#a855f7]/40 px-3 py-1 text-sm font-medium text-[#a855f7]">
                              {analysis.topic_primary}
                            </span>
                            {analysis.topic_tags && analysis.topic_tags.length > 0 && (
                              <div className="mt-2">
                                <TagList items={analysis.topic_tags} accentColor="purple" />
                              </div>
                            )}
                          </AnalysisCard>
                        )}
                        {analysis.urgency_level && (
                          <AnalysisCard
                            title="Urgency Level"
                            icon={<Gauge className="h-4 w-4" />}
                            accentColor="orange"
                          >
                            <span className={cn(
                              'inline-flex rounded-full px-3 py-1 text-sm font-medium border',
                              analysis.urgency_level === 'high' ? 'bg-[#ef4444]/20 border-[#ef4444]/40 text-[#ef4444]' :
                              analysis.urgency_level === 'medium' ? 'bg-[#f97316]/20 border-[#f97316]/40 text-[#f97316]' :
                              'bg-[#22c55e]/20 border-[#22c55e]/40 text-[#22c55e]'
                            )}>
                              {analysis.urgency_level.charAt(0).toUpperCase() + analysis.urgency_level.slice(1)}
                            </span>
                          </AnalysisCard>
                        )}
                      </div>

                      {/* Sentiment Score */}
                      {analysis.sentiment_score !== undefined && analysis.sentiment_score !== null && (
                        <AnalysisCard
                          title="Sentiment Score"
                          icon={<BarChart3 className="h-4 w-4" />}
                          accentColor="blue"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2 rounded-full bg-[#1e2a45] overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full rounded-full transition-all',
                                    analysis.sentiment_score > 0 ? 'bg-[#22c55e]' :
                                    analysis.sentiment_score < 0 ? 'bg-[#ef4444]' : 'bg-[#64748b]'
                                  )}
                                  style={{ width: `${Math.abs(analysis.sentiment_score) * 50 + 50}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium text-[#e2e8f0] tabular-nums">
                                {analysis.sentiment_score.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between text-xs text-[#64748b]">
                              <span>Negative</span>
                              <span>Neutral</span>
                              <span>Positive</span>
                            </div>
                          </div>
                        </AnalysisCard>
                      )}

                      {/* CTA Text */}
                      {analysis.cta_text && (
                        <AnalysisCard
                          title="Call to Action"
                          icon={<Megaphone className="h-4 w-4" />}
                          accentColor="green"
                        >
                          <p className="text-sm text-[#e2e8f0] font-medium">"{analysis.cta_text}"</p>
                        </AnalysisCard>
                      )}

                      {/* Key Phrases */}
                      <AnalysisCard
                        title="Key Phrases"
                        icon={<Quote className="h-4 w-4" />}
                        accentColor="green"
                      >
                        <div className="space-y-2">
                          {analysis.key_phrases.length === 0 ? (
                            <span className="text-sm text-[#64748b] italic">None detected</span>
                          ) : (
                            analysis.key_phrases.map((phrase, idx) => (
                              <p key={idx} className="text-sm text-[#e2e8f0] italic">
                                "{phrase}"
                              </p>
                            ))
                          )}
                        </div>
                      </AnalysisCard>
                    </div>
                  </ScrollArea>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  {(video.status === 'transcribing' || video.status === 'analyzing' || video.status === 'extracting') ? (
                    <>
                      <Loader2 className="h-12 w-12 text-blue-400 mb-4 animate-spin" />
                      <p className="text-[#e2e8f0] font-medium">Analysis in progress...</p>
                      <p className="text-sm text-[#94a3b8] mt-1">
                        {video.status === 'transcribing' ? 'Transcribing audio...' :
                         video.status === 'analyzing' ? 'Analyzing content...' :
                         'Extracting audio...'}
                      </p>
                      <p className="text-xs text-[#64748b] mt-3">This usually takes 30-60 seconds</p>
                    </>
                  ) : (
                    <>
                      <FileText className="h-12 w-12 text-[#64748b] mb-4" />
                      <p className="text-[#94a3b8]">No analysis available for this video</p>
                      {video.status === 'error' && video.error_message && (
                        <p className="text-xs text-[#ef4444] mt-2">{video.error_message}</p>
                      )}
                    </>
                  )}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-[#1e2a45]">
        <Button
          type="button"
          onClick={onBack}
          variant="outline"
          className="gap-2 bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <Button
          type="button"
          onClick={onComplete}
          className={cn(
            'gap-2',
            'bg-blue-600 hover:bg-blue-500 text-white'
          )}
        >
          Next: Configure Campaign
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default TranscriptReviewStep;
