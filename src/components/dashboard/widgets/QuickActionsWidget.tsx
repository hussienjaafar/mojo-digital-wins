import { DashboardWidget } from "../DashboardWidget";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary";
}

interface QuickActionsWidgetProps {
  actions: QuickAction[];
}

export function QuickActionsWidget({ actions }: QuickActionsWidgetProps) {
  return (
    <DashboardWidget title="Quick Actions" icon={<Zap className="h-5 w-5 text-primary" />}>
      <div className="grid grid-cols-1 gap-3">
        {actions.map((action, index) => (
          <Button
            key={index}
            variant={action.variant || "outline"}
            onClick={action.onClick}
            className="w-full justify-start gap-3 h-auto py-3"
          >
            {action.icon}
            <span>{action.label}</span>
          </Button>
        ))}
      </div>
    </DashboardWidget>
  );
}
