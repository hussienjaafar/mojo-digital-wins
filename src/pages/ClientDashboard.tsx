import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LogOut, TrendingUp, DollarSign, Users, Target, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { Session } from "@supabase/supabase-js";
import { ThemeToggle } from "@/components/ThemeToggle";
import ClientMetricsOverview from "@/components/client/ClientMetricsOverview";
import MetaAdsMetrics from "@/components/client/MetaAdsMetrics";
import SMSMetrics from "@/components/client/SMSMetrics";
import DonationMetrics from "@/components/client/DonationMetrics";
import SyncControls from "@/components/client/SyncControls";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

type DateRange = '7' | '30' | '90' | 'custom';

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30');
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/client-login");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/client-login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      loadUserOrganization();
    }
  }, [session]);

  useEffect(() => {
    if (dateRange !== 'custom') {
      const days = parseInt(dateRange);
      setStartDate(format(subDays(new Date(), days), 'yyyy-MM-dd'));
      setEndDate(format(new Date(), 'yyyy-MM-dd'));
    }
  }, [dateRange]);

  const loadUserOrganization = async () => {
    try {
      const { data: clientUser, error: userError } = await (supabase as any)
        .from('client_users')
        .select('organization_id')
        .eq('id', session?.user?.id)
        .single();

      if (userError) throw userError;
      if (!clientUser) {
        toast({
          title: "Error",
          description: "You don't have access to a client organization",
          variant: "destructive",
        });
        navigate('/');
        return;
      }

      const { data: org, error: orgError } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', clientUser.organization_id)
        .single();

      if (orgError) throw orgError;
      setOrganization(org);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load organization",
        variant: "destructive",
      });
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/client-login');
  };

  if (isLoading || !organization) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground font-medium">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      {/* Modern Header with Glassmorphism */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {organization.logo_url && (
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                  <img 
                    src={organization.logo_url} 
                    alt={organization.name}
                    className="relative h-16 w-auto object-contain"
                  />
                </div>
              )}
              <div>
                <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
                  {organization.name}
                </h1>
                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Campaign Dashboard
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="border-border/50 hover:border-destructive/50 hover:text-destructive transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1800px] mx-auto px-6 lg:px-8 py-8">
        {/* Date Range Controls with Modern Design */}
        <div className="mb-8">
          <Card className="border-border/50 shadow-lg bg-card/50 backdrop-blur">
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-xl">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Campaign Performance</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Track your metrics and ROI in real-time
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <Select value={dateRange} onValueChange={(value: DateRange) => setDateRange(value)}>
                    <SelectTrigger className="w-[180px] border-border/50">
                      <SelectValue placeholder="Select date range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                      <SelectItem value="custom">Custom range</SelectItem>
                    </SelectContent>
                  </Select>
                  {dateRange === 'custom' && (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="px-4 py-2 border border-border/50 rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="px-4 py-2 border border-border/50 rounded-lg text-sm bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sync Controls */}
        <SyncControls organizationId={organization.id} />

        {/* Modern Tabs with Better Styling */}
        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="bg-card/50 backdrop-blur border border-border/50 p-1.5 h-auto gap-2">
            <TabsTrigger 
              value="overview" 
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all px-6 py-3 rounded-lg font-medium"
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="meta"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all px-6 py-3 rounded-lg font-medium"
            >
              <Target className="h-4 w-4 mr-2" />
              Meta Ads
            </TabsTrigger>
            <TabsTrigger 
              value="sms"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all px-6 py-3 rounded-lg font-medium"
            >
              <Users className="h-4 w-4 mr-2" />
              SMS Campaigns
            </TabsTrigger>
            <TabsTrigger 
              value="donations"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all px-6 py-3 rounded-lg font-medium"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Donations
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <ClientMetricsOverview 
              organizationId={organization.id} 
              startDate={startDate} 
              endDate={endDate} 
            />
          </TabsContent>

          <TabsContent value="meta">
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

          <TabsContent value="donations">
            <DonationMetrics 
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

export default ClientDashboard;
