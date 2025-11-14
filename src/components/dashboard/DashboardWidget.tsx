import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GripVertical, X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingCard } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";

interface DashboardWidgetProps {
  title: string;
  children: ReactNode;
  onRemove?: () => void;
  onExpand?: () => void;
  isExpanded?: boolean;
  icon?: ReactNode;
  actions?: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
}

export function DashboardWidget({ 
  title, 
  children, 
  onRemove, 
  onExpand, 
  isExpanded = false,
  icon,
  actions,
  isLoading = false,
  isEmpty = false,
  emptyMessage = "No data available"
}: DashboardWidgetProps) {
  return (
    <Card className="h-full flex flex-col border-border/50 shadow-lg bg-card/50 backdrop-blur overflow-hidden group transition-all hover:shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4 cursor-move">
        <div className="flex items-center gap-3 flex-1">
          <GripVertical className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
          {icon && <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>}
          <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {onExpand && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onExpand}
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {isExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </Button>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {isLoading ? (
          <LoadingCard />
        ) : isEmpty ? (
          <EmptyState 
            title={emptyMessage}
            variant="minimal"
          />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
