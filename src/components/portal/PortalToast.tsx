import { toast as sonnerToast } from "sonner";
import { CheckCircle, AlertCircle, Info, AlertTriangle } from "lucide-react";

// Portal-styled toast notifications
export const portalToast = {
  success: (message: string, description?: string) => {
    sonnerToast.success(message, {
      description,
      icon: <CheckCircle className="h-5 w-5" />,
      className: "portal-theme portal-card border-l-4 border-l-[hsl(var(--portal-success))]",
      style: {
        background: "hsl(var(--portal-bg-secondary))",
        color: "hsl(var(--portal-text-primary))",
        border: "1px solid hsl(var(--portal-border))",
      },
    });
  },

  error: (message: string, description?: string) => {
    sonnerToast.error(message, {
      description,
      icon: <AlertCircle className="h-5 w-5" />,
      className: "portal-theme portal-card border-l-4 border-l-[hsl(var(--portal-error))]",
      style: {
        background: "hsl(var(--portal-bg-secondary))",
        color: "hsl(var(--portal-text-primary))",
        border: "1px solid hsl(var(--portal-border))",
      },
    });
  },

  info: (message: string, description?: string) => {
    sonnerToast.info(message, {
      description,
      icon: <Info className="h-5 w-5" />,
      className: "portal-theme portal-card border-l-4 border-l-[hsl(var(--portal-info))]",
      style: {
        background: "hsl(var(--portal-bg-secondary))",
        color: "hsl(var(--portal-text-primary))",
        border: "1px solid hsl(var(--portal-border))",
      },
    });
  },

  warning: (message: string, description?: string) => {
    sonnerToast.warning(message, {
      description,
      icon: <AlertTriangle className="h-5 w-5" />,
      className: "portal-theme portal-card border-l-4 border-l-[hsl(var(--portal-warning))]",
      style: {
        background: "hsl(var(--portal-bg-secondary))",
        color: "hsl(var(--portal-text-primary))",
        border: "1px solid hsl(var(--portal-border))",
      },
    });
  },

  loading: (message: string) => {
    return sonnerToast.loading(message, {
      className: "portal-theme portal-card",
      style: {
        background: "hsl(var(--portal-bg-secondary))",
        color: "hsl(var(--portal-text-primary))",
        border: "1px solid hsl(var(--portal-border))",
      },
    });
  },

  promise: <T,>(
    promise: Promise<T>,
    { loading, success, error }: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return sonnerToast.promise(promise, {
      loading,
      success,
      error,
      className: "portal-theme portal-card",
      style: {
        background: "hsl(var(--portal-bg-secondary))",
        color: "hsl(var(--portal-text-primary))",
        border: "1px solid hsl(var(--portal-border))",
      },
    });
  },
};
