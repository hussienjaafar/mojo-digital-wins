import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { V3Badge } from "@/components/v3/V3Badge";
import { 
  Activity, Eye, Download, Settings, Search, 
  FileText, BarChart2, Clock, Globe
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { ActivityLog } from "./types";

interface UserActivityLogProps {
  activityLogs: ActivityLog[];
  isLoading: boolean;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'viewed_report': <BarChart2 className="h-4 w-4" />,
  'exported_data': <Download className="h-4 w-4" />,
  'changed_settings': <Settings className="h-4 w-4" />,
  'searched': <Search className="h-4 w-4" />,
  'viewed_page': <Eye className="h-4 w-4" />,
  'viewed_document': <FileText className="h-4 w-4" />,
};

const ACTION_LABELS: Record<string, string> = {
  'viewed_report': 'Viewed Report',
  'exported_data': 'Exported Data',
  'changed_settings': 'Changed Settings',
  'searched': 'Searched',
  'viewed_page': 'Viewed Page',
  'viewed_document': 'Viewed Document',
  'login': 'Logged In',
  'logout': 'Logged Out',
};

export function UserActivityLog({ activityLogs, isLoading }: UserActivityLogProps) {
  const [filterType, setFilterType] = useState<string>('all');

  const actionTypes = [...new Set(activityLogs.map(l => l.action_type))];
  
  const filteredLogs = filterType === 'all' 
    ? activityLogs 
    : activityLogs.filter(l => l.action_type === filterType);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (activityLogs.length === 0) {
    return (
      <div className="text-center py-8 text-[hsl(var(--portal-text-secondary))]">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No activity recorded yet</p>
        <p className="text-xs mt-1 text-[hsl(var(--portal-text-muted))]">
          Activity tracking will begin once the user performs actions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
          Activity Log ({filteredLogs.length})
        </h4>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activities</SelectItem>
            {actionTypes.map(type => (
              <SelectItem key={type} value={type}>
                {ACTION_LABELS[type] || type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div 
              key={log.activity_id}
              className="p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-md bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-secondary))]">
                  {ACTION_ICONS[log.action_type] || <Activity className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                      {ACTION_LABELS[log.action_type] || log.action_type}
                    </span>
                    {log.resource_type && (
                      <V3Badge variant="muted" className="text-[10px]">
                        {log.resource_type}
                      </V3Badge>
                    )}
                  </div>
                  {log.resource_id && (
                    <p className="text-xs text-[hsl(var(--portal-text-muted))] truncate">
                      {log.resource_id}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-1 text-xs text-[hsl(var(--portal-text-muted))]">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </div>
                    {log.ip_address && (
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {log.ip_address}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
