import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Upload, Users, FileText, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";

interface OrgBulkInviteProps {
  organizationId: string;
  organizationName?: string;
  onComplete?: () => void;
}

interface ParsedUser {
  email: string;
  full_name: string;
  isValid: boolean;
  error?: string;
}

interface InviteResult {
  email: string;
  status: "created" | "existing" | "failed";
  error?: string;
}

export function OrgBulkInvite({ organizationId, organizationName, onComplete }: OrgBulkInviteProps) {
  const { toast } = useToast();
  const [inputMode, setInputMode] = useState<"paste" | "csv">("paste");
  const [emailInput, setEmailInput] = useState("");
  const [defaultRole, setDefaultRole] = useState("viewer");
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<InviteResult[] | null>(null);
  const [progress, setProgress] = useState(0);

  const parseEmails = (input: string) => {
    // Split by newlines, commas, or semicolons
    const lines = input.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const users: ParsedUser[] = [];
    
    for (const line of lines) {
      // Try to extract name and email
      // Format: "Name <email>" or "email" or "Name, email"
      let email = "";
      let name = "";
      
      const bracketMatch = line.match(/(.+?)\s*<(.+?)>/);
      if (bracketMatch) {
        name = bracketMatch[1].trim();
        email = bracketMatch[2].trim();
      } else {
        // Check if it's just an email
        const parts = line.split(/\s+/);
        const emailPart = parts.find((p) => emailRegex.test(p));
        if (emailPart) {
          email = emailPart;
          name = parts.filter((p) => p !== emailPart).join(" ").trim() || email.split("@")[0];
        } else if (emailRegex.test(line)) {
          email = line;
          name = line.split("@")[0];
        }
      }
      
      if (email) {
        const isValid = emailRegex.test(email);
        users.push({
          email: email.toLowerCase(),
          full_name: name || email.split("@")[0],
          isValid,
          error: isValid ? undefined : "Invalid email format",
        });
      }
    }
    
    // Remove duplicates
    const seen = new Set<string>();
    return users.filter((user) => {
      if (seen.has(user.email)) return false;
      seen.add(user.email);
      return true;
    });
  };

  const handleInputChange = (value: string) => {
    setEmailInput(value);
    if (value.trim()) {
      setParsedUsers(parseEmails(value));
    } else {
      setParsedUsers([]);
    }
    setResults(null);
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      handleInputChange(content);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    const validUsers = parsedUsers.filter((u) => u.isValid);
    if (validUsers.length === 0) {
      toast({
        title: "No valid emails",
        description: "Please enter at least one valid email address",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    setProgress(0);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke("batch-create-users", {
        body: {
          organization_id: organizationId,
          users: validUsers.map((u) => ({
            email: u.email,
            full_name: u.full_name,
            role: defaultRole,
          })),
          actor_id: user?.id,
          actor_name: user?.email,
        },
      });
      
      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || "Failed to process invites");
      }
      
      setResults(data.results);
      setProgress(100);
      
      toast({
        title: "Bulk invite complete",
        description: `Created: ${data.summary.created}, Existing: ${data.summary.existing}, Failed: ${data.summary.failed}`,
      });
      
      if (onComplete) {
        onComplete();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to process bulk invite",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const validCount = parsedUsers.filter((u) => u.isValid).length;
  const invalidCount = parsedUsers.filter((u) => !u.isValid).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Bulk Invite Members
        </CardTitle>
        <CardDescription>
          Add multiple team members at once {organizationName && `to ${organizationName}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Input Mode Toggle */}
        <div className="flex gap-2">
          <Button
            variant={inputMode === "paste" ? "default" : "outline"}
            size="sm"
            onClick={() => setInputMode("paste")}
          >
            <FileText className="h-4 w-4 mr-2" />
            Paste Emails
          </Button>
          <Button
            variant={inputMode === "csv" ? "default" : "outline"}
            size="sm"
            onClick={() => setInputMode("csv")}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload CSV
          </Button>
        </div>

        {/* Input Area */}
        {inputMode === "paste" ? (
          <div className="space-y-2">
            <Label>Email Addresses</Label>
            <Textarea
              placeholder={`Enter emails (one per line or comma-separated):
john@example.com
Jane Doe <jane@example.com>
bob@example.com`}
              value={emailInput}
              onChange={(e) => handleInputChange(e.target.value)}
              rows={6}
              className="font-mono text-sm"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Upload CSV File</Label>
            <Input
              type="file"
              accept=".csv,.txt"
              onChange={handleCSVUpload}
            />
            <p className="text-xs text-muted-foreground">
              CSV should have columns: email, name (optional). First row can be headers.
            </p>
          </div>
        )}

        {/* Default Role */}
        <div className="space-y-2">
          <Label>Default Role</Label>
          <Select value={defaultRole} onValueChange={setDefaultRole}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            This role will be assigned to all invited users
          </p>
        </div>

        {/* Parsed Preview */}
        {parsedUsers.length > 0 && !results && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="default">{validCount} valid</Badge>
              {invalidCount > 0 && (
                <Badge variant="destructive">{invalidCount} invalid</Badge>
              )}
            </div>
            
            <div className="max-h-[200px] overflow-y-auto border rounded-md">
              <div className="divide-y">
                {parsedUsers.slice(0, 50).map((user, i) => (
                  <div
                    key={i}
                    className={`px-3 py-2 flex items-center justify-between text-sm ${
                      user.isValid ? "" : "bg-destructive/5"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {user.isValid ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span className="font-medium">{user.full_name}</span>
                      <span className="text-muted-foreground">{user.email}</span>
                    </div>
                    {user.error && (
                      <span className="text-xs text-destructive">{user.error}</span>
                    )}
                  </div>
                ))}
                {parsedUsers.length > 50 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground text-center">
                    + {parsedUsers.length - 50} more
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {results && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="default">
                {results.filter((r) => r.status === "created").length} created
              </Badge>
              <Badge variant="secondary">
                {results.filter((r) => r.status === "existing").length} existing
              </Badge>
              {results.filter((r) => r.status === "failed").length > 0 && (
                <Badge variant="destructive">
                  {results.filter((r) => r.status === "failed").length} failed
                </Badge>
              )}
            </div>
            
            <div className="max-h-[200px] overflow-y-auto border rounded-md">
              <div className="divide-y">
                {results.map((result, i) => (
                  <div
                    key={i}
                    className={`px-3 py-2 flex items-center justify-between text-sm ${
                      result.status === "failed" ? "bg-destructive/5" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {result.status === "created" && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      {result.status === "existing" && (
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                      )}
                      {result.status === "failed" && (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      <span>{result.email}</span>
                    </div>
                    <Badge variant={
                      result.status === "created" ? "default" :
                      result.status === "existing" ? "secondary" : "destructive"
                    }>
                      {result.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        {isProcessing && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-center text-muted-foreground">
              Processing invitations...
            </p>
          </div>
        )}

        {/* Submit Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={validCount === 0 || isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Users className="h-4 w-4 mr-2" />
                Invite {validCount} Member{validCount !== 1 ? "s" : ""}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
