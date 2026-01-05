import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

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
        // Get user's last login time
        const { data: userData } = await supabase
          .from("client_users")
          .select("last_login_at")
          .eq("id", user.id)
          .single();

        const lastLoginAt = userData?.last_login_at;
        
        if (!lastLoginAt) {
          setDelta(null);
          setIsLoading(false);
          return;
        }

        const loginDate = new Date(lastLoginAt);
        const hoursSinceLogin = Math.floor((Date.now() - loginDate.getTime()) / (1000 * 60 * 60));

        // Fetch counts since last login
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
            .from("trend_clusters")
            .select("id", { count: "exact", head: true })
            .gte("detected_at", lastLoginAt),
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
