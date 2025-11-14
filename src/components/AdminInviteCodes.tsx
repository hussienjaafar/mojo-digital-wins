import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus, Trash2, Check, Mail, RefreshCw, Settings } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast as sonnerToast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type InviteCode = {
  id: string;
  code: string;
  created_at: string;
  used_at: string | null;
  used_by: string | null;
  is_active: boolean;
  expires_at: string | null;
  email_sent_to: string | null;
  email_status: string | null;
  email_sent_at: string | null;
  email_error: string | null;
  resend_count: number;
};

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  logo_url: string | null;
  primary_color: string;
  header_text: string;
  footer_text: string;
  custom_message: string | null;
  is_default: boolean;
};

export const AdminInviteCodes = () => {
  const { toast } = useToast();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateForm, setTemplateForm] = useState<Partial<EmailTemplate>>({
    name: "",
    subject: "🎯 You've been invited to join as an Administrator",
    primary_color: "#667eea",
    header_text: "Admin Invitation",
    footer_text: "This is an automated message from your admin dashboard.",
    custom_message: "",
    logo_url: "",
    is_default: false
  });

  useEffect(() => {
    fetchInviteCodes();
    fetchTemplates();
  }, []);

  const fetchInviteCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_invite_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInviteCodes((data as any) || []);
    } catch (error) {
      console.error('Error fetching invite codes:', error);
      toast({
        title: "Error",
        description: "Failed to load invite codes.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from('admin_invite_templates')
        .select('*')
        .order('is_default', { ascending: false });

      if (error) throw error;
      setTemplates((data as any) || []);
      
      // Set default template as selected
      const defaultTemplate = (data as any)?.find((t: any) => t.is_default);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const saveTemplate = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { error } = await (supabase as any)
        .from('admin_invite_templates')
        .insert({
          name: templateForm.name || "",
          subject: templateForm.subject || "",
          logo_url: templateForm.logo_url,
          primary_color: templateForm.primary_color || "#667eea",
          header_text: templateForm.header_text || "",
          footer_text: templateForm.footer_text || "",
          custom_message: templateForm.custom_message,
          is_default: templateForm.is_default || false,
          created_by: session.session?.user?.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Email template saved!",
      });

      setShowTemplateDialog(false);
      fetchTemplates();
      setTemplateForm({
        name: "",
        subject: "🎯 You've been invited to join as an Administrator",
        primary_color: "#667eea",
        header_text: "Admin Invitation",
        footer_text: "This is an automated message from your admin dashboard.",
        custom_message: "",
        logo_url: "",
        is_default: false
      });
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: "Error",
        description: "Failed to save template.",
        variant: "destructive",
      });
    }
  };

  const generateInviteCode = async () => {
    try {
      // Generate a random 12-character code
      const code = Array.from({ length: 12 }, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
      ).join('');

      const { data: session } = await supabase.auth.getSession();
      
      // Set expiration to 7 days from now
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);
      
      const { error } = await supabase
        .from('admin_invite_codes')
        .insert({
          code,
          created_by: session.session?.user?.id,
          expires_at: expiresAt.toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "New admin invite code created (expires in 7 days)!",
      });

      fetchInviteCodes();
    } catch (error) {
      console.error('Error generating invite code:', error);
      toast({
        title: "Error",
        description: "Failed to create invite code.",
        variant: "destructive",
      });
    }
  };

  const deleteInviteCode = async (id: string) => {
    try {
      const { error } = await supabase
        .from('admin_invite_codes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Invite code deleted.",
      });

      fetchInviteCodes();
    } catch (error) {
      console.error('Error deleting invite code:', error);
      toast({
        title: "Error",
        description: "Failed to delete invite code.",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast({
        title: "Copied!",
        description: "Invite code copied to clipboard.",
      });
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy code.",
        variant: "destructive",
      });
    }
  };

  const sendInviteEmail = async () => {
    if (!inviteEmail) return;
    
    setIsSending(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      // Generate a new invite code
      const code = `ADMIN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Insert the invite code
      const { error: insertError } = await supabase
        .from('admin_invite_codes')
        .insert({
          code,
          created_by: user?.id,
          expires_at: expiresAt.toISOString(),
        });

      if (insertError) throw insertError;

      // Send the email
      const { error: emailError } = await supabase.functions.invoke('send-admin-invite', {
        body: {
          email: inviteEmail,
          inviteCode: code,
          inviterName: user?.email,
        }
      });

      if (emailError) throw emailError;

      sonnerToast.success("Invitation sent successfully!");
      setInviteEmail("");
      fetchInviteCodes();
    } catch (error) {
      console.error('Error sending invite:', error);
      sonnerToast.error("Failed to send invitation");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Admin Invite Codes</CardTitle>
            <CardDescription>
              Create and manage invite codes to grant admin access to new users
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button onClick={generateInviteCode} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Generate Code
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Mail className="h-4 w-4 mr-2" />
                  Send Invite
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Send Admin Invitation</DialogTitle>
                  <DialogDescription>
                    Send an email invitation to a new admin. They'll receive a unique invite code.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={sendInviteEmail} disabled={!inviteEmail || isSending}>
                    {isSending ? "Sending..." : "Send Invitation"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <AlertDescription>
            Share these codes with trusted users during signup to automatically grant them admin privileges. Codes expire after 7 days.
          </AlertDescription>
        </Alert>

        {inviteCodes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No invite codes yet. Generate one to get started.
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Delivery</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Used</TableHead>
              <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inviteCodes.map((code) => {
                  const isExpired = code.expires_at && new Date(code.expires_at) < new Date();
                  
                  return (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-semibold">
                        {code.code}
                      </TableCell>
                      <TableCell>
                        {code.used_at ? (
                          <Badge variant="secondary">Used</Badge>
                        ) : isExpired ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : code.is_active ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(code.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {code.expires_at ? (
                          <span className={isExpired ? "text-destructive" : ""}>
                            {new Date(code.expires_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {code.used_at ? new Date(code.used_at).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(code.code)}
                          >
                            {copiedCode === code.code ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteInviteCode(code.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
