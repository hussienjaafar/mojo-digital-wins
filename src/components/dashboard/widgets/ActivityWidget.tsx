import { DashboardWidget } from "../DashboardWidget";
import { Activity } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ActivityItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  icon?: React.ReactNode;
}

interface ActivityWidgetProps {
  activities: ActivityItem[];
}

export function ActivityWidget({ activities }: ActivityWidgetProps) {
  return (
    <DashboardWidget title="Recent Activity" icon={<Activity className="h-5 w-5 text-primary" />}>
      <ScrollArea className="h-full">
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex gap-3 items-start">
              {activity.icon && (
                <div className="p-2 bg-primary/10 rounded-lg mt-1">
                  {activity.icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground text-sm">{activity.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{activity.description}</p>
                <p className="text-xs text-muted-foreground mt-1">{activity.timestamp}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </DashboardWidget>
  );
}
