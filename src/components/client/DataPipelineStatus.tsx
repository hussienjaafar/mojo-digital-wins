import { CheckCircle, AlertCircle, Clock, Database, RefreshCw } from "lucide-react";
import { V3Card, V3CardHeader, V3CardTitle, V3CardContent } from "@/components/v3";
import { cn } from "@/lib/utils";

interface PipelineItem {
  name: string;
  table: string;
  count: number;
  description: string;
}

interface DataPipelineStatusProps {
  pipelines: PipelineItem[];
  isLoading?: boolean;
}

const getStatus = (count: number): 'healthy' | 'empty' | 'pending' => {
  if (count > 0) return 'healthy';
  return 'empty';
};

const statusConfig = {
  healthy: {
    icon: CheckCircle,
    color: 'text-[hsl(var(--portal-success))]',
    bg: 'bg-[hsl(var(--portal-success)/0.1)]',
    label: 'Active',
  },
  empty: {
    icon: AlertCircle,
    color: 'text-[hsl(var(--portal-warning))]',
    bg: 'bg-[hsl(var(--portal-warning)/0.1)]',
    label: 'Needs Setup',
  },
  pending: {
    icon: Clock,
    color: 'text-[hsl(var(--portal-text-muted))]',
    bg: 'bg-[hsl(var(--portal-bg-elevated))]',
    label: 'Pending',
  },
};

export const DataPipelineStatus = ({ pipelines, isLoading }: DataPipelineStatusProps) => {
  const healthyCount = pipelines.filter(p => p.count > 0).length;
  const totalCount = pipelines.length;

  if (isLoading) {
    return (
      <V3Card>
        <V3CardHeader>
          <V3CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Data Pipeline Status
          </V3CardTitle>
        </V3CardHeader>
        <V3CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="p-4 rounded-lg bg-[hsl(var(--portal-bg-elevated))] animate-pulse">
                <div className="h-4 w-16 bg-[hsl(var(--portal-bg-surface))] rounded mb-2" />
                <div className="h-6 w-12 bg-[hsl(var(--portal-bg-surface))] rounded" />
              </div>
            ))}
          </div>
        </V3CardContent>
      </V3Card>
    );
  }

  return (
    <V3Card>
      <V3CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <V3CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Data Pipeline Status
            </V3CardTitle>
            <p className="text-sm text-[hsl(var(--portal-text-muted))] mt-1">
              {healthyCount} of {totalCount} data sources are populated
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "px-2 py-1 rounded-full text-xs font-medium",
              healthyCount === totalCount 
                ? "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]"
                : "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]"
            )}>
              {Math.round((healthyCount / totalCount) * 100)}% Complete
            </span>
          </div>
        </div>
      </V3CardHeader>
      <V3CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {pipelines.map((pipeline) => {
            const status = getStatus(pipeline.count);
            const config = statusConfig[status];
            const Icon = config.icon;

            return (
              <div
                key={pipeline.table}
                className={cn(
                  "p-4 rounded-lg border transition-colors",
                  "border-[hsl(var(--portal-border))]",
                  config.bg
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn("h-4 w-4", config.color)} />
                  <span className={cn("text-xs font-medium", config.color)}>
                    {config.label}
                  </span>
                </div>
                <div className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-1">
                  {pipeline.name}
                </div>
                <div className="text-lg font-bold text-[hsl(var(--portal-text-primary))]">
                  {pipeline.count.toLocaleString()}
                </div>
                <div className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
                  {pipeline.description}
                </div>
              </div>
            );
          })}
        </div>
      </V3CardContent>
    </V3Card>
  );
};

export default DataPipelineStatus;
