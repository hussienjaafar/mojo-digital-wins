import { V3Button } from "@/components/v3/V3Button";
import { V3Badge } from "@/components/v3/V3Badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Monitor, Smartphone, Tablet, Globe, Clock, 
  MapPin, XCircle, AlertTriangle 
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import type { DetailedSession } from "./types";

interface UserSessionsListProps {
  sessions: DetailedSession[];
  isLoading: boolean;
  onTerminateSession: (sessionId: string) => void;
  onTerminateAll: () => void;
}

const getDeviceIcon = (deviceInfo: DetailedSession['device_info']) => {
  const deviceType = deviceInfo?.device_type?.toLowerCase();
  if (deviceType === 'mobile' || deviceType === 'phone') return <Smartphone className="h-4 w-4" />;
  if (deviceType === 'tablet') return <Tablet className="h-4 w-4" />;
  return <Monitor className="h-4 w-4" />;
};

export function UserSessionsList({ 
  sessions, 
  isLoading, 
  onTerminateSession, 
  onTerminateAll 
}: UserSessionsListProps) {
  const activeSessions = sessions.filter(s => s.is_valid);
  const expiredSessions = sessions.filter(s => !s.is_valid);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-[hsl(var(--portal-text-secondary))]">
        <Globe className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No sessions found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeSessions.length > 0 && (
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
            Active Sessions ({activeSessions.length})
          </h4>
          {activeSessions.length > 1 && (
            <V3Button 
              variant="destructive" 
              size="sm"
              onClick={onTerminateAll}
            >
              Terminate All
            </V3Button>
          )}
        </div>
      )}

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-3">
          {/* Active Sessions */}
          {activeSessions.map((session) => (
            <div 
              key={session.session_id}
              className="p-3 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))] space-y-2"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-md bg-[hsl(var(--portal-bg-tertiary))]">
                    {getDeviceIcon(session.device_info)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                      {session.device_info?.browser || 'Unknown Browser'} 
                      {session.device_info?.os && ` on ${session.device_info.os}`}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[hsl(var(--portal-text-secondary))]">
                      {session.is_current && (
                        <V3Badge variant="success" className="text-[10px] py-0">Current</V3Badge>
                      )}
                      <span>{session.ip_address || 'Unknown IP'}</span>
                    </div>
                  </div>
                </div>
                <V3Button 
                  variant="ghost" 
                  size="icon-sm"
                  onClick={() => onTerminateSession(session.session_id)}
                  className="text-[hsl(var(--portal-error))] hover:text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)]"
                >
                  <XCircle className="h-4 w-4" />
                </V3Button>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-[hsl(var(--portal-text-secondary))]">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Active {formatDistanceToNow(new Date(session.last_active_at), { addSuffix: true })}
                </div>
                {session.city && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {session.city}{session.country ? `, ${session.country}` : ''}
                  </div>
                )}
              </div>

              <div className="text-xs text-[hsl(var(--portal-text-muted))]">
                Started: {format(new Date(session.started_at), 'PPp')}
              </div>
            </div>
          ))}

          {/* Expired Sessions */}
          {expiredSessions.length > 0 && (
            <>
              <h4 className="text-sm font-medium text-[hsl(var(--portal-text-secondary))] mt-4 pt-4 border-t border-[hsl(var(--portal-border))]">
                Previous Sessions ({expiredSessions.length})
              </h4>
              {expiredSessions.map((session) => (
                <div 
                  key={session.session_id}
                  className="p-3 rounded-lg bg-[hsl(var(--portal-bg-tertiary)/0.5)] border border-[hsl(var(--portal-border)/0.5)] space-y-2 opacity-70"
                >
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-md bg-[hsl(var(--portal-bg-tertiary))]">
                      {getDeviceIcon(session.device_info)}
                    </div>
                    <div>
                      <p className="text-sm text-[hsl(var(--portal-text-secondary))]">
                        {session.device_info?.browser || 'Unknown Browser'} 
                        {session.device_info?.os && ` on ${session.device_info.os}`}
                      </p>
                      <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                        {session.ip_address || 'Unknown IP'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 text-xs text-[hsl(var(--portal-text-muted))]">
                    <span>
                      {session.ended_at 
                        ? `Ended: ${format(new Date(session.ended_at), 'PPp')}`
                        : `Expired: ${format(new Date(session.expires_at), 'PPp')}`}
                    </span>
                    {session.city && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {session.city}{session.country ? `, ${session.country}` : ''}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
