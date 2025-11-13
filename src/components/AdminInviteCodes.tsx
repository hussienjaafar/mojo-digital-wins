import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Copy, Plus, Trash2, Check } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type InviteCode = {
  id: string;
  code: string;
  created_at: string;
  used_at: string | null;
  used_by: string | null;
  is_active: boolean;
  expires_at: string | null;
};

export const AdminInviteCodes = () => {
  const { toast } = useToast();
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    fetchInviteCodes();
  }, []);

  const fetchInviteCodes = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_invite_codes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInviteCodes(data || []);
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
          <Button onClick={generateInviteCode} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Generate Code
          </Button>
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
