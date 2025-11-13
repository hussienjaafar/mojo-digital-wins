import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { Download, LogOut, Search, Filter, MessageSquare, Mail, Sparkles, Key, Shield, Activity, Users, BarChart3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BlogGenerator } from "@/components/BlogGenerator";
import { AdminInviteCodes } from "@/components/AdminInviteCodes";
import { AuditLogs } from "@/components/AuditLogs";
import { SessionManagement } from "@/components/SessionManagement";
import { UserManagement } from "@/components/UserManagement";
import { EnhancedContactManagement } from "@/components/EnhancedContactManagement";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";

type ContactSubmission = {
  id: string;
  created_at: string;
  name: string;
  email: string;
  campaign: string | null;
  organization_type: string | null;
  message: string;
};

const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<ContactSubmission[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    // Check for existing session
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
      checkAdminStatus();
    }
  }, [session]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session?.user?.id)
        .eq('role', 'admin')
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setIsAdmin(true);
        fetchSubmissions();
      } else {
        toast({
          title: "Access Denied",
          description: "You need admin privileges to access this page.",
          variant: "destructive",
        });
        navigate("/");
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_submissions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSubmissions(data || []);
      setFilteredSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast({
        title: "Error",
        description: "Failed to load submissions",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    let filtered = submissions;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(sub =>
        sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.campaign?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply type filter
    if (typeFilter !== "all") {
      if (typeFilter === "newsletter") {
        filtered = filtered.filter(sub => sub.message === "Newsletter subscription");
      } else if (typeFilter === "contact") {
        filtered = filtered.filter(sub => sub.message !== "Newsletter subscription");
      }
    }

    setFilteredSubmissions(filtered);
  }, [searchTerm, typeFilter, submissions]);

  const exportToCSV = () => {
    const headers = ["Date", "Name", "Email", "Campaign", "Type", "Message"];
    const csvData = filteredSubmissions.map(sub => [
      new Date(sub.created_at).toLocaleDateString(),
      sub.name,
      sub.email,
      sub.campaign || "N/A",
      sub.organization_type || "N/A",
      sub.message.replace(/,/g, ";") // Replace commas to avoid CSV issues
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contact-submissions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Data exported to CSV",
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-lg">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const newsletterCount = submissions.filter(s => s.message === "Newsletter subscription").length;
  const contactCount = submissions.filter(s => s.message !== "Newsletter subscription").length;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <Button variant="outline" onClick={handleSignOut} className="bg-primary-foreground/10 hover:bg-primary-foreground/20 border-primary-foreground/20">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Submissions</CardDescription>
              <CardTitle className="text-4xl">{submissions.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Newsletter Subscribers</CardDescription>
              <CardTitle className="text-4xl">{newsletterCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Contact Forms</CardDescription>
              <CardTitle className="text-4xl">{contactCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="analytics" className="w-full">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="users">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="contacts">
              <MessageSquare className="h-4 w-4 mr-2" />
              Submissions
            </TabsTrigger>
            <TabsTrigger value="newsletter">
              <Mail className="h-4 w-4 mr-2" />
              Newsletter
            </TabsTrigger>
            <TabsTrigger value="invite-codes">
              <Key className="h-4 w-4 mr-2" />
              Invite Codes
            </TabsTrigger>
            <TabsTrigger value="blog-generator">
              <Sparkles className="h-4 w-4 mr-2" />
              Blog Generator
            </TabsTrigger>
            <TabsTrigger value="audit-logs">
              <Shield className="h-4 w-4 mr-2" />
              Audit Logs
            </TabsTrigger>
            <TabsTrigger value="sessions">
              <Activity className="h-4 w-4 mr-2" />
              Sessions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analytics">
            <AnalyticsDashboard />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement />
          </TabsContent>

          <TabsContent value="contacts">
            <EnhancedContactManagement />
          </TabsContent>

          <TabsContent value="newsletter">
            <Card>
              <CardHeader>
                <CardTitle>Newsletter Subscribers</CardTitle>
                <CardDescription>View and export newsletter subscribers</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row gap-4 mb-6 justify-end">
                  <Button onClick={exportToCSV} variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>

                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.filter(sub => sub.message === "Newsletter subscription").length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                            No newsletter subscribers found
                          </TableCell>
                        </TableRow>
                      ) : (
                        submissions
                          .filter(sub => sub.message === "Newsletter subscription")
                          .map((submission) => (
                            <TableRow key={submission.id}>
                              <TableCell className="whitespace-nowrap">
                                {new Date(submission.created_at).toLocaleDateString()}
                              </TableCell>
                              <TableCell className="font-medium">{submission.name}</TableCell>
                              <TableCell>{submission.email}</TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invite-codes">
            <AdminInviteCodes />
          </TabsContent>

          <TabsContent value="blog-generator">
            <Card>
              <CardHeader>
                <CardTitle>AI Blog Post Generator</CardTitle>
                <CardDescription>
                  Generate SEO-optimized blog posts for your political campaign using AI
                </CardDescription>
              </CardHeader>
              <CardContent>
                <BlogGenerator />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit-logs">
            <AuditLogs />
          </TabsContent>

          <TabsContent value="sessions">
            <SessionManagement />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Admin;
