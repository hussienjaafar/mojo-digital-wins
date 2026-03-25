import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, AlertTriangle, Gift } from "lucide-react";

interface SeatUsageData {
  seat_limit: number;
  bonus_seats: number;
  total_entitled: number;
  members_count: number;
  pending_invites_count: number;
  pending_requests_count: number;
  total_used: number;
  available_seats: number;
}

interface SeatUsageDisplayProps {
  organizationId: string;
  compact?: boolean;
  onDataLoaded?: (data: SeatUsageData | null) => void;
}

export function SeatUsageDisplay({
  organizationId,
  compact = false,
  onDataLoaded,
}: SeatUsageDisplayProps) {
  const [seatData, setSeatData] = useState<SeatUsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSeatUsage = async () => {
      try {
        const { data, error } = await supabase.rpc("get_org_seat_usage", {
          org_id: organizationId,
        });

        if (error) throw error;

        const usage = data?.[0] || null;
        setSeatData(usage);
        onDataLoaded?.(usage);
      } catch (error) {
        console.error("Error fetching seat usage:", error);
        setSeatData(null);
        onDataLoaded?.(null);
      } finally {
        setLoading(false);
      }
    };

    if (organizationId) {
      fetchSeatUsage();
    }
  }, [organizationId, onDataLoaded]);

  if (loading || !seatData) {
    return null;
  }

  const totalEntitled = seatData.total_entitled || (seatData.seat_limit + (seatData.bonus_seats || 0));
  const usagePercentage = Math.min(
    (seatData.total_used / totalEntitled) * 100,
    100
  );
  const isNearLimit = usagePercentage >= 80;
  const isAtLimit = seatData.available_seats <= 0;
  const hasBonus = (seatData.bonus_seats || 0) > 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-muted-foreground">
          {seatData.total_used} / {totalEntitled} seats
          {hasBonus && (
            <span className="text-primary ml-1">
              (+{seatData.bonus_seats} bonus)
            </span>
          )}
        </span>
        {isAtLimit && (
          <Badge variant="destructive" className="text-xs">
            Limit Reached
          </Badge>
        )}
        {isNearLimit && !isAtLimit && (
          <Badge variant="secondary" className="text-xs">
            Near Limit
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">Seat Usage</span>
        </div>
        {isAtLimit && (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Limit Reached
          </Badge>
        )}
        {isNearLimit && !isAtLimit && (
          <Badge variant="secondary" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Near Limit
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        <Progress value={usagePercentage} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>
            {seatData.total_used} of {totalEntitled} seats used
          </span>
          <span>{seatData.available_seats} available</span>
        </div>
      </div>

      {/* Seat breakdown */}
      {hasBonus ? (
        <div className="flex items-center gap-2 text-xs bg-primary/10 rounded-md p-2">
          <Gift className="h-3.5 w-3.5 text-primary" />
          <span className="text-foreground">
            {seatData.seat_limit} purchased + {seatData.bonus_seats} complimentary = {totalEntitled} total
          </span>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          {seatData.seat_limit} seats allocated
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-md bg-muted/50 p-2">
          <div className="font-semibold text-foreground">
            {seatData.members_count}
          </div>
          <div className="text-muted-foreground">Members</div>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <div className="font-semibold text-foreground">
            {seatData.pending_invites_count}
          </div>
          <div className="text-muted-foreground">Pending</div>
        </div>
        <div className="rounded-md bg-muted/50 p-2">
          <div className="font-semibold text-foreground">
            {seatData.pending_requests_count}
          </div>
          <div className="text-muted-foreground">Requested</div>
        </div>
      </div>

      {isAtLimit && (
        <p className="text-xs text-muted-foreground bg-destructive/10 rounded-md p-2">
          Your organization has reached its seat limit. Contact your platform
          administrator to request additional seats.
        </p>
      )}
    </div>
  );
}
