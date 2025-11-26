import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type SeverityLevel = "critical" | "high" | "medium" | "low";

interface ClientAlertCardProps {
  title: string;
  description?: string;
  severity: SeverityLevel;
  isNew?: boolean;
  isActionable?: boolean;
  actionableScore?: number;
  metadata?: {
    label: string;
    value: string | number;
  }[];
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

const severityConfig = {
  critical: {
    icon: AlertTriangle,
    badgeClass: "bg-severity-critical/10 text-severity-critical border-severity-critical/20",
    borderClass: "border-severity-critical/50",
  },
  high: {
    icon: AlertTriangle,
    badgeClass: "bg-severity-high/10 text-severity-high border-severity-high/20",
    borderClass: "border-severity-high/50",
  },
  medium: {
    icon: AlertCircle,
    badgeClass: "bg-severity-medium/10 text-severity-medium border-severity-medium/20",
    borderClass: "border-severity-medium/50",
  },
  low: {
    icon: Info,
    badgeClass: "bg-severity-low/10 text-severity-low border-severity-low/20",
    borderClass: "border-severity-low/50",
  },
};

export function ClientAlertCard({
  title,
  description,
  severity,
  isNew,
  isActionable,
  actionableScore,
  metadata,
  onClick,
  className,
  children,
}: ClientAlertCardProps) {
  const config = severityConfig[severity];
  const Icon = config.icon;

  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all duration-300",
        isNew && config.borderClass,
        onClick && "hover:-translate-y-1",
        className
      )}
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              {isNew && (
                <Badge className="bg-primary">New</Badge>
              )}
              {isActionable && (
                <Badge className="bg-success/10 text-success border-success/20">Actionable</Badge>
              )}
              <Badge variant="outline" className={config.badgeClass}>
                <Icon className="h-3 w-3 mr-1" />
                {severity}
              </Badge>
            </div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>
          {actionableScore !== undefined && actionableScore > 0 && (
            <div className="text-right ml-4">
              <p className="text-sm text-muted-foreground">Score</p>
              <p className="text-2xl font-bold text-primary">{actionableScore}</p>
            </div>
          )}
        </div>
      </CardHeader>
      {(metadata || children) && (
        <CardContent>
          {metadata && (
            <div className="space-y-2">
              {metadata.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{item.label}:</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          )}
          {children}
        </CardContent>
      )}
    </Card>
  );
}
