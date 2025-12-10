import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Clock, Sparkles, Copy, CheckCircle2, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
} from "@/components/v3";
import { cn } from "@/lib/utils";

interface MagicMomentCardProps {
  entityName: string;
  entityType: string;
  opportunityScore: number;
  velocity: number;
  estimatedValue?: number;
  similarPastEvents: number;
  historicalContext?: string;
  aiGeneratedMessage: string;
  messageVariants?: string[];
  optimalSendTime?: {
    time: string;
    reason: string;
  };
  detectedAt: string;
  onSendMessage: (message: string) => void;
}

export function MagicMomentCard({
  entityName,
  entityType,
  opportunityScore,
  velocity,
  estimatedValue,
  similarPastEvents,
  historicalContext,
  aiGeneratedMessage,
  messageVariants = [],
  optimalSendTime,
  detectedAt,
  onSendMessage,
}: MagicMomentCardProps) {
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [copied, setCopied] = useState(false);

  const currentMessage = messageVariants[selectedVariant] || aiGeneratedMessage;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Message copied to clipboard");
  };

  const handleSend = () => {
    onSendMessage(currentMessage);
    toast.success("Message ready to send!");
  };

  // Determine accent color based on opportunity score
  const getAccentFromScore = (score: number) => {
    if (score >= 80) return "green";
    if (score >= 60) return "blue";
    return "purple";
  };

  const accent = getAccentFromScore(opportunityScore);

  return (
    <V3Card
      accent={accent}
      className="relative overflow-hidden"
    >
      {/* Magic sparkle effect */}
      <motion.div
        className="absolute top-4 right-4 z-10"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.7, 1, 0.7],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Sparkles className="h-6 w-6 text-[hsl(var(--portal-accent-purple))]" />
      </motion.div>

      <V3CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4 pr-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <motion.div
                className="p-2 rounded-lg bg-[hsl(var(--portal-accent-purple)/0.1)]"
                whileHover={{ scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <Zap className="h-5 w-5 text-[hsl(var(--portal-accent-purple))]" />
              </motion.div>
              <h3 className="text-xl sm:text-2xl font-bold text-[hsl(var(--portal-text-primary))]">
                Magic Moment Detected
              </h3>
            </div>
            <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
              {formatDistanceToNow(new Date(detectedAt), { addSuffix: true })}
            </p>
          </div>
          <div className="text-right">
            <motion.div
              className={cn(
                "text-3xl font-bold tabular-nums",
                opportunityScore >= 80
                  ? "text-[hsl(var(--portal-success))]"
                  : opportunityScore >= 60
                  ? "text-[hsl(var(--portal-accent-blue))]"
                  : "text-[hsl(var(--portal-accent-purple))]"
              )}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              {opportunityScore.toFixed(0)}
            </motion.div>
            <p className="text-xs text-[hsl(var(--portal-text-muted))]">Score</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <Badge
            variant="outline"
            className="text-sm capitalize bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))]"
          >
            {entityType}
          </Badge>
          <span className="text-base sm:text-lg font-semibold text-[hsl(var(--portal-text-primary))]">
            {entityName}
          </span>
        </div>
      </V3CardHeader>

      <V3CardContent className="space-y-5">
        {/* Trigger Event */}
        <div className="p-4 bg-[hsl(var(--portal-bg-elevated))] rounded-lg border border-[hsl(var(--portal-border))]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--portal-accent-blue))]" />
            <span className="font-semibold text-sm text-[hsl(var(--portal-text-primary))]">
              Trigger Event
            </span>
          </div>
          <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
            {entityName} is surging with {velocity.toFixed(0)}% velocity.
            {similarPastEvents > 0 && ` Similar moments raised funds ${similarPastEvents} time(s) before.`}
          </p>
        </div>

        {/* Historical Context */}
        {(estimatedValue || historicalContext) && (
          <div className="p-4 bg-[hsl(var(--portal-success)/0.05)] rounded-lg border border-[hsl(var(--portal-success)/0.2)]">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-[hsl(var(--portal-success))]" />
              <span className="font-semibold text-sm text-[hsl(var(--portal-text-primary))]">
                Historical Performance
              </span>
            </div>
            {estimatedValue && (
              <p className="text-sm mb-2">
                <span className="text-2xl font-bold text-[hsl(var(--portal-success))]">
                  ${estimatedValue.toFixed(0)}
                </span>
                <span className="text-[hsl(var(--portal-text-secondary))] ml-2">
                  raised in similar 48h windows
                </span>
              </p>
            )}
            {historicalContext && (
              <p className="text-sm text-[hsl(var(--portal-text-secondary))]">{historicalContext}</p>
            )}
          </div>
        )}

        {/* Separator */}
        <div className="h-px bg-[hsl(var(--portal-border))]" />

        {/* AI-Generated Message */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[hsl(var(--portal-accent-purple))]" />
              <span className="font-semibold text-[hsl(var(--portal-text-primary))]">
                AI-Generated Message
              </span>
            </div>
            {messageVariants.length > 1 && (
              <div className="flex gap-1">
                {messageVariants.map((_, idx) => (
                  <motion.button
                    key={idx}
                    className={cn(
                      "h-8 w-8 rounded-md text-sm font-medium transition-colors",
                      selectedVariant === idx
                        ? "bg-[hsl(var(--portal-accent-blue))] text-white"
                        : "bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-secondary))] hover:bg-[hsl(var(--portal-bg-tertiary))]"
                    )}
                    onClick={() => setSelectedVariant(idx)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {idx + 1}
                  </motion.button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-[hsl(var(--portal-bg-base))] rounded-lg border-2 border-[hsl(var(--portal-accent-purple)/0.2)]">
            <AnimatePresence mode="wait">
              <motion.p
                key={selectedVariant}
                className="text-base leading-relaxed text-[hsl(var(--portal-text-primary))]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {currentMessage}
              </motion.p>
            </AnimatePresence>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[hsl(var(--portal-border))]">
              <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                {currentMessage.length}/160 characters
              </span>
              {messageVariants.length > 1 && (
                <span className="text-xs text-[hsl(var(--portal-text-muted))]">
                  Variant {selectedVariant + 1} of {messageVariants.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Optimal Send Time */}
        {optimalSendTime && (
          <div className="flex items-center gap-3 p-3 bg-[hsl(var(--portal-bg-elevated))] rounded-lg border border-[hsl(var(--portal-border))]">
            <Clock className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
            <div className="flex-1">
              <div className="font-semibold text-sm text-[hsl(var(--portal-text-primary))]">
                Best Time to Send
              </div>
              <div className="text-sm text-[hsl(var(--portal-text-secondary))]">
                {optimalSendTime.time} - {optimalSendTime.reason}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleCopy}
              variant="outline"
              className="w-full gap-2 border-[hsl(var(--portal-border))] hover:bg-[hsl(var(--portal-bg-elevated))]"
            >
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-[hsl(var(--portal-success))]" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Message
                </>
              )}
            </Button>
          </motion.div>
          <motion.div className="flex-1" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              onClick={handleSend}
              className="w-full gap-2 bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.9)] text-white"
            >
              <Zap className="h-4 w-4" />
              Use This Message
            </Button>
          </motion.div>
        </div>
      </V3CardContent>
    </V3Card>
  );
}
