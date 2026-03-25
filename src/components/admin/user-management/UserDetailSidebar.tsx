import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { V3Badge, type V3BadgeVariant } from "@/components/v3/V3Badge";
import { V3Button } from "@/components/v3/V3Button";
import { 
  Shield, ShieldOff, Calendar, Clock, Globe, Activity, 
  MapPin, Monitor, AlertTriangle, Lock, Unlock, X
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserSessionsList } from "./UserSessionsList";
import { UserLoginHistory } from "./UserLoginHistory";
import { UserActivityLog } from "./UserActivityLog";
import { UserLocationMap } from "./UserLocationMap";
import type { EnhancedUser, UserDetailTab, DetailedSession, LoginAttempt, ActivityLog, LocationData } from "./types";

interface UserDetailSidebarProps {
  user: EnhancedUser | null;
  open: boolean;
  onClose: () => void;
  onUserUpdated?: () => void;
}

const getRoleBadgeVariant = (role: string): V3BadgeVariant => {
  switch (role) {
    case 'admin': return 'info';
    case 'manager': return 'purple';
    case 'editor': return 'success';
    case 'viewer': return 'muted';
    default: return 'muted';
  }
};

const getStatusBadgeVariant = (status: string): V3BadgeVariant => {
  switch (status) {
    case 'active': return 'success';
    case 'pending': return 'warning';
    case 'suspended': return 'error';
    case 'inactive': return 'muted';
    default: return 'muted';
  }
};

export function UserDetailSidebar({ user, open, onClose, onUserUpdated }: UserDetailSidebarProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<UserDetailTab>('overview');
  const [sessions, setSessions] = useState<DetailedSession[]>([]);
  const [loginHistory, setLoginHistory] = useState<LoginAttempt[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user && open) {
      loadTabData(activeTab);
    }
  }, [user, open, activeTab]);

  const loadTabData = async (tab: UserDetailTab) => {
    if (!user) return;
    setIsLoading(true);

    try {
      switch (tab) {
        case 'sessions':
          const { data: sessionsData } = await (supabase.rpc as any)('get_user_sessions_detailed', {
            p_user_id: user.id,
            p_include_expired: true,
            p_limit: 50
          });
          setSessions((sessionsData as DetailedSession[]) || []);
          break;

        case 'logins':
          const { data: loginsData } = await (supabase.rpc as any)('get_user_login_history', {
            p_user_id: user.id,
            p_limit: 50
          });
          setLoginHistory((loginsData as LoginAttempt[]) || []);
          break;

        case 'activity':
          const { data: activityData } = await (supabase.rpc as any)('get_user_activity_logs', {
            p_user_id: user.id,
            p_limit: 100,
            p_offset: 0
          });
          setActivityLogs((activityData as ActivityLog[]) || []);
          break;

        case 'location':
          // Aggregate locations from sessions
          const { data: locationSessions } = await (supabase.rpc as any)('get_user_sessions_detailed', {
            p_user_id: user.id,
            p_include_expired: true,
            p_limit: 100
          });
          
          const locationMap = new Map<string, LocationData>();
          (locationSessions as DetailedSession[] || []).forEach(session => {
            if (session.latitude && session.longitude) {
              const key = `${session.latitude},${session.longitude}`;
              const existing = locationMap.get(key);
              if (existing) {
                existing.count++;
                if (new Date(session.last_active_at) > new Date(existing.last_seen)) {
                  existing.last_seen = session.last_active_at;
                }
              } else {
                locationMap.set(key, {
                  latitude: session.latitude,
                  longitude: session.longitude,
                  city: session.city,
                  country: session.country,
                  count: 1,
                  last_seen: session.last_active_at
                });
              }
            }
          });
          setLocations(Array.from(locationMap.values()));
          break;
      }
    } catch (error) {
      console.error(`Error loading ${tab} data:`, error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      const { error } = await (supabase.rpc as any)('end_user_session', { p_session_id: sessionId });
      if (error) throw error;
      
      toast({ title: "Session terminated", description: "The session has been ended." });
      loadTabData('sessions');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleTerminateAllSessions = async () => {
    if (!user) return;
    try {
      const { error } = await (supabase.rpc as any)('end_all_user_sessions', { p_user_id: user.id });
      if (error) throw error;
      
      toast({ title: "All sessions terminated", description: "All user sessions have been ended." });
      loadTabData('sessions');
      onUserUpdated?.();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-[540px] bg-[hsl(var(--portal-bg-primary))] border-l border-[hsl(var(--portal-border))] overflow-y-auto">
        <SheetHeader className="pb-4 border-b border-[hsl(var(--portal-border))]">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 border-2 border-[hsl(var(--portal-border))]">
                <AvatarFallback className="bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))] text-lg font-semibold">
                  {getInitials(user.full_name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <SheetTitle className="text-lg text-[hsl(var(--portal-text-primary))]">
                  {user.full_name}
                </SheetTitle>
                <p className="text-sm text-[hsl(var(--portal-text-secondary))]">{user.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <V3Badge variant={getRoleBadgeVariant(user.role)} className="capitalize">{user.role}</V3Badge>
                  <V3Badge variant={getStatusBadgeVariant(user.status)}>{user.status}</V3Badge>
                  {user.is_locked && (
                    <V3Badge variant="error">
                      <Lock className="w-3 h-3 mr-1" />
                      Locked
                    </V3Badge>
                  )}
                </div>
              </div>
            </div>
            <V3Button variant="ghost" size="icon-sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </V3Button>
          </div>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as UserDetailTab)} className="mt-4">
          <TabsList className="grid w-full grid-cols-5 bg-[hsl(var(--portal-bg-tertiary))]">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="sessions" className="text-xs">Sessions</TabsTrigger>
            <TabsTrigger value="logins" className="text-xs">Logins</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
            <TabsTrigger value="location" className="text-xs">Location</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            {/* Security Status */}
            <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
              <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-3">Security Status</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  {user.mfa_enabled ? (
                    <>
                      <Shield className="h-4 w-4 text-[hsl(var(--portal-success))]" />
                      <span className="text-sm text-[hsl(var(--portal-success))]">MFA Enabled</span>
                    </>
                  ) : (
                    <>
                      <ShieldOff className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
                      <span className="text-sm text-[hsl(var(--portal-warning))]">MFA Disabled</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {user.is_locked ? (
                    <>
                      <Lock className="h-4 w-4 text-[hsl(var(--portal-error))]" />
                      <span className="text-sm text-[hsl(var(--portal-error))]">Account Locked</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="h-4 w-4 text-[hsl(var(--portal-success))]" />
                      <span className="text-sm text-[hsl(var(--portal-text-secondary))]">Account Active</span>
                    </>
                  )}
                </div>
                {user.failed_logins_24h > 0 && (
                  <div className="col-span-2 flex items-center gap-2 p-2 rounded bg-[hsl(var(--portal-error)/0.1)]">
                    <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-error))]" />
                    <span className="text-sm text-[hsl(var(--portal-error))]">
                      {user.failed_logins_24h} failed login{user.failed_logins_24h > 1 ? 's' : ''} in last 24h
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Account Info */}
            <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
              <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-3">Account Information</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[hsl(var(--portal-text-secondary))]">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">Created</span>
                  </div>
                  <span className="text-sm text-[hsl(var(--portal-text-primary))]">
                    {format(new Date(user.created_at), 'PPP')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[hsl(var(--portal-text-secondary))]">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm">Last Login</span>
                  </div>
                  <span className="text-sm text-[hsl(var(--portal-text-primary))]">
                    {user.last_login_at 
                      ? formatDistanceToNow(new Date(user.last_login_at), { addSuffix: true })
                      : 'Never'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[hsl(var(--portal-text-secondary))]">
                    <Globe className="h-4 w-4" />
                    <span className="text-sm">Organization</span>
                  </div>
                  <span className="text-sm text-[hsl(var(--portal-text-primary))]">
                    {user.organization_name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[hsl(var(--portal-text-secondary))]">
                    <Monitor className="h-4 w-4" />
                    <span className="text-sm">Sessions (30d)</span>
                  </div>
                  <span className="text-sm text-[hsl(var(--portal-text-primary))]">
                    {user.active_sessions_30d}
                  </span>
                </div>
              </div>
            </div>

            {/* Latest Session */}
            {user.latest_session && (
              <div className="p-4 rounded-lg bg-[hsl(var(--portal-bg-secondary))] border border-[hsl(var(--portal-border))]">
                <h4 className="text-sm font-medium text-[hsl(var(--portal-text-primary))] mb-3">Latest Session</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[hsl(var(--portal-text-secondary))]">Last Active</span>
                    <span className="text-sm text-[hsl(var(--portal-text-primary))]">
                      {formatDistanceToNow(new Date(user.latest_session.last_active_at), { addSuffix: true })}
                    </span>
                  </div>
                  {user.latest_session.city && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[hsl(var(--portal-text-secondary))]">Location</span>
                      <div className="flex items-center gap-1 text-sm text-[hsl(var(--portal-text-primary))]">
                        <MapPin className="h-3 w-3" />
                        {user.latest_session.city}, {user.latest_session.country}
                      </div>
                    </div>
                  )}
                  {user.latest_session.device_info?.browser && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[hsl(var(--portal-text-secondary))]">Device</span>
                      <span className="text-sm text-[hsl(var(--portal-text-primary))]">
                        {user.latest_session.device_info.browser} on {user.latest_session.device_info.os}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            <UserSessionsList 
              sessions={sessions}
              isLoading={isLoading}
              onTerminateSession={handleTerminateSession}
              onTerminateAll={handleTerminateAllSessions}
            />
          </TabsContent>

          <TabsContent value="logins" className="mt-4">
            <UserLoginHistory 
              loginHistory={loginHistory}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="activity" className="mt-4">
            <UserActivityLog 
              activityLogs={activityLogs}
              isLoading={isLoading}
            />
          </TabsContent>

          <TabsContent value="location" className="mt-4">
            <UserLocationMap 
              locations={locations}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
