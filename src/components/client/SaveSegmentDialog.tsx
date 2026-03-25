import React, { useState } from "react";
import { Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { V3Button } from "@/components/v3";

interface SaveSegmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description: string) => void;
  donorCount: number;
  isLoading?: boolean;
}

export function SaveSegmentDialog({
  open,
  onOpenChange,
  onSave,
  donorCount,
  isLoading,
}: SaveSegmentDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim(), description.trim());
    setName('');
    setDescription('');
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[hsl(var(--portal-text-primary))]">
            <Save className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            Save Segment
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--portal-text-muted))]">
            Save this segment to quickly access it later. The current filter configuration 
            and donor count ({donorCount.toLocaleString()}) will be saved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="segment-name" className="text-[hsl(var(--portal-text-primary))]">
              Segment Name
            </Label>
            <Input
              id="segment-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., High-Value At-Risk Donors"
              className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="segment-description" className="text-[hsl(var(--portal-text-primary))]">
              Description (optional)
            </Label>
            <Textarea
              id="segment-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the purpose of this segment..."
              className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <V3Button variant="ghost" onClick={handleClose} disabled={isLoading}>
            Cancel
          </V3Button>
          <V3Button
            onClick={handleSave}
            disabled={!name.trim() || isLoading}
          >
            {isLoading ? 'Saving...' : 'Save Segment'}
          </V3Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
