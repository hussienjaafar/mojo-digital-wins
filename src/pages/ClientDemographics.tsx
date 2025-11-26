import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, LogOut, MapPin, Briefcase, Users, DollarSign, TrendingUp } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Session } from "@supabase/supabase-js";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

type DonorStats = {
  totalDonors: number;
  totalRevenue: number;
  averageDonation: number;
  locationData: Array<{ state: string; count: number; revenue: number }>;
  occupationData: Array<{ occupation: string; count: number; revenue: number }>;
  channelData: Array<{ channel: string; count: number; revenue: number }>;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const ClientDemographics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [stats, setStats] = useState<DonorStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      
      // Load organization
      const { data: clientUser } = await (supabase as any)
        .from('client_users')
        .select('organization_id')
        .eq('id', session?.user?.id)
        .single();

      if (!clientUser) throw new Error("Organization not found");

      const { data: org } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', clientUser.organization_id)
        .single();

      setOrganization(org);

      // Load donor demographics from actblue_transactions
      const { data: transactions, error } = await (supabase as any)
        .from('actblue_transactions')
        .select('*')
        .eq('organization_id', clientUser.organization_id);

      if (error) throw error;

      // Calculate statistics
      const totalDonors = new Set(transactions?.map((t: any) => t.donor_email).filter(Boolean)).size;
      const totalRevenue = transactions?.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0) || 0;
      const averageDonation = totalDonors > 0 ? totalRevenue / transactions.length : 0;

      // Location breakdown
      const locationMap = new Map<string, { count: number; revenue: number }>();
      transactions?.forEach((t: any) => {
        if (t.state) {
          const existing = locationMap.get(t.state) || { count: 0, revenue: 0 };
          locationMap.set(t.state, {
            count: existing.count + 1,
            revenue: existing.revenue + Number(t.amount || 0),
          });
        }
      });
      const locationData = Array.from(locationMap.entries())
        .map(([state, data]) => ({ state, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Occupation breakdown
      const occupationMap = new Map<string, { count: number; revenue: number }>();
      transactions?.forEach((t: any) => {
        const occupation = t.occupation || 'Not Provided';
        const existing = occupationMap.get(occupation) || { count: 0, revenue: 0 };
        occupationMap.set(occupation, {
          count: existing.count + 1,
          revenue: existing.revenue + Number(t.amount || 0),
        });
      });
      const occupationData = Array.from(occupationMap.entries())
        .map(([occupation, data]) => ({ occupation, ...data }))
        .filter(item => item.occupation !== 'Not Provided')
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Channel breakdown (from refcode)
      const channelMap = new Map<string, { count: number; revenue: number }>();
      transactions?.forEach((t: any) => {
        const channel = t.refcode ? 'Campaign' : t.is_express ? 'Express' : 'Direct';
        const existing = channelMap.get(channel) || { count: 0, revenue: 0 };
        channelMap.set(channel, {
          count: existing.count + 1,
          revenue: existing.revenue + Number(t.amount || 0),
        });
      });
      const channelData = Array.from(channelMap.entries())
        .map(([channel, data]) => ({ channel, ...data }));

      setStats({
        totalDonors,
        totalRevenue,
        averageDonation,
        locationData,
        occupationData,
        channelData,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      const { data: clientUser } = await (supabase as any)
        .from('client_users')
        .select('organization_id')
        .eq('id', session?.user?.id)
        .single();

      const { data: transactions } = await (supabase as any)
        .from('actblue_transactions')
        .select('*')
        .eq('organization_id', clientUser.organization_id);

      // Create CSV
      const headers = ['Date', 'Donor Name', 'Email', 'Amount', 'State', 'City', 'Occupation', 'Employer'];
      const rows = transactions?.map((t: any) => [
        t.transaction_date,
        t.donor_name || '',
        t.donor_email || '',
        t.amount,
        t.state || '',
        t.city || '',
        t.occupation || '',
        t.employer || '',
      ]) || [];

      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `donor-demographics-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();

      toast({
        title: "Success",
        description: "Donor demographics exported to CSV",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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
          <p className="text-muted-foreground font-medium">Loading demographics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-xl border-b border-border/50 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {organization.logo_url && (
                <img src={organization.logo_url} alt={organization.name} className="h-10 w-auto" />
              )}
              <div>
                <h1 className="text-2xl font-bold">{organization.name}</h1>
                <p className="text-sm text-muted-foreground">Donor Demographics</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => navigate('/client/dashboard')}>
                Dashboard
              </Button>
              <Button variant="outline" onClick={() => navigate('/client/journey')}>
                Donor Journey
              </Button>
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <ThemeToggle />
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Donors</p>
                  <p className="text-3xl font-bold">{stats?.totalDonors.toLocaleString()}</p>
                </div>
                <Users className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-3xl font-bold">${stats?.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Average Donation</p>
                  <p className="text-3xl font-bold">${stats?.averageDonation.toFixed(2)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Location Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Top Donor Locations
            </CardTitle>
            <CardDescription>Geographic distribution of donors by state</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.locationData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="state" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="count" fill="#8884d8" name="Donor Count" />
                <Bar yAxisId="right" dataKey="revenue" fill="#82ca9d" name="Revenue ($)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Occupation Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Top Occupations
              </CardTitle>
              <CardDescription>Donor breakdown by occupation</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats?.occupationData.slice(0, 6)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.occupation}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {stats?.occupationData.slice(0, 6).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Channel Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Acquisition Channels
              </CardTitle>
              <CardDescription>How donors found you</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats?.channelData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.channel}: ${entry.count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="revenue"
                  >
                    {stats?.channelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Location Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.locationData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b">
                    <span className="font-medium">{item.state}</span>
                    <div className="text-right">
                      <div className="text-sm font-semibold">${item.revenue.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{item.count} donors</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Occupation Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.occupationData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2 border-b">
                    <span className="font-medium truncate max-w-[200px]">{item.occupation}</span>
                    <div className="text-right">
                      <div className="text-sm font-semibold">${item.revenue.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">{item.count} donors</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default ClientDemographics;
