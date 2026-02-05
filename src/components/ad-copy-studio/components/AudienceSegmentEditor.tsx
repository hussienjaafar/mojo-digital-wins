/**
 * AudienceSegmentEditor - Reusable component for managing audience segments
 *
 * Extracted from CampaignConfigStep for reuse across the application.
 * Handles add/edit/remove operations for audience segments.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Pencil, Trash2, X, Check, Users } from 'lucide-react';
import type { AudienceSegment } from '@/types/ad-copy-studio';

// =============================================================================
// Types
// =============================================================================

export interface AudienceSegmentEditorProps {
  segments: AudienceSegment[];
  onAdd: (segment: Omit<AudienceSegment, 'id'>) => void;
  onEdit: (id: string, updates: Partial<Omit<AudienceSegment, 'id'>>) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

// =============================================================================
// Helper Components
// =============================================================================

interface SegmentCardProps {
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
  disabled?: boolean;
}

function SegmentCard({
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
  disabled,
}: SegmentCardProps) {
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
            disabled={disabled}
            className={cn(
              'rounded-md p-1.5 text-[#94a3b8] hover:bg-[#1e2a45] hover:text-[#e2e8f0] transition-colors',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            aria-label={`Edit ${segment.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className={cn(
              'rounded-md p-1.5 text-[#ef4444]/80 hover:bg-[#ef4444]/10 hover:text-[#ef4444] transition-colors',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
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

export function AudienceSegmentEditor({
  segments,
  onAdd,
  onEdit,
  onRemove,
  disabled = false,
}: AudienceSegmentEditorProps) {
  // State
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isAddingSegment, setIsAddingSegment] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [newSegmentDescription, setNewSegmentDescription] = useState('');

  // =========================================================================
  // Handlers
  // =========================================================================

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

    onEdit(editingSegmentId, {
      name: editName.trim(),
      description: editDescription.trim(),
    });
    handleCancelEditSegment();
  }, [editingSegmentId, editName, editDescription, onEdit, handleCancelEditSegment]);

  const handleDeleteSegment = useCallback(
    (segmentId: string) => {
      onRemove(segmentId);
    },
    [onRemove]
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

    onAdd({
      name: newSegmentName.trim(),
      description: newSegmentDescription.trim(),
    });
    handleCancelAddSegment();
  }, [newSegmentName, newSegmentDescription, onAdd, handleCancelAddSegment]);

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div className="space-y-4">
      {/* Header */}
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
          disabled={isAddingSegment || disabled}
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
          {segments.map((segment) => (
            <SegmentCard
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
              disabled={disabled}
            />
          ))}
        </AnimatePresence>

        {/* Empty State */}
        {segments.length === 0 && !isAddingSegment && (
          <div className="rounded-lg border border-dashed border-[#1e2a45] bg-[#0a0f1a]/50 p-8 text-center">
            <Users className="h-10 w-10 text-[#64748b] mx-auto mb-3" />
            <p className="text-sm text-[#94a3b8]">No audience segments defined yet.</p>
            <p className="text-xs text-[#64748b] mt-1">
              Add at least one target audience to generate personalized ad copy.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AudienceSegmentEditor;
