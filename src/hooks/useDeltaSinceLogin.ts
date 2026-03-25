import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { proxyQuery } from "@/lib/supabaseProxy";

interface DeltaStats {
  newArticles: number;
  newAlerts: number;
  newTrends: number;
  lastLoginAt: string | null;
  hoursSinceLogin: number;
}

export function useDeltaSinceLogin() {
  const { user } = useAuth();
  const [delta, setDelta] = useState<DeltaStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const fetchDelta = async () => {
      try {
        // Get user's last login time (via proxy for CORS compatibility)
        const { data: userData } = await proxyQuery<{ last_login_at: string | null }>({
          table: "client_users",
          select: "last_login_at",
          filters: { id: user.id },
          single: true,
        });

        const lastLoginAt = userData?.last_login_at;
        
        if (!lastLoginAt) {
          setDelta(null);
          setIsLoading(false);
          return;
        }

        const loginDate = new Date(lastLoginAt);
        const hoursSinceLogin = Math.floor((Date.now() - loginDate.getTime()) / (1000 * 60 * 60));

        // For the count queries, we need to use direct supabase since the proxy
        // doesn't support count queries with gte filters yet.
        // These run after auth is confirmed, so they should work.
        const [articlesResult, alertsResult, trendsResult] = await Promise.all([
          supabase
            .from("articles")
            .select("id", { count: "exact", head: true })
            .gte("published_date", lastLoginAt),
          supabase
            .from("client_entity_alerts")
            .select("id", { count: "exact", head: true })
            .gte("created_at", lastLoginAt),
          supabase
            .from("trend_events")
            .select("id", { count: "exact", head: true })
            .gte("first_seen_at", lastLoginAt),
        ]);

        setDelta({
          newArticles: articlesResult.count || 0,
          newAlerts: alertsResult.count || 0,
          newTrends: trendsResult.count || 0,
          lastLoginAt,
          hoursSinceLogin,
        });
      } catch (error) {
        console.error("Error fetching delta since login:", error);
        setDelta(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDelta();
  }, [user]);

  return { delta, isLoading };
}
