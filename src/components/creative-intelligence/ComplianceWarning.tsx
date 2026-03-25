import { AlertTriangle, Shield, FileWarning, UserX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type ComplianceWarningType = "missing_disclaimer" | "attack_ad" | "needs_substantiation";

export interface ComplianceIssue {
  type: ComplianceWarningType;
  message: string;
  severity: "warning" | "error";
}

interface ComplianceWarningProps {
  issues: ComplianceIssue[];
  variant?: "badge" | "inline" | "detailed";
  className?: string;
}

interface ComplianceWarningBadgeProps {
  issues: ComplianceIssue[];
  className?: string;
}

// Patterns to detect potential compliance issues
const DISCLAIMER_PATTERNS = [
  /paid\s+for\s+by/i,
  /authorized\s+by/i,
  /approved\s+by/i,
  /sponsored\s+by/i,
];

const ATTACK_PATTERNS = [
  /\b(opponent|rival|competition)\b.*\b(lied|lies|corrupt|criminal|fraud|dishonest|crooked)\b/i,
  /\b(he|she|they)\s+(lied|lies|is lying|are lying)\b/i,
  /\bvote\s+against\b/i,
  /\bdefeat\b.*\b(name|candidate)\b/i,
];

const SUBSTANTIATION_PATTERNS = [
  /\b(studies\s+show|research\s+proves|experts\s+agree|statistics\s+show)\b/i,
  /\b(100%|guaranteed|proven|scientifically)\b/i,
  /\b(will\s+save|will\s+create|will\s+eliminate)\s+\d+/i,
  /\b(always|never|every\s+time)\b/i,
];

/**
 * Analyze creative text for potential compliance issues
 */
export function analyzeComplianceIssues(
  primaryText: string | null | undefined,
  headline: string | null | undefined,
  targetAttacked: string | null | undefined
): ComplianceIssue[] {
  const issues: ComplianceIssue[] = [];
  const combinedText = `${primaryText || ""} ${headline || ""}`;

  // Check for missing "Paid for by" disclaimer
  const hasDisclaimer = DISCLAIMER_PATTERNS.some((pattern) =>
    pattern.test(combinedText)
  );
  if (!hasDisclaimer && combinedText.trim().length > 0) {
    issues.push({
      type: "missing_disclaimer",
      message: "Missing 'Paid for by' disclaimer - required by FEC for political ads",
      severity: "error",
    });
  }

  // Check for attack ad targeting specific individuals
  const isAttackAd =
    targetAttacked ||
    ATTACK_PATTERNS.some((pattern) => pattern.test(combinedText));
  if (isAttackAd) {
    issues.push({
      type: "attack_ad",
      message: targetAttacked
        ? `Attack ad targeting ${targetAttacked} - ensure all claims are verifiable`
        : "Potential attack ad detected - review for accuracy and tone",
      severity: "warning",
    });
  }

  // Check for claims that might need substantiation
  const needsSubstantiation = SUBSTANTIATION_PATTERNS.some((pattern) =>
    pattern.test(combinedText)
  );
  if (needsSubstantiation) {
    issues.push({
      type: "needs_substantiation",
      message:
        "Contains claims that may require substantiation - verify sources before running",
      severity: "warning",
    });
  }

  return issues;
}

const warningConfig: Record<
  ComplianceWarningType,
  { icon: typeof AlertTriangle; label: string }
> = {
  missing_disclaimer: {
    icon: Shield,
    label: "Disclaimer",
  },
  attack_ad: {
    icon: UserX,
    label: "Attack Ad",
  },
  needs_substantiation: {
    icon: FileWarning,
    label: "Verify Claims",
  },
};

/**
 * Compact badge for displaying on creative cards in gallery
 */
export function ComplianceWarningBadge({
  issues,
  className,
}: ComplianceWarningBadgeProps) {
  if (issues.length === 0) return null;

  const hasError = issues.some((i) => i.severity === "error");
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium cursor-help",
              hasError
                ? "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))] border border-[hsl(var(--portal-error)/0.3)]"
                : "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))] border border-[hsl(var(--portal-warning)/0.3)]",
              className
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>
              {issues.length} {issues.length === 1 ? "Issue" : "Issues"}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          className="max-w-xs bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))]"
        >
          <div className="space-y-2">
            <div className="font-medium text-[hsl(var(--portal-text-primary))]">
              Compliance Review Needed
            </div>
            <ul className="space-y-1.5">
              {issues.map((issue, idx) => {
                const config = warningConfig[issue.type];
                const Icon = config.icon;
                return (
                  <li
                    key={idx}
                    className={cn(
                      "flex items-start gap-2 text-xs",
                      issue.severity === "error"
                        ? "text-[hsl(var(--portal-error))]"
                        : "text-[hsl(var(--portal-warning))]"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{issue.message}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Full compliance warning component for detailed views
 */
export function ComplianceWarning({
  issues,
  variant = "inline",
  className,
}: ComplianceWarningProps) {
  if (issues.length === 0) return null;

  if (variant === "badge") {
    return <ComplianceWarningBadge issues={issues} className={className} />;
  }

  const hasError = issues.some((i) => i.severity === "error");

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm",
          hasError
            ? "bg-[hsl(var(--portal-error)/0.1)] text-[hsl(var(--portal-error))]"
            : "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]",
          className
        )}
      >
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          {issues.length} compliance {issues.length === 1 ? "issue" : "issues"}{" "}
          detected
        </span>
      </div>
    );
  }

  // Detailed variant
  return (
    <div
      className={cn(
        "rounded-lg border p-4",
        hasError
          ? "bg-[hsl(var(--portal-error)/0.05)] border-[hsl(var(--portal-error)/0.3)]"
          : "bg-[hsl(var(--portal-warning)/0.05)] border-[hsl(var(--portal-warning)/0.3)]",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle
          className={cn(
            "h-5 w-5",
            hasError
              ? "text-[hsl(var(--portal-error))]"
              : "text-[hsl(var(--portal-warning))]"
          )}
        />
        <h4
          className={cn(
            "font-semibold",
            hasError
              ? "text-[hsl(var(--portal-error))]"
              : "text-[hsl(var(--portal-warning))]"
          )}
        >
          Compliance Review Required
        </h4>
      </div>
      <ul className="space-y-2">
        {issues.map((issue, idx) => {
          const config = warningConfig[issue.type];
          const Icon = config.icon;
          return (
            <li key={idx} className="flex items-start gap-3">
              <div
                className={cn(
                  "p-1.5 rounded",
                  issue.severity === "error"
                    ? "bg-[hsl(var(--portal-error)/0.1)]"
                    : "bg-[hsl(var(--portal-warning)/0.1)]"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4",
                    issue.severity === "error"
                      ? "text-[hsl(var(--portal-error))]"
                      : "text-[hsl(var(--portal-warning))]"
                  )}
                />
              </div>
              <div>
                <div
                  className={cn(
                    "text-sm font-medium",
                    issue.severity === "error"
                      ? "text-[hsl(var(--portal-error))]"
                      : "text-[hsl(var(--portal-warning))]"
                  )}
                >
                  {config.label}
                </div>
                <div className="text-sm text-[hsl(var(--portal-text-secondary))]">
                  {issue.message}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
