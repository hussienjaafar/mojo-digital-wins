import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { V3Badge } from "@/components/v3/V3Badge";
import { CheckCircle, XCircle, Clock, MapPin, AlertTriangle, Shield } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { LoginAttempt } from "./types";

interface UserLoginHistoryProps {
  loginHistory: LoginAttempt[];
  isLoading: boolean;
}

export function UserLoginHistory({ loginHistory, isLoading }: UserLoginHistoryProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (loginHistory.length === 0) {
    return (
      <div className="text-center py-8 text-[hsl(var(--portal-text-secondary))]">
        <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No login history found</p>
      </div>
    );
  }

  // Count failed attempts for warning
  const recentFailures = loginHistory.filter(
    l => !l.success && new Date(l.attempted_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
  ).length;

  return (
    <div className="space-y-4">
      {recentFailures >= 3 && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--portal-warning)/0.1)] border border-[hsl(var(--portal-warning)/0.3)]">
          <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
          <span className="text-sm text-[hsl(var(--portal-warning))]">
            {recentFailures} failed login attempts in the last 24 hours
          </span>
        </div>
      )}

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-2">
          {loginHistory.map((attempt) => (
            <div 
              key={attempt.attempt_id}
              className={`p-3 rounded-lg border ${
                attempt.success 
                  ? 'bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]' 
                  : 'bg-[hsl(var(--portal-error)/0.05)] border-[hsl(var(--portal-error)/0.2)]'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {attempt.success ? (
                    <CheckCircle className="h-4 w-4 text-[hsl(var(--portal-success))]" />
                  ) : (
                    <XCircle className="h-4 w-4 text-[hsl(var(--portal-error))]" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                        {attempt.success ? 'Successful Login' : 'Failed Login'}
                      </span>
                      {!attempt.success && attempt.failure_reason && (
                        <V3Badge variant="error" className="text-[10px]">
                          {attempt.failure_reason}
                        </V3Badge>
                      )}
                    </div>
                    <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                      {attempt.ip_address || 'Unknown IP'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 text-xs text-[hsl(var(--portal-text-secondary))]">
                    <Clock className="h-3 w-3" />
                    {formatDistanceToNow(new Date(attempt.attempted_at), { addSuffix: true })}
                  </div>
                  {attempt.city && (
                    <div className="flex items-center gap-1 text-xs text-[hsl(var(--portal-text-muted))] mt-1">
                      <MapPin className="h-3 w-3" />
                      {attempt.city}{attempt.country ? `, ${attempt.country}` : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
