import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class PortalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Portal Error Boundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="portal-card p-8 sm:p-12 text-center max-w-2xl mx-auto my-8">
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full portal-bg-tertiary">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold portal-text-primary">Something went wrong</h2>
              <p className="text-sm portal-text-secondary max-w-md">
                An unexpected error occurred while loading this section. Please try refreshing or contact support if the problem persists.
              </p>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <details className="mt-4 text-left">
                  <summary className="cursor-pointer text-xs portal-text-muted hover:portal-text-secondary">
                    Error details (dev only)
                  </summary>
                  <pre className="mt-2 p-4 portal-bg-tertiary rounded text-xs overflow-auto max-h-48">
                    {this.state.error.toString()}
                    {this.state.error.stack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-3 mt-4">
              <Button
                onClick={this.handleReset}
                variant="default"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
              >
                Reload page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper for easier use with hooks
export function withPortalErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundary(props: P) {
    return (
      <PortalErrorBoundary fallback={fallback}>
        <Component {...props} />
      </PortalErrorBoundary>
    );
  };
}
