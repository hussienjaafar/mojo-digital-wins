import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, DollarSign, Target, MessageSquare, Mail, MousePointerClick } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Session } from "@supabase/supabase-js";
import { ClientLayout } from "@/components/client/ClientLayout";

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

type TouchpointType = {
  id: string;
  touchpoint_type: string;
  occurred_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  metadata: any;
};

type DonorJourney = {
  donor_email: string;
  transaction_date: string;
  amount: number;
  touchpoints: TouchpointType[];
  attribution_weights: {
    first_touch: number;
    middle_touch: number;
    last_touch: number;
  };
};

const getTouchpointIcon = (type: string) => {
  switch (type) {
    case 'meta_ad_click':
      return <MousePointerClick className="h-5 w-5 text-blue-500" />;
    case 'sms_send':
      return <MessageSquare className="h-5 w-5 text-green-500" />;
    case 'email_open':
    case 'email_click':
      return <Mail className="h-5 w-5 text-purple-500" />;
    default:
      return <Target className="h-5 w-5 text-gray-500" />;
  }
};

const getTouchpointColor = (type: string) => {
  switch (type) {
    case 'meta_ad_click':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'sms_send':
      return 'bg-green-500/10 text-green-500 border-green-500/20';
    case 'email_open':
    case 'email_click':
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
};

const ClientDonorJourney = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [journeys, setJourneys] = useState<DonorJourney[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [minAmount, setMinAmount] = useState("0");

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
  }, [session, minAmount]);

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

      // Load transactions
      const { data: transactions } = await (supabase as any)
        .from('actblue_transactions')
        .select('*')
        .eq('organization_id', clientUser.organization_id)
        .gte('amount', Number(minAmount))
        .order('transaction_date', { ascending: false })
        .limit(20);

      if (!transactions) {
        setJourneys([]);
        return;
      }

      // For each transaction, load attribution touchpoints
      const journeysData: DonorJourney[] = [];
      
      for (const transaction of transactions) {
        // Load touchpoints for this donor
        const { data: touchpoints } = await (supabase as any)
          .from('attribution_touchpoints')
          .select('*')
          .eq('organization_id', clientUser.organization_id)
          .eq('donor_email', transaction.donor_email)
          .lte('occurred_at', transaction.transaction_date)
          .order('occurred_at', { ascending: true });

        if (touchpoints && touchpoints.length > 0) {
          // Calculate attribution weights (40% first, 20% middle each, 40% last)
          const weights = {
            first_touch: 0.4 * transaction.amount,
            middle_touch: touchpoints.length > 2 ? (0.2 * transaction.amount) / (touchpoints.length - 2) : 0,
            last_touch: 0.4 * transaction.amount,
          };

          journeysData.push({
            donor_email: transaction.donor_email,
            transaction_date: transaction.transaction_date,
            amount: transaction.amount,
            touchpoints,
            attribution_weights: weights,
          });
        }
      }

      setJourneys(journeysData);
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

  if (isLoading || !organization) {
    return null;
  }

  return (
    <ClientLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold mb-6">Donor Journey & Attribution</h2>
        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filter Journeys</CardTitle>
            <CardDescription>View donor touchpoints leading to conversions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Minimum Donation Amount</label>
                <Select value={minAmount} onValueChange={setMinAmount}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">All Amounts</SelectItem>
                    <SelectItem value="25">$25+</SelectItem>
                    <SelectItem value="50">$50+</SelectItem>
                    <SelectItem value="100">$100+</SelectItem>
                    <SelectItem value="250">$250+</SelectItem>
                    <SelectItem value="500">$500+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attribution Model Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Multi-Touch Attribution Model</CardTitle>
            <CardDescription>40% First Touch • 20% Middle Touches • 40% Last Touch</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">40%</div>
                <div className="text-sm text-muted-foreground">First Touch</div>
                <p className="text-xs mt-1">Initial awareness</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-500">20%</div>
                <div className="text-sm text-muted-foreground">Middle Touches</div>
                <p className="text-xs mt-1">Nurturing phase</p>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-500">40%</div>
                <div className="text-sm text-muted-foreground">Last Touch</div>
                <p className="text-xs mt-1">Final conversion</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Donor Journeys */}
        {journeys.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No donor journeys found</h3>
              <p className="text-muted-foreground text-center">
                Attribution data will appear here once touchpoints are tracked
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {journeys.map((journey, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{journey.donor_email}</CardTitle>
                      <CardDescription>
                        {format(new Date(journey.transaction_date), 'MMM d, yyyy h:mm a')}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-500" />
                        <span className="text-2xl font-bold text-green-500">
                          ${journey.amount.toFixed(2)}
                        </span>
                      </div>
                      <Badge className="mt-1">{journey.touchpoints.length} touchpoints</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Journey Timeline */}
                  <div className="relative">
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />
                    <div className="space-y-6">
                      {journey.touchpoints.map((touchpoint, tIndex) => {
                        const isFirst = tIndex === 0;
                        const isLast = tIndex === journey.touchpoints.length - 1;
                        const weight = isFirst 
                          ? journey.attribution_weights.first_touch 
                          : isLast 
                          ? journey.attribution_weights.last_touch 
                          : journey.attribution_weights.middle_touch;

                        return (
                          <div key={touchpoint.id} className="relative flex items-start gap-4">
                            <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-background border-2 border-primary">
                              {getTouchpointIcon(touchpoint.touchpoint_type)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className={getTouchpointColor(touchpoint.touchpoint_type)}>
                                  {touchpoint.touchpoint_type.replace('_', ' ')}
                                </Badge>
                                {isFirst && <Badge className="bg-blue-500">First Touch (40%)</Badge>}
                                {isLast && <Badge className="bg-purple-500">Last Touch (40%)</Badge>}
                                {!isFirst && !isLast && <Badge variant="secondary">Middle (20%)</Badge>}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(touchpoint.occurred_at), 'MMM d, yyyy h:mm a')}
                              </p>
                              {(touchpoint.utm_source || touchpoint.utm_campaign) && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {touchpoint.utm_source && `Source: ${touchpoint.utm_source}`}
                                  {touchpoint.utm_campaign && ` • Campaign: ${touchpoint.utm_campaign}`}
                                </div>
                              )}
                              <div className="text-sm font-semibold text-primary mt-1">
                                Attribution: ${weight.toFixed(2)}
                              </div>
                            </div>
                            {tIndex < journey.touchpoints.length - 1 && (
                              <ArrowRight className="h-5 w-5 text-muted-foreground mt-3" />
                            )}
                          </div>
                        );
                      })}
                      {/* Final Conversion */}
                      <div className="relative flex items-start gap-4">
                        <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-full bg-green-500 text-white">
                          <DollarSign className="h-6 w-6" />
                        </div>
                        <div className="flex-1">
                          <Badge className="bg-green-500 mb-1">Donation</Badge>
                          <p className="text-lg font-bold">${journey.amount.toFixed(2)}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(journey.transaction_date), 'MMM d, yyyy h:mm a')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ClientLayout>
  );
};

export default ClientDonorJourney;
