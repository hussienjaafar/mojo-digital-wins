import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Server } from "lucide-react";

interface EnvironmentBannerProps {
  environment?: "production" | "staging" | "development";
  projectRef?: string;
}

export function EnvironmentBanner({ 
  environment = "development",
  projectRef 
}: EnvironmentBannerProps) {
  // Don't show banner in production
  if (environment === "production") return null;

  const config = {
    staging: {
      label: "Staging Environment",
      description: "Changes here do not affect production",
      className: "bg-yellow-500/10 border-yellow-500/30 text-yellow-700 dark:text-yellow-400",
      icon: AlertTriangle,
    },
    development: {
      label: "Development",
      description: "Local development environment",
      className: "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400",
      icon: Server,
    },
  };

  const { label, description, className, icon: Icon } = config[environment];

  return (
    <div className={`px-4 py-2 border-b flex items-center justify-center gap-3 text-sm ${className}`}>
      <Icon className="h-4 w-4" />
      <span className="font-medium">{label}</span>
      <span className="hidden sm:inline text-xs opacity-75">— {description}</span>
      {projectRef && (
        <Badge variant="outline" className="ml-2 font-mono text-xs">
          {projectRef}
        </Badge>
      )}
    </div>
  );
}
