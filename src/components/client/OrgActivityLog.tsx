import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, History, UserPlus, UserMinus, Shield, LogIn } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ActivityLogEntry {
  id: string;
  action_type: string;
  actor_name: string | null;
  target_user_name: string | null;
  details: any;
  created_at: string;
}

interface OrgActivityLogProps {
  organizationId: string;
  limit?: number;
}

const ACTION_CONFIG: Record<string, { icon: React.ElementType; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  member_invited: { icon: UserPlus, label: "Invited", variant: "default" },
  member_joined: { icon: LogIn, label: "Joined", variant: "default" },
  member_removed: { icon: UserMinus, label: "Removed", variant: "destructive" },
  role_changed: { icon: Shield, label: "Role Changed", variant: "secondary" },
};

export function OrgActivityLog({ organizationId, limit = 50 }: OrgActivityLogProps) {
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [organizationId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("org_activity_log")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error("Error fetching activity log:", error);
    } finally {
      setLoading(false);
    }
  };

  const getActivityMessage = (activity: ActivityLogEntry): string => {
    const actor = activity.actor_name || "Someone";
    const target = activity.target_user_name || "a user";
    const details = activity.details || {};

    switch (activity.action_type) {
      case "member_invited":
        return `${actor} invited ${target} as ${details.role || "member"}`;
      case "member_joined":
        return `${target} joined the organization`;
      case "member_removed":
        return `${actor} removed ${target} from the organization`;
      case "role_changed":
        return `${actor} changed ${target}'s role to ${details.new_role || "unknown"}`;
      default:
        return `${actor} performed action: ${activity.action_type}`;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Activity Log
        </CardTitle>
        <CardDescription>
          Recent changes to team membership
        </CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No activity yet
          </p>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {activities.map((activity) => {
                const config = ACTION_CONFIG[activity.action_type] || {
                  icon: History,
                  label: activity.action_type,
                  variant: "outline" as const,
                };
                const Icon = config.icon;

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 pb-4 border-b last:border-0"
                  >
                    <div className="mt-0.5 p-2 rounded-full bg-muted">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={config.variant} className="text-xs">
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm">{getActivityMessage(activity)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
