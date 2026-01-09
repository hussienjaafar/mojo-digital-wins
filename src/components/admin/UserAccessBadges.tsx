import { Badge } from "@/components/ui/badge";
import { Shield, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Organization {
  org_id: string;
  org_name: string;
  role: string;
}

interface UserAccessBadgesProps {
  platformRoles: string[];
  organizations: Organization[];
  compact?: boolean;
  maxOrgsToShow?: number;
}

export function UserAccessBadges({ 
  platformRoles, 
  organizations,
  compact = false,
  maxOrgsToShow = 3
}: UserAccessBadgesProps) {
  const isPlatformAdmin = platformRoles.includes('admin');
  const validOrgs = organizations.filter(org => org.org_id && org.org_name);
  const displayedOrgs = validOrgs.slice(0, maxOrgsToShow);
  const hiddenOrgsCount = validOrgs.length - maxOrgsToShow;

  if (!isPlatformAdmin && validOrgs.length === 0) {
    return (
      <span className="text-xs text-muted-foreground italic">No special access</span>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-1", compact && "gap-0.5")}>
      {isPlatformAdmin && (
        <Badge 
          className={cn(
            "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800",
            compact && "text-[10px] px-1.5 py-0"
          )}
        >
          <Shield className={cn("mr-1", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
          Platform Admin
        </Badge>
      )}
      {displayedOrgs.map(org => (
        <Badge 
          key={org.org_id} 
          variant="outline" 
          className={cn(
            "text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20",
            compact && "text-[10px] px-1.5 py-0"
          )}
        >
          <Building2 className={cn("mr-1", compact ? "h-2.5 w-2.5" : "h-3 w-3")} />
          {org.org_name}
          <span className="ml-1 opacity-60">({org.role})</span>
        </Badge>
      ))}
      {hiddenOrgsCount > 0 && (
        <Badge 
          variant="secondary" 
          className={cn(
            "text-muted-foreground",
            compact && "text-[10px] px-1.5 py-0"
          )}
        >
          +{hiddenOrgsCount} more
        </Badge>
      )}
    </div>
  );
}

// Simpler badge for showing just counts/summary
export function UserAccessSummary({ 
  isPlatformAdmin, 
  organizationCount 
}: { 
  isPlatformAdmin: boolean; 
  organizationCount: number;
}) {
  const parts: string[] = [];
  
  if (isPlatformAdmin) {
    parts.push("Platform Admin");
  }
  
  if (organizationCount > 0) {
    parts.push(`${organizationCount} org${organizationCount > 1 ? 's' : ''}`);
  }
  
  if (parts.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }
  
  return (
    <div className="flex items-center gap-2">
      {isPlatformAdmin && (
        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 text-[10px] px-1.5 py-0">
          <Shield className="h-2.5 w-2.5 mr-0.5" />
          Admin
        </Badge>
      )}
      {organizationCount > 0 && (
        <Badge variant="outline" className="text-blue-700 dark:text-blue-300 text-[10px] px-1.5 py-0">
          <Building2 className="h-2.5 w-2.5 mr-0.5" />
          {organizationCount} org{organizationCount > 1 ? 's' : ''}
        </Badge>
      )}
    </div>
  );
}
