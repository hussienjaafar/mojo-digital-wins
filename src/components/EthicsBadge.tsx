import { Shield, Heart, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EthicsBadgeProps {
  variant?: "default" | "compact" | "detailed";
  className?: string;
}

export const EthicsBadge = ({ variant = "default", className }: EthicsBadgeProps) => {
  if (variant === "compact") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 bg-accent/10 text-accent-foreground px-4 py-2 rounded-full border border-accent/20",
          className
        )}
      >
        <Shield className="w-4 h-4" />
        <span className="font-semibold text-sm">Ethical Fundraising</span>
      </div>
    );
  }

  if (variant === "detailed") {
    return (
      <div className={cn("bg-card border border-border rounded-lg p-6", className)}>
        <div className="flex items-start gap-4">
          <div className="bg-accent/10 text-accent p-3 rounded-lg">
            <Heart className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground mb-2 flex items-center gap-2">
              Our Ethical Promise
              <CheckCircle2 className="w-5 h-5 text-accent" />
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              Performance with principles. We never compromise values for ROI. Donor trust is sacred—we build
              relationships that last beyond Election Day.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 bg-accent/10 text-accent-foreground px-6 py-3 rounded-lg border border-accent/20",
        className
      )}
    >
      <Shield className="w-5 h-5" />
      <div>
        <div className="font-bold">Ethical Fundraising</div>
        <div className="text-xs opacity-80">Performance with principles</div>
      </div>
    </div>
  );
};
