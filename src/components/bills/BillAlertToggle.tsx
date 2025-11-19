import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BillAlertToggleProps {
  billId: string;
  billNumber: string;
}

export function BillAlertToggle({ billId, billNumber }: BillAlertToggleProps) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkSubscription();
  }, [billId]);

  const checkSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('bill_alerts')
        .select('id')
        .eq('bill_id', billId)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      setIsSubscribed(!!data);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error checking subscription:', error);
      }
    }
  };

  const toggleAlert = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to set bill alerts",
          variant: "destructive",
        });
        return;
      }

      if (isSubscribed) {
        // Unsubscribe
        const { error } = await supabase
          .from('bill_alerts')
          .delete()
          .eq('bill_id', billId)
          .eq('user_id', user.id);

        if (error) throw error;

        toast({
          title: "Alert removed",
          description: `You will no longer receive updates for ${billNumber}`,
        });
        setIsSubscribed(false);
      } else {
        // Subscribe
        const { error } = await supabase
          .from('bill_alerts')
          .insert({
            bill_id: billId,
            user_id: user.id,
            alert_type: 'status_change',
          });

        if (error) throw error;

        toast({
          title: "Alert set",
          description: `You will receive updates for ${billNumber}`,
        });
        setIsSubscribed(true);
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error toggling alert:', error);
      }
      toast({
        title: "Error",
        description: "Failed to update alert settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={isSubscribed ? "default" : "outline"}
      size="sm"
      onClick={toggleAlert}
      disabled={loading}
    >
      {isSubscribed ? (
        <>
          <Bell className="w-4 h-4 mr-2" />
          Alert Active
        </>
      ) : (
        <>
          <BellOff className="w-4 h-4 mr-2" />
          Set Alert
        </>
      )}
    </Button>
  );
}
