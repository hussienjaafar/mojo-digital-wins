/**
 * CampaignConfigStep - Step 3 of the Ad Copy Studio wizard
 *
 * Configure campaign settings including:
 * - ActBlue form selection
 * - Refcode generation/editing
 * - Amount preset and recurring defaults
 * - Target audience segments management
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Users,
  X,
  Check,
  Undo2,
} from 'lucide-react';
import type { CampaignConfig, AudienceSegment, VideoUpload, TranscriptAnalysis } from '@/types/ad-copy-studio';

// =============================================================================
// Helpers
// =============================================================================

function generateRefcode(orgName: string | undefined, filename: string, analysis?: TranscriptAnalysis): string {
  const orgSlug = (orgName || 'org')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .substring(0, 10);

  // Extract a distinctive topic slug from analysis, skipping generic prefixes
  let topicSlug = '';
  if (analysis) {
    const skipWords = new Set([
      'pro', 'anti', 'palestinian', 'palestine', 'israel', 'israeli',
      'muslim', 'and', 'the', 'of', 'in', 'for', 'to', 'a', 'an',
    ]);

    // Try issue_primary first, extracting meaningful words
    const issueWords = (analysis.issue_primary || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 1 && !skipWords.has(w));

    if (issueWords.length > 0) {
      // Take up to 2 meaningful words
      topicSlug = issueWords.slice(0, 2).join('');
    }

    // Fallback: first target attacked
    if (!topicSlug && analysis.targets_attacked?.length) {
      topicSlug = analysis.targets_attacked[0]
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    }

    // Fallback: topic_primary
    if (!topicSlug) {
      topicSlug = (analysis.topic_primary || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
    }
  }

  // Final fallback: filename
  if (!topicSlug) {
    topicSlug = filename
      .replace(/\.[^.]+$/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  topicSlug = topicSlug.substring(0, 12);

  const date = new Date();
  const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  const shortId = Math.random().toString(36).substring(2, 6);

  return `${orgSlug}-${topicSlug}-${dateStr}-${shortId}`;
}

// =============================================================================
// Types
// =============================================================================

export interface CampaignConfigStepProps {
  config: CampaignConfig;
  onConfigChange: (config: CampaignConfig) => void;
  actblueForms: string[];
  videos: VideoUpload[];
  organizationName?: string;
  analyses?: Record<string, TranscriptAnalysis>;
  onBack: () => void;
  onComplete: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const PRESET_SEGMENTS = [
  { name: 'Progressive Base', description: 'Core progressive supporters who regularly engage with liberal causes and candidates.' },
  { name: 'Grassroots Donors', description: 'Small-dollar donors motivated by urgency and emotional appeals. Responsive to $5-$27 asks.' },
  { name: 'High-Dollar Donors', description: 'Donors capable of larger contributions, motivated by impact and policy outcomes.' },
  { name: 'Swing Voters', description: 'Persuadable moderates who respond to issue-based messaging rather than partisan appeals.' },
];

// =============================================================================
// Helper Functions
// =============================================================================

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// =============================================================================
// Helper Components
// =============================================================================

interface AudienceSegmentCardProps {
  segment: AudienceSegment;
  isEditing: boolean;
  editName: string;
  editDescription: string;
  nameError: string | null;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onDelete: () => void;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
}

function AudienceSegmentCard({
  segment,
  isEditing,
  editName,
  editDescription,
  nameError,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onNameChange,
  onDescriptionChange,
}: AudienceSegmentCardProps) {
  if (isEditing) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-blue-500/30 bg-[#0a0f1a] p-4"
      >
        <div className="space-y-3">
          <div>
            <Input
              type="text"
              value={editName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Segment name"
              className={cn(
                "bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b]",
                nameError && "border-[#ef4444]"
              )}
              autoFocus
            />
            {nameError && (
              <p className="text-xs text-[#ef4444] mt-1">{nameError}</p>
            )}
          </div>
          <Textarea
            value={editDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Describe this audience segment..."
            className="min-h-[80px] bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b] resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              onClick={onCancelEdit}
              variant="outline"
              size="sm"
              className="bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]"
            >
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button
              type="button"
              onClick={onSaveEdit}
              size="sm"
              disabled={!editName.trim() || !!nameError}
              className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
            >
              <Check className="h-4 w-4 mr-1" />
              Save
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="rounded-xl border border-[#1e2a45] bg-[#0a0f1a] p-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-[#e2e8f0]">{segment.name}</h4>
          <p className="mt-1 text-sm text-[#94a3b8] line-clamp-2">{segment.description}</p>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onStartEdit}
            className="rounded-md p-1.5 text-[#94a3b8] hover:bg-[#1e2a45] hover:text-[#e2e8f0] transition-colors"
            aria-label={`Edit ${segment.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md p-1.5 text-[#ef4444]/80 hover:bg-[#ef4444]/10 hover:text-[#ef4444] transition-colors"
            aria-label={`Delete ${segment.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Component
// =============================================================================

export function CampaignConfigStep({
  config,
  onConfigChange,
  actblueForms,
  videos,
  organizationName,
  analyses,
  onBack,
  onComplete,
}: CampaignConfigStepProps) {
  // State
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isAddingSegment, setIsAddingSegment] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newSegmentDescription, setNewSegmentDescription] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [editNameError, setEditNameError] = useState<string | null>(null);

  // Auto-generate per-video refcodes on mount if empty + prune stale entries
  useEffect(() => {
    const videosWithIds = videos.filter(v => v.video_id);
    if (videosWithIds.length === 0) return;

    const existingRefcodes = config.refcodes || {};
    const currentVideoIds = new Set(videosWithIds.map(v => v.video_id!));

    // Prune refcodes for videos that no longer exist
    const prunedRefcodes: Record<string, string> = {};
    for (const [vid, rc] of Object.entries(existingRefcodes)) {
      if (currentVideoIds.has(vid)) {
        prunedRefcodes[vid] = rc;
      }
    }

    const needsGeneration = videosWithIds.some(v => !prunedRefcodes[v.video_id!]);
    const wasPruned = Object.keys(existingRefcodes).length !== Object.keys(prunedRefcodes).length;

    if (needsGeneration || wasPruned) {
      const newRefcodes = { ...prunedRefcodes };
      videosWithIds.forEach((v) => {
        if (!newRefcodes[v.video_id!]) {
          newRefcodes[v.video_id!] = generateRefcode(organizationName, v.filename, analyses?.[v.video_id!]);
        }
      });
      const firstVideoId = videosWithIds[0]?.video_id;
      onConfigChange({
        ...config,
        refcodes: newRefcodes,
        refcode: firstVideoId ? newRefcodes[firstVideoId] : config.refcode || generateRefcode(organizationName, 'campaign'),
        refcode_auto_generated: true,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videos, analyses]);

  // Computed: require at least one refcode to be set
  const videosWithIds = videos.filter(v => v.video_id);
  const allRefcodesSet = videosWithIds.length > 0
    ? videosWithIds.every(v => config.refcodes?.[v.video_id!]?.trim())
    : !!config.refcode;

  const canProceed =
    config.actblue_form_name &&
    allRefcodesSet &&
    config.audience_segments.length > 0;

  // Issue A4: Check name uniqueness
  const isNameTaken = useCallback((name: string, excludeId?: string) => {
    return config.audience_segments.some(
      seg => seg.name.toLowerCase() === name.trim().toLowerCase() && seg.id !== excludeId
    );
  }, [config.audience_segments]);

  // Issue A3: Filter presets to show only unused ones
  const availablePresets = PRESET_SEGMENTS.filter(
    preset => !config.audience_segments.some(
      seg => seg.name.toLowerCase() === preset.name.toLowerCase()
    )
  );

  // =========================================================================
  // Handlers
  // =========================================================================

  const handleFormChange = useCallback(
    (value: string) => {
      onConfigChange({ ...config, actblue_form_name: value });
    },
    [config, onConfigChange]
  );

  const handleRefcodeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onConfigChange({
        ...config,
        refcode: e.target.value,
        refcode_auto_generated: false,
      });
    },
    [config, onConfigChange]
  );

  const handleRegenerateRefcode = useCallback(() => {
    const firstVideo = videos[0];
    const firstFilename = firstVideo?.filename || 'campaign';
    const firstAnalysis = firstVideo?.video_id ? analyses?.[firstVideo.video_id] : undefined;
    const newRefcode = generateRefcode(organizationName, firstFilename, firstAnalysis);
    onConfigChange({
      ...config,
      refcode: newRefcode,
      refcode_auto_generated: true,
    });
  }, [config, onConfigChange, organizationName, videos, analyses]);

  const handleRegenerateAllRefcodes = useCallback(() => {
    const vids = videos.filter(v => v.video_id);
    const newRefcodes: Record<string, string> = {};
    vids.forEach((v) => {
      newRefcodes[v.video_id!] = generateRefcode(organizationName, v.filename, analyses?.[v.video_id!]);
    });
    const firstVideoId = vids[0]?.video_id;
    onConfigChange({
      ...config,
      refcodes: newRefcodes,
      refcode: firstVideoId ? newRefcodes[firstVideoId] : config.refcode,
      refcode_auto_generated: true,
    });
    toast.success('All refcodes regenerated');
  }, [config, onConfigChange, organizationName, videos, analyses]);

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      onConfigChange({
        ...config,
        amount_preset: value ? parseInt(value, 10) : undefined,
      });
    },
    [config, onConfigChange]
  );

  const handleRecurringChange = useCallback(
    (checked: boolean) => {
      onConfigChange({ ...config, recurring_default: checked });
    },
    [config, onConfigChange]
  );

  // Segment editing
  const handleStartEditSegment = useCallback((segment: AudienceSegment) => {
    setEditingSegmentId(segment.id);
    setEditName(segment.name);
    setEditDescription(segment.description);
    setEditNameError(null);
  }, []);

  const handleCancelEditSegment = useCallback(() => {
    setEditingSegmentId(null);
    setEditName('');
    setEditDescription('');
    setEditNameError(null);
  }, []);

  // Issue A4: Validate name uniqueness on edit
  const handleEditNameChange = useCallback((value: string) => {
    setEditName(value);
    if (isNameTaken(value, editingSegmentId || undefined)) {
      setEditNameError('A segment with this name already exists');
    } else {
      setEditNameError(null);
    }
  }, [isNameTaken, editingSegmentId]);

  const handleSaveEditSegment = useCallback(() => {
    if (!editingSegmentId || !editName.trim() || editNameError) return;

    const updatedSegments = config.audience_segments.map((seg) =>
      seg.id === editingSegmentId
        ? { ...seg, name: editName.trim(), description: editDescription.trim() }
        : seg
    );

    onConfigChange({ ...config, audience_segments: updatedSegments });
    handleCancelEditSegment();
  }, [config, onConfigChange, editingSegmentId, editName, editDescription, editNameError, handleCancelEditSegment]);

  // Issue F1: Undo delete segment
  const handleDeleteSegment = useCallback(
    (segmentId: string) => {
      const deletedSegment = config.audience_segments.find(seg => seg.id === segmentId);
      const updatedSegments = config.audience_segments.filter((seg) => seg.id !== segmentId);
      onConfigChange({ ...config, audience_segments: updatedSegments });

      if (deletedSegment) {
        toast(`Deleted "${deletedSegment.name}"`, {
          action: {
            label: 'Undo',
            onClick: () => {
              onConfigChange({
                ...config,
                audience_segments: [...config.audience_segments],
              });
            },
          },
          duration: 5000,
        });
      }
    },
    [config, onConfigChange]
  );

  // Adding new segment
  const handleStartAddSegment = useCallback(() => {
    setIsAddingSegment(true);
    setNewSegmentName('');
    setNewSegmentDescription('');
    setNameError(null);
  }, []);

  const handleCancelAddSegment = useCallback(() => {
    setIsAddingSegment(false);
    setNewSegmentName('');
    setNewSegmentDescription('');
    setNameError(null);
  }, []);

  // Issue A4: Validate name uniqueness on new segment
  const handleNewNameChange = useCallback((value: string) => {
    setNewSegmentName(value);
    if (isNameTaken(value)) {
      setNameError('A segment with this name already exists');
    } else {
      setNameError(null);
    }
  }, [isNameTaken]);

  const handleSaveNewSegment = useCallback(() => {
    if (!newSegmentName.trim() || nameError) return;

    const newSegment: AudienceSegment = {
      id: generateId(),
      name: newSegmentName.trim(),
      description: newSegmentDescription.trim(),
    };

    onConfigChange({
      ...config,
      audience_segments: [...config.audience_segments, newSegment],
    });
    handleCancelAddSegment();
  }, [config, onConfigChange, newSegmentName, newSegmentDescription, nameError, handleCancelAddSegment]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-[#e2e8f0]">Configure Campaign</h2>
        <p className="mt-2 text-[#94a3b8]">
          Set up your ActBlue integration and target audiences
        </p>
      </div>

      {/* Form Fields */}
      <div className="space-y-6">
        {/* ActBlue Form */}
        <div className="space-y-2">
          <Label className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
            ActBlue Form
          </Label>
          <Select value={config.actblue_form_name} onValueChange={handleFormChange}>
            <SelectTrigger className="bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0]">
              <SelectValue placeholder="Select an ActBlue form" />
            </SelectTrigger>
            <SelectContent>
              {actblueForms.length > 0 ? (
                actblueForms.map((form) => (
                  <SelectItem key={form} value={form}>
                    {form}
                  </SelectItem>
                ))
              ) : (
                <div className="px-3 py-4 text-center">
                  <p className="text-sm text-[#94a3b8]">No ActBlue forms found</p>
                  <p className="text-xs text-[#64748b] mt-1">Forms appear after transaction data is imported.</p>
                </div>
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Per-Video Refcodes */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
              Refcodes
            </Label>
            {videosWithIds.length > 1 && (
              <button
                type="button"
                onClick={handleRegenerateAllRefcodes}
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate All
              </button>
            )}
          </div>
          {videosWithIds.length > 0 ? (
            <div className="space-y-3">
              {videosWithIds.map((video, idx) => {
                const videoId = video.video_id!;
                const refcode = config.refcodes?.[videoId] || '';
                return (
                  <div key={videoId} className="rounded-lg border border-[#1e2a45] bg-[#0a0f1a] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-[#e2e8f0] truncate">{video.filename}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="text"
                        value={refcode}
                        onChange={(e) => {
                          const newRefcodes = { ...config.refcodes, [videoId]: e.target.value };
                          onConfigChange({
                            ...config,
                            refcodes: newRefcodes,
                            refcode: videosWithIds[0]?.video_id === videoId ? e.target.value : config.refcode,
                            refcode_auto_generated: false,
                          });
                        }}
                        placeholder="Enter refcode"
                        className="bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b]"
                      />
                      <button
                        type="button"
                      onClick={() => {
                          const newRefcode = generateRefcode(organizationName, video.filename, analyses?.[videoId]);
                          const newRefcodes = { ...config.refcodes, [videoId]: newRefcode };
                          onConfigChange({
                            ...config,
                            refcodes: newRefcodes,
                            refcode: videosWithIds[0]?.video_id === videoId ? newRefcode : config.refcode,
                            refcode_auto_generated: true,
                          });
                        }}
                        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors flex-shrink-0"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleRegenerateRefcode}
                  className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </button>
              </div>
              <Input
                type="text"
                value={config.refcode}
                onChange={handleRefcodeChange}
                placeholder="Enter refcode"
                className="bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b]"
              />
            </div>
          )}
          <p className="text-xs text-[#64748b]">
            Each video gets its own refcode for tracking in Meta Ads Manager.
          </p>
        </div>

        {/* Amount & Recurring Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
              Amount Preset (optional)
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748b]">$</span>
              <Input
                type="number"
                value={config.amount_preset || ''}
                onChange={handleAmountChange}
                placeholder="25"
                min={1}
                className="pl-7 bg-[#0a0f1a] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
              Recurring Default
            </Label>
            <div className="flex items-center gap-3 h-10">
              <Checkbox
                id="recurring"
                checked={config.recurring_default}
                onCheckedChange={handleRecurringChange}
                className="border-[#1e2a45] data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <label
                htmlFor="recurring"
                className="text-sm text-[#e2e8f0] cursor-pointer select-none"
              >
                Monthly recurring donation
              </label>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#1e2a45]" />

        {/* Target Audiences Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#94a3b8]" />
              <span className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
                Target Audiences
              </span>
            </div>
            <Button
              type="button"
              onClick={handleStartAddSegment}
              disabled={isAddingSegment}
              size="sm"
              className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Segment
            </Button>
          </div>

          {/* Issue A3: Preset templates shown whenever unused presets remain */}
          {availablePresets.length > 0 && !isAddingSegment && (
            <div className="space-y-2">
              <span className="text-xs text-[#64748b]">Quick add common segments:</span>
              <div className="flex flex-wrap gap-2">
                {availablePresets.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      onConfigChange({
                        ...config,
                        audience_segments: [...config.audience_segments, { id: generateId(), ...preset }],
                      });
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#1e2a45] bg-[#0a0f1a] px-3 py-1.5 text-xs text-[#94a3b8] hover:border-blue-500/50 hover:text-blue-400 transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Segment List */}
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {/* New Segment Form */}
              {isAddingSegment && (
                <motion.div
                  key="new-segment"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-xl border border-blue-500/30 bg-[#0a0f1a] p-4"
                >
                  <div className="space-y-3">
                    <div>
                      <Input
                        type="text"
                        value={newSegmentName}
                        onChange={(e) => handleNewNameChange(e.target.value)}
                        placeholder="Segment name (e.g., First-Time Donors)"
                        className={cn(
                          "bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b]",
                          nameError && "border-[#ef4444]"
                        )}
                        autoFocus
                      />
                      {nameError && (
                        <p className="text-xs text-[#ef4444] mt-1">{nameError}</p>
                      )}
                    </div>
                    <Textarea
                      value={newSegmentDescription}
                      onChange={(e) => setNewSegmentDescription(e.target.value)}
                      placeholder="Describe this audience segment..."
                      className="min-h-[80px] bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b] resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        onClick={handleCancelAddSegment}
                        variant="outline"
                        size="sm"
                        className="bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] hover:bg-[#1e2a45]"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSaveNewSegment}
                        size="sm"
                        disabled={!newSegmentName.trim() || !!nameError}
                        className="bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Add Segment
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Existing Segments */}
              {config.audience_segments.map((segment) => (
                <AudienceSegmentCard
                  key={segment.id}
                  segment={segment}
                  isEditing={editingSegmentId === segment.id}
                  editName={editName}
                  editDescription={editDescription}
                  nameError={editingSegmentId === segment.id ? editNameError : null}
                  onStartEdit={() => handleStartEditSegment(segment)}
                  onCancelEdit={handleCancelEditSegment}
                  onSaveEdit={handleSaveEditSegment}
                  onDelete={() => handleDeleteSegment(segment.id)}
                  onNameChange={handleEditNameChange}
                  onDescriptionChange={setEditDescription}
                />
              ))}
            </AnimatePresence>

            {/* Empty State */}
            {config.audience_segments.length === 0 && !isAddingSegment && (
              <div className="rounded-xl border border-dashed border-[#1e2a45] bg-[#0a0f1a]/50 p-8 text-center">
                <Users className="h-10 w-10 text-[#64748b] mx-auto mb-3" />
                <p className="text-sm text-[#94a3b8]">
                  No audience segments defined yet.
                </p>
                <p className="text-xs text-[#64748b] mt-1">
                  Add at least one target audience to generate personalized ad copy.
                </p>
              </div>
            )}
          </div>
        </div>
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
          onClick={onComplete}
          disabled={!canProceed}
          className={cn(
            'gap-2',
            canProceed
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-[#1e2a45] text-[#64748b] cursor-not-allowed'
          )}
        >
          Next: Generate Copy
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export default CampaignConfigStep;
