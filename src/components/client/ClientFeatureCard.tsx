import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClientFeatureCardProps {
  title: string;
  description?: string;
  icon: LucideIcon;
  stat?: number | string;
  statLabel?: string;
  badge?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

export function ClientFeatureCard({
  title,
  description,
  icon: Icon,
  stat,
  statLabel,
  badge,
  onClick,
  className,
  children,
}: ClientFeatureCardProps) {
  return (
    <Card
      className={cn(
        "hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-1",
        onClick && "hover:border-primary/50",
        className
      )}
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              {badge && (
                <Badge variant={badge.variant || "default"}>
                  {badge.label}
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      {(stat !== undefined || children) && (
        <CardContent>
          {stat !== undefined && (
            <div>
              <div className="text-3xl font-bold text-foreground">{stat}</div>
              {statLabel && (
                <p className="text-sm text-muted-foreground mt-1">{statLabel}</p>
              )}
            </div>
          )}
          {children}
        </CardContent>
      )}
    </Card>
  );
}
