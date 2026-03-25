import { useState, useMemo } from "react";
import { differenceInDays, format, parseISO, isValid } from "date-fns";
import { Calendar, Clock, AlertTriangle, CheckCircle, Flame } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { V3Card, V3CardContent } from "@/components/v3/V3Card";
import { V3Badge } from "@/components/v3/V3Badge";
import { V3Button } from "@/components/v3/V3Button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ElectionCountdownProps {
  /** Election date in ISO format (YYYY-MM-DD) */
  electionDate: string | null;
  /** Election name/label (e.g., "Primary Election", "General Election") */
  electionName?: string;
  /** Callback when election date is updated */
  onElectionDateChange?: (date: string) => void;
  /** Whether the user can edit the election date */
  canEdit?: boolean;
  /** Variant: "header" for dashboard header, "card" for standalone card */
  variant?: "header" | "card" | "badge";
  /** Additional className */
  className?: string;
}

interface UrgencyConfig {
  color: "green" | "amber" | "red";
  label: string;
  description: string;
  icon: typeof CheckCircle;
}

function getUrgencyConfig(daysRemaining: number): UrgencyConfig {
  if (daysRemaining < 0) {
    return {
      color: "green",
      label: "Election Complete",
      description: "The election has passed",
      icon: CheckCircle,
    };
  }
  if (daysRemaining < 14) {
    return {
      color: "red",
      label: "Critical",
      description: "Final push - maximize ad delivery",
      icon: Flame,
    };
  }
  if (daysRemaining < 30) {
    return {
      color: "amber",
      label: "Urgent",
      description: "Intensify targeting and budget allocation",
      icon: AlertTriangle,
    };
  }
  return {
    color: "green",
    label: "On Track",
    description: "Continue building momentum",
    icon: Clock,
  };
}

const colorStyles = {
  green: {
    bg: "bg-[hsl(var(--portal-success)/0.1)]",
    border: "border-[hsl(var(--portal-success)/0.3)]",
    text: "text-[hsl(var(--portal-success))]",
    glow: "shadow-[0_0_20px_hsl(var(--portal-success)/0.2)]",
  },
  amber: {
    bg: "bg-[hsl(var(--portal-warning)/0.1)]",
    border: "border-[hsl(var(--portal-warning)/0.3)]",
    text: "text-[hsl(var(--portal-warning))]",
    glow: "shadow-[0_0_20px_hsl(var(--portal-warning)/0.2)]",
  },
  red: {
    bg: "bg-[hsl(var(--portal-error)/0.1)]",
    border: "border-[hsl(var(--portal-error)/0.3)]",
    text: "text-[hsl(var(--portal-error))]",
    glow: "shadow-[0_0_20px_hsl(var(--portal-error)/0.2)]",
  },
};

/**
 * Header badge variant for dashboard header
 */
function ElectionBadge({
  daysRemaining,
  electionName,
  electionDate,
  urgency,
  onClick,
}: {
  daysRemaining: number;
  electionName: string;
  electionDate: string;
  urgency: UrgencyConfig;
  onClick?: () => void;
}) {
  const styles = colorStyles[urgency.color];
  const Icon = urgency.icon;

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all",
        styles.bg,
        styles.border,
        onClick && "cursor-pointer hover:opacity-80"
      )}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <Icon className={cn("h-4 w-4", styles.text)} />
      <span className={cn("text-sm font-medium", styles.text)}>
        {daysRemaining < 0
          ? "Election Complete"
          : daysRemaining === 0
          ? "Election Day!"
          : `${daysRemaining}d to ${electionName}`}
      </span>
      <Calendar className={cn("h-3.5 w-3.5", styles.text, "opacity-60")} />
    </motion.button>
  );
}

/**
 * Election Date Editor Dialog
 */
function ElectionDateEditor({
  isOpen,
  onClose,
  currentDate,
  currentName,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  currentName: string;
  onSave: (date: string, name: string) => void;
}) {
  const [date, setDate] = useState(currentDate);
  const [name, setName] = useState(currentName);

  const handleSave = () => {
    if (date && isValid(parseISO(date))) {
      onSave(date, name);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(var(--portal-bg-card))] border-[hsl(var(--portal-border))]">
        <DialogHeader>
          <DialogTitle className="text-[hsl(var(--portal-text-primary))]">
            Set Election Date
          </DialogTitle>
          <DialogDescription className="text-[hsl(var(--portal-text-secondary))]">
            Configure your campaign's target election date for countdown tracking.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label
              htmlFor="election-name"
              className="text-[hsl(var(--portal-text-secondary))]"
            >
              Election Name
            </Label>
            <Input
              id="election-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., General Election, Primary"
              className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]"
            />
          </div>
          <div className="space-y-2">
            <Label
              htmlFor="election-date"
              className="text-[hsl(var(--portal-text-secondary))]"
            >
              Election Date
            </Label>
            <Input
              id="election-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-[hsl(var(--portal-bg-elevated))] border-[hsl(var(--portal-border))]"
            />
          </div>
        </div>
        <DialogFooter>
          <V3Button variant="secondary" onClick={onClose}>
            Cancel
          </V3Button>
          <V3Button onClick={handleSave} disabled={!date}>
            Save
          </V3Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ElectionCountdown({
  electionDate,
  electionName = "Election Day",
  onElectionDateChange,
  canEdit = false,
  variant = "card",
  className,
}: ElectionCountdownProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [localElectionName, setLocalElectionName] = useState(electionName);

  const { daysRemaining, urgency, formattedDate } = useMemo(() => {
    if (!electionDate) {
      return { daysRemaining: null, urgency: null, formattedDate: null };
    }

    const date = parseISO(electionDate);
    if (!isValid(date)) {
      return { daysRemaining: null, urgency: null, formattedDate: null };
    }

    const days = differenceInDays(date, new Date());
    return {
      daysRemaining: days,
      urgency: getUrgencyConfig(days),
      formattedDate: format(date, "MMMM d, yyyy"),
    };
  }, [electionDate]);

  const handleSave = (date: string, name: string) => {
    setLocalElectionName(name);
    onElectionDateChange?.(date);
  };

  // No election date set - show setup prompt
  if (!electionDate || daysRemaining === null || !urgency) {
    if (variant === "badge") {
      return canEdit ? (
        <>
          <V3Button
            variant="secondary"
            size="sm"
            onClick={() => setIsEditorOpen(true)}
            className={className}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Set Election Date
          </V3Button>
          <ElectionDateEditor
            isOpen={isEditorOpen}
            onClose={() => setIsEditorOpen(false)}
            currentDate=""
            currentName="Election Day"
            onSave={handleSave}
          />
        </>
      ) : null;
    }

    return (
      <>
        <V3Card className={className}>
          <V3CardContent className="p-6 text-center">
            <Calendar className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--portal-text-muted))]" />
            <h3 className="font-medium text-[hsl(var(--portal-text-primary))] mb-1">
              No Election Date Set
            </h3>
            <p className="text-sm text-[hsl(var(--portal-text-muted))] mb-4">
              Set your target election date to enable countdown tracking and urgency indicators.
            </p>
            {canEdit && (
              <V3Button onClick={() => setIsEditorOpen(true)}>
                <Calendar className="h-4 w-4 mr-2" />
                Set Election Date
              </V3Button>
            )}
          </V3CardContent>
        </V3Card>
        <ElectionDateEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          currentDate=""
          currentName="Election Day"
          onSave={handleSave}
        />
      </>
    );
  }

  const styles = colorStyles[urgency.color];
  const Icon = urgency.icon;

  // Badge variant for header
  if (variant === "badge") {
    return (
      <>
        <ElectionBadge
          daysRemaining={daysRemaining}
          electionName={localElectionName}
          electionDate={electionDate}
          urgency={urgency}
          onClick={canEdit ? () => setIsEditorOpen(true) : undefined}
        />
        {canEdit && (
          <ElectionDateEditor
            isOpen={isEditorOpen}
            onClose={() => setIsEditorOpen(false)}
            currentDate={electionDate}
            currentName={localElectionName}
            onSave={handleSave}
          />
        )}
      </>
    );
  }

  // Card variant
  return (
    <>
      <V3Card
        className={cn(
          "transition-all duration-300",
          urgency.color === "red" && styles.glow,
          className
        )}
        accent={urgency.color === "amber" ? "amber" : urgency.color === "red" ? "red" : "green"}
      >
        <V3CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-xl", styles.bg)}>
                <Icon className={cn("h-6 w-6", styles.text)} />
              </div>
              <div>
                <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">
                  {localElectionName}
                </h3>
                <p className="text-sm text-[hsl(var(--portal-text-muted))]">
                  {formattedDate}
                </p>
              </div>
            </div>
            {canEdit && (
              <V3Button
                variant="secondary"
                size="sm"
                onClick={() => setIsEditorOpen(true)}
              >
                Edit
              </V3Button>
            )}
          </div>

          {/* Countdown display */}
          <div className="text-center py-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={daysRemaining}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <div className={cn("text-6xl font-bold mb-2", styles.text)}>
                  {daysRemaining < 0
                    ? "Done"
                    : daysRemaining === 0
                    ? "Today!"
                    : daysRemaining}
                </div>
                {daysRemaining > 0 && (
                  <div className="text-lg text-[hsl(var(--portal-text-secondary))]">
                    {daysRemaining === 1 ? "day remaining" : "days remaining"}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Urgency indicator */}
          <div
            className={cn(
              "flex items-center justify-between p-3 rounded-lg",
              styles.bg
            )}
          >
            <div className="flex items-center gap-2">
              <V3Badge variant={urgency.color}>{urgency.label}</V3Badge>
            </div>
            <span className="text-sm text-[hsl(var(--portal-text-secondary))]">
              {urgency.description}
            </span>
          </div>

          {/* Progress bar */}
          {daysRemaining > 0 && daysRemaining <= 90 && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-[hsl(var(--portal-text-muted))] mb-1">
                <span>Campaign Progress</span>
                <span>{Math.max(0, Math.min(100, 100 - (daysRemaining / 90) * 100)).toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-[hsl(var(--portal-bg-elevated))]">
                <motion.div
                  className={cn(
                    "h-2 rounded-full",
                    urgency.color === "red"
                      ? "bg-[hsl(var(--portal-error))]"
                      : urgency.color === "amber"
                      ? "bg-[hsl(var(--portal-warning))]"
                      : "bg-[hsl(var(--portal-success))]"
                  )}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.max(0, Math.min(100, 100 - (daysRemaining / 90) * 100))}%`,
                  }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                />
              </div>
            </div>
          )}
        </V3CardContent>
      </V3Card>

      {canEdit && (
        <ElectionDateEditor
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          currentDate={electionDate}
          currentName={localElectionName}
          onSave={handleSave}
        />
      )}
    </>
  );
}

/**
 * Header-specific Election Day badge for dashboard header
 */
export function ElectionDayBadge({
  electionDate,
  electionName = "Election",
  onElectionDateChange,
  canEdit = false,
  className,
}: Omit<ElectionCountdownProps, "variant">) {
  return (
    <ElectionCountdown
      electionDate={electionDate}
      electionName={electionName}
      onElectionDateChange={onElectionDateChange}
      canEdit={canEdit}
      variant="badge"
      className={className}
    />
  );
}
