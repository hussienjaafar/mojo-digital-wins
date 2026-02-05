/**
 * CampaignConfigStep - Step 3 of the Ad Copy Studio wizard
 *
 * Configure campaign settings including:
 * - ActBlue form selection
 * - Refcode generation/editing
 * - Amount preset and recurring defaults
 * - Target audience segments management
 */

import { useState, useCallback } from 'react';
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
} from 'lucide-react';
import type { CampaignConfig, AudienceSegment } from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface CampaignConfigStepProps {
  config: CampaignConfig;
  onConfigChange: (config: CampaignConfig) => void;
  actblueForms: string[];
  onBack: () => void;
  onComplete: () => void;
}

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
        className="rounded-lg border border-blue-500/30 bg-[#0a0f1a] p-4"
      >
        <div className="space-y-3">
          <Input
            type="text"
            value={editName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Segment name"
            className="bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b]"
            autoFocus
          />
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
              disabled={!editName.trim()}
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
      className="rounded-lg border border-[#1e2a45] bg-[#0a0f1a] p-4"
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

  // Computed
  const canProceed =
    config.actblue_form_name &&
    config.refcode &&
    config.audience_segments.length > 0;

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
    // Generate a new refcode based on current date
    const date = new Date();
    const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const shortId = Math.random().toString(36).substring(2, 6);
    const newRefcode = `campaign-${dateStr}-${shortId}`;
    onConfigChange({
      ...config,
      refcode: newRefcode,
      refcode_auto_generated: true,
    });
  }, [config, onConfigChange]);

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
  }, []);

  const handleCancelEditSegment = useCallback(() => {
    setEditingSegmentId(null);
    setEditName('');
    setEditDescription('');
  }, []);

  const handleSaveEditSegment = useCallback(() => {
    if (!editingSegmentId || !editName.trim()) return;

    const updatedSegments = config.audience_segments.map((seg) =>
      seg.id === editingSegmentId
        ? { ...seg, name: editName.trim(), description: editDescription.trim() }
        : seg
    );

    onConfigChange({ ...config, audience_segments: updatedSegments });
    handleCancelEditSegment();
  }, [config, onConfigChange, editingSegmentId, editName, editDescription, handleCancelEditSegment]);

  const handleDeleteSegment = useCallback(
    (segmentId: string) => {
      const updatedSegments = config.audience_segments.filter((seg) => seg.id !== segmentId);
      onConfigChange({ ...config, audience_segments: updatedSegments });
    },
    [config, onConfigChange]
  );

  // Adding new segment
  const handleStartAddSegment = useCallback(() => {
    setIsAddingSegment(true);
    setNewSegmentName('');
    setNewSegmentDescription('');
  }, []);

  const handleCancelAddSegment = useCallback(() => {
    setIsAddingSegment(false);
    setNewSegmentName('');
    setNewSegmentDescription('');
  }, []);

  const handleSaveNewSegment = useCallback(() => {
    if (!newSegmentName.trim()) return;

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
  }, [config, onConfigChange, newSegmentName, newSegmentDescription, handleCancelAddSegment]);

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
              {actblueForms.map((form) => (
                <SelectItem key={form} value={form}>
                  {form}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Refcode */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium uppercase tracking-wider text-[#64748b]">
              Refcode
            </Label>
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
          <p className="text-xs text-[#64748b]">
            {config.refcode_auto_generated
              ? 'Auto-generated from video analysis. Edit if needed.'
              : 'Custom refcode entered.'}
          </p>
        </div>

        {/* Amount & Recurring Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Amount Preset */}
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

          {/* Recurring Default */}
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
                  className="rounded-lg border border-blue-500/30 bg-[#0a0f1a] p-4"
                >
                  <div className="space-y-3">
                    <Input
                      type="text"
                      value={newSegmentName}
                      onChange={(e) => setNewSegmentName(e.target.value)}
                      placeholder="Segment name (e.g., First-Time Donors)"
                      className="bg-[#141b2d] border-[#1e2a45] text-[#e2e8f0] placeholder:text-[#64748b]"
                      autoFocus
                    />
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
                        disabled={!newSegmentName.trim()}
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
                  onStartEdit={() => handleStartEditSegment(segment)}
                  onCancelEdit={handleCancelEditSegment}
                  onSaveEdit={handleSaveEditSegment}
                  onDelete={() => handleDeleteSegment(segment.id)}
                  onNameChange={setEditName}
                  onDescriptionChange={setEditDescription}
                />
              ))}
            </AnimatePresence>

            {/* Empty State */}
            {config.audience_segments.length === 0 && !isAddingSegment && (
              <div className="rounded-lg border border-dashed border-[#1e2a45] bg-[#0a0f1a]/50 p-8 text-center">
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
