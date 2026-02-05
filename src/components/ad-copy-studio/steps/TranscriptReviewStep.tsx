/**
 * TranscriptReviewStep - Step 2 of the Ad Copy Studio wizard
 *
 * Allows users to review transcripts and AI analysis for each uploaded video.
 *
 * Displays:
 * - Tabs for each video
 * - Left panel: Scrollable transcript text with edit capability
 * - Right panel: Analysis cards (Primary Issue, Tone, Targets, Pain Points, Key Phrases)
 * - Progress tracking (Reviewed: X/Y videos)
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
} from 'lucide-react';
import type { VideoUpload, TranscriptAnalysis } from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface TranscriptReviewStepProps {
  videos: VideoUpload[];
  analyses: Record<string, TranscriptAnalysis>;
  onBack: () => void;
  onComplete: () => void;
}

// =============================================================================
// Helper Components
// =============================================================================

interface AnalysisCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accentColor?: string;
}

function AnalysisCard({ title, icon, children, accentColor = 'blue' }: AnalysisCardProps) {
  const colorMap: Record<string, string> = {
    blue: 'border-blue-500/30 bg-blue-500/5',
    purple: 'border-[#a855f7]/30 bg-[#a855f7]/5',
    orange: 'border-[#f97316]/30 bg-[#f97316]/5',
    red: 'border-[#ef4444]/30 bg-[#ef4444]/5',
    green: 'border-[#22c55e]/30 bg-[#22c55e]/5',
  };

  const iconColorMap: Record<string, string> = {
    blue: 'text-blue-400',
    purple: 'text-[#a855f7]',
    orange: 'text-[#f97316]',
    red: 'text-[#ef4444]',
    green: 'text-[#22c55e]',
  };

  return (
    <div className={cn('rounded-lg border p-4', colorMap[accentColor])}>
      <div className="flex items-center gap-2 mb-3">
        <span className={iconColorMap[accentColor]}>{icon}</span>
        <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
          {title}
        </span>
      </div>
      <div>{children}</div>
    </div>
  );
}

interface TagListProps {
  items: string[];
  accentColor?: string;
}

function TagList({ items, accentColor = 'blue' }: TagListProps) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    purple: 'bg-[#a855f7]/10 border-[#a855f7]/30 text-[#a855f7]',
    orange: 'bg-[#f97316]/10 border-[#f97316]/30 text-[#f97316]',
    red: 'bg-[#ef4444]/10 border-[#ef4444]/30 text-[#ef4444]',
    green: 'bg-[#22c55e]/10 border-[#22c55e]/30 text-[#22c55e]',
  };

  if (items.length === 0) {
    return <span className="text-sm text-[#64748b] italic">None detected</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <span
          key={idx}
          className={cn('inline-flex rounded-full border px-2.5 py-0.5 text-xs', colorMap[accentColor])}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

interface BulletListProps {
  items: string[];
}

function BulletList({ items }: BulletListProps) {
  if (items.length === 0) {
    return <span className="text-sm text-[#64748b] italic">None detected</span>;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item, idx) => (
        <li key={idx} className="flex items-start gap-2 text-sm text-[#e2e8f0]">
          <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#64748b]" />
          {item}
        </li>
      ))}
    </ul>
  );
}

// =============================================================================
// Component
// =============================================================================

export function TranscriptReviewStep({
  videos,
  analyses,
  onBack,
  onComplete,
}: TranscriptReviewStepProps) {
  // State
  const [activeVideoId, setActiveVideoId] = useState(videos[0]?.id || '');
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [reviewedVideos, setReviewedVideos] = useState<Set<string>>(new Set());

  // Computed
  const activeAnalysis = analyses[activeVideoId];
  const reviewedCount = reviewedVideos.size;
  const totalCount = videos.length;
  const canProceed = reviewedCount === totalCount;

  // Get video index for tab display
  const getVideoIndex = (videoId: string) => {
    return videos.findIndex((v) => v.id === videoId) + 1;
  };

  // =========================================================================
  // Handlers
  // =========================================================================

  const handleTabChange = useCallback(
    (videoId: string) => {
      // Mark previous video as reviewed when switching
      if (activeVideoId && !reviewedVideos.has(activeVideoId)) {
        setReviewedVideos((prev) => new Set([...prev, activeVideoId]));
      }
      setActiveVideoId(videoId);
      setEditingTranscript(false);
    },
    [activeVideoId, reviewedVideos]
  );

  const handleStartEdit = useCallback(() => {
    if (activeAnalysis) {
      setEditedTranscript(activeAnalysis.transcript_text);
      setEditingTranscript(true);
    }
  }, [activeAnalysis]);

  const handleCancelEdit = useCallback(() => {
    setEditingTranscript(false);
    setEditedTranscript('');
  }, []);

  const handleSaveEdit = useCallback(() => {
    // In a real implementation, this would save the edited transcript
    // For now, just close the editor
    setEditingTranscript(false);
    setEditedTranscript('');
  }, []);

  const handleComplete = useCallback(() => {
    // Mark current video as reviewed before proceeding
    if (activeVideoId && !reviewedVideos.has(activeVideoId)) {
      setReviewedVideos((prev) => new Set([...prev, activeVideoId]));
    }
    onComplete();
  }, [activeVideoId, reviewedVideos, onComplete]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-[#e2e8f0]">
          Review Transcripts & Analysis
        </h2>
        <p className="mt-2 text-[#94a3b8]">
          Review the AI-generated transcripts and analysis for each video
        </p>
      </div>

      {/* Video Tabs */}
      <Tabs value={activeVideoId} onValueChange={handleTabChange} className="w-full">
        <TabsList className="w-full justify-start gap-1 bg-[#141b2d] border border-[#1e2a45] p-1.5 rounded-lg h-auto flex-wrap">
          {videos.map((video) => {
            const index = getVideoIndex(video.id);
            const isReviewed = reviewedVideos.has(video.id);

            return (
              <TabsTrigger
                key={video.id}
                value={video.id}
                className={cn(
                  'relative gap-2 px-4 py-2 rounded-md transition-colors',
                  'data-[state=active]:bg-blue-600 data-[state=active]:text-white',
                  'data-[state=inactive]:bg-transparent data-[state=inactive]:text-[#94a3b8]',
                  'data-[state=inactive]:hover:bg-[#1e2a45] data-[state=inactive]:hover:text-[#e2e8f0]'
                )}
              >
                {isReviewed && (
                  <CheckCircle className="h-4 w-4 text-[#22c55e]" />
                )}
                <span>Video {index}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Tab Content */}
        {videos.map((video) => {
          const analysis = analyses[video.id];

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
                      </div>
                      {!editingTranscript && (
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
                      {editingTranscript ? (
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
                          <div className="flex justify-end gap-2 mt-4">
                            <Button
                              type="button"
                              onClick={handleCancelEdit}
                              variant="outline"
                              size="sm"
                              className="bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]"
                            >
                              <X className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              onClick={handleSaveEdit}
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-500 text-white"
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Save
                            </Button>
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
                                "{analysis.transcript_text}"
                              </p>
                            </div>
                          </ScrollArea>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Right Panel: Analysis */}
                  <ScrollArea className="h-[480px]">
                    <div className="space-y-4 pr-4">
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

                      {/* Pain Points */}
                      <AnalysisCard
                        title="Donor Pain Points"
                        icon={<Heart className="h-4 w-4" />}
                        accentColor="orange"
                      >
                        <BulletList items={analysis.donor_pain_points} />
                      </AnalysisCard>

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
                  <FileText className="h-12 w-12 text-[#64748b] mb-4" />
                  <p className="text-[#94a3b8]">No analysis available for this video</p>
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center">
        <span className="text-sm text-[#94a3b8]">
          Reviewed:{' '}
          <span className={cn('font-medium', canProceed ? 'text-[#22c55e]' : 'text-[#e2e8f0]')}>
            {reviewedCount}/{totalCount}
          </span>{' '}
          videos
        </span>
      </div>

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
          onClick={handleComplete}
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
