import { AlertCircle, Database, RefreshCw, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NoDataAvailableProps {
  /** Title to display */
  title?: string;
  /** Descriptive message explaining why there's no data */
  message?: string;
  /** Type of empty state - affects icon and styling */
  type?: 'empty' | 'error' | 'pending' | 'sync-required';
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
  };
  /** Additional context or tips */
  tips?: string[];
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
}

const typeConfig = {
  empty: {
    icon: Database,
    iconColor: "text-[hsl(var(--portal-text-muted))]",
    bgColor: "bg-[hsl(var(--portal-bg-secondary))]",
    borderColor: "border-[hsl(var(--portal-border))]",
    defaultTitle: "No Data Available",
    defaultMessage: "There's no data to display for the selected period.",
  },
  error: {
    icon: AlertCircle,
    iconColor: "text-[hsl(var(--portal-error))]",
    bgColor: "bg-[hsl(var(--portal-error)/0.05)]",
    borderColor: "border-[hsl(var(--portal-error)/0.2)]",
    defaultTitle: "Unable to Load Data",
    defaultMessage: "There was a problem loading this data. Please try again.",
  },
  pending: {
    icon: Clock,
    iconColor: "text-[hsl(var(--portal-warning))]",
    bgColor: "bg-[hsl(var(--portal-warning)/0.05)]",
    borderColor: "border-[hsl(var(--portal-warning)/0.2)]",
    defaultTitle: "Data Processing",
    defaultMessage: "This data is still being processed. Check back soon.",
  },
  'sync-required': {
    icon: RefreshCw,
    iconColor: "text-[hsl(var(--portal-accent-blue))]",
    bgColor: "bg-[hsl(var(--portal-accent-blue)/0.05)]",
    borderColor: "border-[hsl(var(--portal-accent-blue)/0.2)]",
    defaultTitle: "Sync Required",
    defaultMessage: "This data source needs to be synced to display results.",
  },
};

const sizeConfig = {
  sm: {
    container: "p-4",
    icon: "h-6 w-6",
    title: "text-sm font-medium",
    message: "text-xs",
    tips: "text-xs",
  },
  md: {
    container: "p-6",
    icon: "h-8 w-8",
    title: "text-base font-medium",
    message: "text-sm",
    tips: "text-sm",
  },
  lg: {
    container: "p-8",
    icon: "h-12 w-12",
    title: "text-lg font-semibold",
    message: "text-base",
    tips: "text-sm",
  },
};

export function NoDataAvailable({
  title,
  message,
  type = 'empty',
  action,
  tips,
  size = 'md',
  className,
}: NoDataAvailableProps) {
  const config = typeConfig[type];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center rounded-lg border",
        config.bgColor,
        config.borderColor,
        sizes.container,
        className
      )}
    >
      <div className={cn("mb-3", config.iconColor)}>
        <Icon className={sizes.icon} />
      </div>
      
      <h3 className={cn("text-[hsl(var(--portal-text-primary))]", sizes.title)}>
        {title || config.defaultTitle}
      </h3>
      
      <p className={cn("mt-1 text-[hsl(var(--portal-text-muted))] max-w-md", sizes.message)}>
        {message || config.defaultMessage}
      </p>

      {tips && tips.length > 0 && (
        <ul className={cn("mt-3 space-y-1 text-[hsl(var(--portal-text-muted))]", sizes.tips)}>
          {tips.map((tip, index) => (
            <li key={index} className="flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-[hsl(var(--portal-warning))]" />
              {tip}
            </li>
          ))}
        </ul>
      )}

      {action && (
        <Button
          onClick={action.onClick}
          disabled={action.loading}
          variant="outline"
          size={size === 'sm' ? 'sm' : 'default'}
          className="mt-4"
        >
          {action.loading ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : null}
          {action.label}
        </Button>
      )}
    </div>
  );
}

/**
 * Wrapper component for conditionally showing data or empty state
 */
interface DataOrEmptyProps<T> {
  data: T[] | null | undefined;
  isLoading?: boolean;
  error?: Error | null;
  emptyProps?: Omit<NoDataAvailableProps, 'type'>;
  errorProps?: Omit<NoDataAvailableProps, 'type'>;
  loadingComponent?: React.ReactNode;
  children: (data: T[]) => React.ReactNode;
}

export function DataOrEmpty<T>({
  data,
  isLoading,
  error,
  emptyProps,
  errorProps,
  loadingComponent,
  children,
}: DataOrEmptyProps<T>) {
  if (isLoading && loadingComponent) {
    return <>{loadingComponent}</>;
  }

  if (error) {
    return (
      <NoDataAvailable
        type="error"
        message={error.message}
        {...errorProps}
      />
    );
  }

  if (!data || data.length === 0) {
    return <NoDataAvailable type="empty" {...emptyProps} />;
  }

  return <>{children(data)}</>;
}
