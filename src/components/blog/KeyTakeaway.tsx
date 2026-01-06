import { Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface KeyTakeawayProps {
  children: React.ReactNode;
  className?: string;
}

export function KeyTakeaway({ children, className }: KeyTakeawayProps) {
  return (
    <div
      className={cn(
        "my-8 p-6 rounded-xl border-l-4 border-secondary bg-secondary/5",
        "relative overflow-hidden",
        className
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-lg bg-secondary/20">
            <Lightbulb className="w-4 h-4 text-secondary" />
          </div>
          <span className="text-sm font-bold text-secondary uppercase tracking-wide">
            Key Takeaway
          </span>
        </div>
        <div className="text-foreground font-medium leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}
