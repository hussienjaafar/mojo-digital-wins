import { useDeltaSinceLogin } from "@/hooks/useDeltaSinceLogin";
import { V3Card, V3CardContent } from "@/components/v3";
import { Newspaper, Bell, TrendingUp, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

export function DeltaSinceLoginCard() {
  const { delta, isLoading } = useDeltaSinceLogin();

  if (isLoading) {
    return (
      <V3Card>
        <V3CardContent className="p-4">
          <Skeleton className="h-20 w-full" />
        </V3CardContent>
      </V3Card>
    );
  }

  if (!delta) {
    return null;
  }

  const hasNewContent = delta.newArticles > 0 || delta.newAlerts > 0 || delta.newTrends > 0;

  return (
    <V3Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <V3CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Since your last login {delta.lastLoginAt && formatDistanceToNow(new Date(delta.lastLoginAt), { addSuffix: true })}
          </span>
        </div>
        
        {hasNewContent ? (
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-foreground">
                <Newspaper className="h-5 w-5 text-blue-500" />
                {delta.newArticles.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">New Articles</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-foreground">
                <Bell className="h-5 w-5 text-amber-500" />
                {delta.newAlerts.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">New Alerts</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-bold text-foreground">
                <TrendingUp className="h-5 w-5 text-emerald-500" />
                {delta.newTrends.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">New Trends</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center">
            No new content since your last visit
          </p>
        )}
      </V3CardContent>
    </V3Card>
  );
}
