import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, TrendingUp, DollarSign, Users, Target, Calendar } from "lucide-react";
import { format, subDays } from "date-fns";
import { Session } from "@supabase/supabase-js";
import ClientMetricsOverview from "@/components/client/ClientMetricsOverview";
import MetaAdsMetrics from "@/components/client/MetaAdsMetrics";
import SMSMetrics from "@/components/client/SMSMetrics";
import DonationMetrics from "@/components/client/DonationMetrics";
import SyncControls from "@/components/client/SyncControls";
import { DateRangeSelector } from "@/components/dashboard/DateRangeSelector";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

const AdminClientView = () => {
  const navigate = useNavigate();
  const { organizationId } = useParams();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      checkAdminAndLoadOrganization();
    }
  }, [session, organizationId]);

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  const checkAdminAndLoadOrganization = async () => {
    if (!session?.user?.id) {
      navigate('/auth');
      return;
    }

    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });

      if (error || !data) {
        navigate('/admin');
        return;
      }

      setIsAdmin(true);
      await loadOrganization();
    } catch (error) {
      navigate('/admin');
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrganization = async () => {
    if (!organizationId) {
      navigate('/admin');
      return;
    }

    try {
      const { data: org, error: orgError } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', organizationId)
        .single();

      if (orgError) throw orgError;
      setOrganization(org);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load organization",
        variant: "destructive",
      });
      navigate('/admin');
    }
  };

  if (isLoading || !organization || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading client dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/admin')}
                className="bg-primary-foreground/10 hover:bg-primary-foreground/20 border-primary-foreground/20"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Admin
              </Button>
              {organization.logo_url && (
                <img src={organization.logo_url} alt={organization.name} className="h-8 object-contain" />
              )}
              <h1 className="text-2xl font-bold">{organization.name}</h1>
            </div>
            <span className="text-sm opacity-90">Admin View</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Date Range Selector */}
        <div className="mb-6">
          <DateRangeSelector
            startDate={startDate}
            endDate={endDate}
            onDateChange={handleDateChange}
          />
        </div>

        {/* Sync Controls */}
        <SyncControls organizationId={organization.id} />

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="donations">
              <DollarSign className="h-4 w-4 mr-2" />
              Donations
            </TabsTrigger>
            <TabsTrigger value="meta-ads">
              <Target className="h-4 w-4 mr-2" />
              Meta Ads
            </TabsTrigger>
            <TabsTrigger value="sms">
              <Users className="h-4 w-4 mr-2" />
              SMS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ClientMetricsOverview 
              organizationId={organization.id}
              startDate={startDate}
              endDate={endDate}
            />
          </TabsContent>

          <TabsContent value="donations">
            <DonationMetrics
              organizationId={organization.id}
              startDate={startDate}
              endDate={endDate}
            />
          </TabsContent>

          <TabsContent value="meta-ads">
            <MetaAdsMetrics
              organizationId={organization.id}
              startDate={startDate}
              endDate={endDate}
            />
          </TabsContent>

          <TabsContent value="sms">
            <SMSMetrics
              organizationId={organization.id}
              startDate={startDate}
              endDate={endDate}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default AdminClientView;
