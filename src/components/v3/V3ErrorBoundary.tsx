import * as React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface V3ErrorBoundaryProps {
  children: React.ReactNode;
  /** Fallback to render on error */
  fallback?: React.ReactNode;
  /** Section name for error message */
  sectionName?: string;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Additional className */
  className?: string;
}

interface V3ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component for graceful error handling in dashboard sections.
 * Prevents one section's error from crashing the entire dashboard.
 */
export class V3ErrorBoundary extends React.Component<
  V3ErrorBoundaryProps,
  V3ErrorBoundaryState
> {
  constructor(props: V3ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): V3ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[V3ErrorBoundary] Error in ${this.props.sectionName || "section"}:`, error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className={cn(
            "flex flex-col items-center justify-center py-12 px-6",
            "rounded-xl border",
            "border-[hsl(var(--portal-error)/0.2)]",
            "bg-[hsl(var(--portal-error)/0.05)]",
            this.props.className
          )}
          role="alert"
          aria-label={`Error loading ${this.props.sectionName || "this section"}`}
        >
          <div className="p-3 rounded-full bg-[hsl(var(--portal-error)/0.1)] mb-4">
            <AlertTriangle
              className="h-6 w-6 text-[hsl(var(--portal-error))]"
              aria-hidden="true"
            />
          </div>
          <h3 className="text-base font-semibold text-[hsl(var(--portal-text-primary))] mb-2">
            {this.props.sectionName
              ? `${this.props.sectionName} failed to load`
              : "Something went wrong"}
          </h3>
          <p className="text-sm text-[hsl(var(--portal-text-muted))] text-center mb-4 max-w-md">
            {this.state.error?.message || "An unexpected error occurred while loading this section."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleRetry}
            className="gap-2 border-[hsl(var(--portal-error)/0.3)] text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)]"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default V3ErrorBoundary;
