import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingCard } from "@/components/ui/loading-spinner";
import { BillAlertToggle } from "@/components/bills/BillAlertToggle";
import { ArrowLeft, Users, Calendar, FileText, Activity, ExternalLink } from "lucide-react";
import { format } from "date-fns";

const STATUS_STEPS = {
  'introduced': { label: 'Introduced', progress: 10, color: 'bg-blue-500' },
  'in_committee': { label: 'In Committee', progress: 30, color: 'bg-yellow-500' },
  'passed_house': { label: 'Passed House', progress: 50, color: 'bg-orange-500' },
  'passed_senate': { label: 'Passed Senate', progress: 50, color: 'bg-orange-500' },
  'passed_both': { label: 'Passed Both Chambers', progress: 75, color: 'bg-green-500' },
  'enacted': { label: 'Enacted', progress: 100, color: 'bg-emerald-600' },
  'vetoed': { label: 'Vetoed', progress: 100, color: 'bg-red-500' },
};

const PARTY_COLORS: Record<string, string> = {
  'D': 'bg-blue-600',
  'R': 'bg-red-600',
  'I': 'bg-purple-600',
};

// Generate Congress.gov URL from bill data
const getCongressGovUrl = (billNumber: string, billType: string, congress: number): string => {
  const numberOnly = billNumber.replace(/[^0-9]/g, '');
  const typeMap: Record<string, string> = {
    'hr': 'house-bill',
    's': 'senate-bill',
    'hjres': 'house-joint-resolution',
    'sjres': 'senate-joint-resolution',
    'hconres': 'house-concurrent-resolution',
    'sconres': 'senate-concurrent-resolution',
    'hres': 'house-resolution',
    'sres': 'senate-resolution',
  };
  const urlType = typeMap[billType.toLowerCase()] || billType;
  return `https://www.congress.gov/bill/${congress}th-congress/${urlType}/${numberOnly}`;
};

export default function BillDetail() {
  const { billNumber } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [bill, setBill] = useState<any>(null);
  const [actions, setActions] = useState<any[]>([]);
  const [fullText, setFullText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingText, setLoadingText] = useState(false);

  const handleBack = () => {
    // Try to go back in history, or go to admin dashboard
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/admin');
    }
  };

  useEffect(() => {
    if (billNumber) {
      fetchBillDetails();
    }
  }, [billNumber]);

  const fetchBillDetails = async () => {
    try {
      setLoading(true);
      
      // Fetch bill
      const { data: billData, error: billError } = await supabase
        .from('bills')
        .select('*')
        .eq('bill_number', billNumber)
        .maybeSingle();

      if (billError) throw billError;
      if (!bill) {
        toast({
          title: "Error",
          description: "Bill not found",
          variant: "destructive",
        });
        navigate('/');
        return;
      }
      setBill(billData);

      // Fetch actions
      const { data: actionsData, error: actionsError } = await supabase
        .from('bill_actions')
        .select('*')
        .eq('bill_id', billData.id)
        .order('action_date', { ascending: false });

      if (actionsError) throw actionsError;
      setActions(actionsData || []);

    } catch (error) {
      console.error('Error fetching bill details:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFullText = async () => {
    if (!bill || loadingText || fullText) return;

    try {
      setLoadingText(true);
      
      // Call Congress.gov API to fetch full text
      // Extract just the number from bill_number (e.g., "HR123" -> "123", "HRES876" -> "876")
      const numberOnly = bill.bill_number.replace(/[^0-9]/g, '');

      const { data, error } = await supabase.functions.invoke('fetch-bill-text', {
        body: {
          congress: bill.congress,
          billType: bill.bill_type.toLowerCase(),
          billNumber: numberOnly
        }
      });

      if (error) throw error;
      setFullText(data.fullText || "Full text not available");
      
    } catch (error) {
      console.error('Error fetching full text:', error);
      setFullText("Error loading full text. Please try again later.");
    } finally {
      setLoadingText(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <main className="container mx-auto px-4 py-8">
          <LoadingCard />
        </main>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-muted-foreground">Bill not found</p>
              <Button onClick={handleBack} className="mt-4">
                Back to Bills
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const statusInfo = STATUS_STEPS[bill.current_status as keyof typeof STATUS_STEPS] || STATUS_STEPS.introduced;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <main className="container mx-auto px-4 py-8">
        {/* Back Button */}
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Bills
        </Button>

        {/* Bill Header */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Badge variant="outline" className="font-mono text-lg">
                    {bill.bill_number}
                  </Badge>
                  <Badge variant="secondary">{bill.bill_type.toUpperCase()}</Badge>
                  <Badge 
                    style={{ 
                      backgroundColor: `hsl(${(bill.relevance_score / 100) * 120}, 70%, 50%)` 
                    }}
                  >
                    Relevance: {bill.relevance_score}%
                  </Badge>
                </div>
                <CardTitle className="text-2xl mb-2">{bill.title}</CardTitle>
                {bill.short_title && (
                  <CardDescription className="text-base">{bill.short_title}</CardDescription>
                )}
              </div>
              <BillAlertToggle billId={bill.id} billNumber={bill.bill_number} />
            </div>
          </CardHeader>
        </Card>

        {/* Status Progress */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Bill Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{statusInfo.label}</span>
                <span className="text-muted-foreground">{statusInfo.progress}%</span>
              </div>
              <Progress value={statusInfo.progress} className="h-3" />
              {bill.introduced_date && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Introduced: {format(new Date(bill.introduced_date), 'MMMM d, yyyy')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="actions" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="actions">
                  <Activity className="w-4 h-4 mr-2" />
                  Actions & History
                </TabsTrigger>
                <TabsTrigger value="text" onClick={fetchFullText}>
                  <FileText className="w-4 h-4 mr-2" />
                  Full Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="actions">
                <Card>
                  <CardHeader>
                    <CardTitle>Legislative Actions</CardTitle>
                    <CardDescription>
                      Complete history of actions taken on this bill
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {actions.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                          No actions recorded yet
                        </p>
                      ) : (
                        actions.map((action, i) => (
                          <div key={action.id} className="border-l-2 border-muted pl-4 pb-4">
                            <div className="flex items-start gap-3">
                              <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-sm font-medium">
                                    {format(new Date(action.action_date), 'MMM d, yyyy')}
                                  </span>
                                  {action.chamber && (
                                    <Badge variant="outline" className="text-xs">
                                      {action.chamber}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {action.action_text}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="text">
                <Card>
                  <CardHeader>
                    <CardTitle>Full Bill Text</CardTitle>
                    <CardDescription>
                      Complete text of the legislation
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingText ? (
                      <LoadingCard />
                    ) : fullText ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                          {fullText}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Button onClick={fetchFullText}>Load Full Text</Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Sponsor Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Sponsor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {bill.sponsor_name ? (
                  <div className="space-y-2">
                    <p className="font-medium">{bill.sponsor_name}</p>
                    <div className="flex gap-2">
                      {bill.sponsor_party && (
                        <Badge 
                          className={`${PARTY_COLORS[bill.sponsor_party]} text-white border-0`}
                        >
                          {bill.sponsor_party}
                        </Badge>
                      )}
                      {bill.sponsor_state && (
                        <Badge variant="outline">{bill.sponsor_state}</Badge>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No sponsor information</p>
                )}
              </CardContent>
            </Card>

            {/* Cosponsors */}
            {bill.cosponsor_count > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cosponsors</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-2xl font-bold">{bill.cosponsor_count}</p>
                    {bill.cosponsor_party_breakdown && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(bill.cosponsor_party_breakdown).map(([party, count]) => (
                          <Badge
                            key={party}
                            className={`${PARTY_COLORS[party]} text-white border-0`}
                          >
                            {party}: {count as number}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Committees */}
            {bill.committee_assignments && bill.committee_assignments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Committees</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {bill.committee_assignments.map((committee: string, i: number) => (
                      <Badge key={i} variant="secondary" className="block">
                        {committee}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Related Bills */}
            {bill.related_bills && bill.related_bills.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Related Bills</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {bill.related_bills.map((relatedBill: string, i: number) => (
                      <Badge key={i} variant="outline" className="block font-mono">
                        {relatedBill}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* External Link - always available using generated URL */}
            <Button variant="outline" className="w-full" asChild>
              <a
                href={getCongressGovUrl(bill.bill_number, bill.bill_type, bill.congress)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                View on Congress.gov
              </a>
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
