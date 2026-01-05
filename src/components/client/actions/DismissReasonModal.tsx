import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface DismissReason {
  code: string;
  label: string;
  description?: string;
}

export const DISMISS_REASONS: DismissReason[] = [
  { 
    code: 'not_relevant', 
    label: 'Not relevant',
    description: 'This topic doesn\'t align with our work'
  },
  { 
    code: 'tone_off', 
    label: 'Tone doesn\'t match',
    description: 'The voice/style doesn\'t fit our brand'
  },
  { 
    code: 'too_risky', 
    label: 'Too risky',
    description: 'The topic or message is too controversial'
  },
  { 
    code: 'too_long', 
    label: 'Message too long',
    description: 'Need a shorter, punchier message'
  },
  { 
    code: 'already_used', 
    label: 'Already using similar',
    description: 'We\'re already running a similar message'
  },
  { 
    code: 'other', 
    label: 'Other',
    description: 'Another reason (please specify)'
  },
];

interface DismissReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reasonCode: string, reasonDetail?: string) => void;
  actionTopic?: string;
  isLoading?: boolean;
}

export function DismissReasonModal({
  isOpen,
  onClose,
  onConfirm,
  actionTopic,
  isLoading = false,
}: DismissReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherDetail, setOtherDetail] = useState("");

  const handleConfirm = () => {
    if (!selectedReason) return;
    
    const detail = selectedReason === 'other' ? otherDetail.trim() : undefined;
    onConfirm(selectedReason, detail);
    
    // Reset state
    setSelectedReason(null);
    setOtherDetail("");
  };

  const handleClose = () => {
    setSelectedReason(null);
    setOtherDetail("");
    onClose();
  };

  const canConfirm = selectedReason && (selectedReason !== 'other' || otherDetail.trim().length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]">
        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--portal-text-primary))]">
            Dismiss Suggestion
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--portal-text-secondary))]">
            {actionTopic 
              ? `Help us improve by telling us why "${actionTopic}" isn't a good fit.`
              : 'Help us improve by telling us why this suggestion isn\'t a good fit.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          {DISMISS_REASONS.map((reason) => (
            <motion.button
              key={reason.code}
              onClick={() => setSelectedReason(reason.code)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all",
                "focus:outline-none focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue)/0.5)]",
                selectedReason === reason.code
                  ? "border-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-accent-blue)/0.1)]"
                  : "border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-border-hover))] bg-[hsl(var(--portal-bg-card))]"
              )}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors",
                    selectedReason === reason.code
                      ? "border-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-accent-blue))]"
                      : "border-[hsl(var(--portal-border))]"
                  )}
                >
                  {selectedReason === reason.code && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-full h-full flex items-center justify-center"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    </motion.div>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                    {reason.label}
                  </p>
                  {reason.description && (
                    <p className="text-xs text-[hsl(var(--portal-text-tertiary))] mt-0.5">
                      {reason.description}
                    </p>
                  )}
                </div>
              </div>
            </motion.button>
          ))}
        </div>

        {/* Other reason text input */}
        <AnimatePresence>
          {selectedReason === 'other' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Textarea
                placeholder="Please tell us more..."
                value={otherDetail}
                onChange={(e) => setOtherDetail(e.target.value)}
                className="min-h-[80px] bg-[hsl(var(--portal-bg-card))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))] placeholder:text-[hsl(var(--portal-text-tertiary))]"
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
            className="border-[hsl(var(--portal-border))]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || isLoading}
            className="bg-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.9)] text-white"
          >
            {isLoading ? 'Dismissing...' : 'Dismiss'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
