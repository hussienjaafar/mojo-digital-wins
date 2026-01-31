import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { 
  Upload, 
  Users, 
  Copy, 
  FileText, 
  AlertCircle, 
  CheckCircle,
  Loader2,
  Download
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

interface ParsedUser {
  email: string;
  full_name: string;
  role: string;
  valid: boolean;
  error?: string;
}

export function BulkOperations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  
  // CSV Import state
  const [csvContent, setCsvContent] = useState("");
  const [parsedUsers, setParsedUsers] = useState<ParsedUser[]>([]);
  
  // Bulk Invite state
  const [bulkEmails, setBulkEmails] = useState("");
  const [defaultRole, setDefaultRole] = useState("viewer");
  
  // Clone Config state
  const [sourceOrg, setSourceOrg] = useState<string>("");
  const [targetOrg, setTargetOrg] = useState<string>("");
  const [cloneOptions, setCloneOptions] = useState({
    watchlists: true,
    alertThresholds: true,
    orgProfile: true,
    integrationMeta: false,
  });

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    const { data } = await supabase
      .from("client_organizations")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    
    if (data) setOrganizations(data);
  };

  // CSV Parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvContent(content);
      parseCSV(content);
    };
    reader.readAsText(file);
  };

  const parseCSV = (content: string) => {
    const lines = content.trim().split("\n");
    const users: ParsedUser[] = [];
    
    // Skip header if present
    const startIndex = lines[0]?.toLowerCase().includes("email") ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(",").map(p => p.trim().replace(/^"|"$/g, ""));
      const [email, full_name = "", role = "viewer"] = parts;
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const validRoles = ["admin", "manager", "viewer"];
      
      const isEmailValid = emailRegex.test(email);
      const isRoleValid = validRoles.includes(role.toLowerCase());
      
      users.push({
        email,
        full_name,
        role: role.toLowerCase(),
        valid: isEmailValid && isRoleValid,
        error: !isEmailValid ? "Invalid email" : !isRoleValid ? "Invalid role" : undefined,
      });
    }
    
    setParsedUsers(users);
  };

  const handleCSVImport = async () => {
    if (!selectedOrg) {
      toast.error("Please select an organization");
      return;
    }
    
    const validUsers = parsedUsers.filter(u => u.valid);
    if (validUsers.length === 0) {
      toast.error("No valid users to import");
      return;
    }
    
    setIsLoading(true);
    let successCount = 0;
    let errorCount = 0;
    
    for (const user of validUsers) {
      try {
        const { error } = await supabase.functions.invoke("create-client-user", {
          body: {
            organization_id: selectedOrg,
            email: user.email,
            full_name: user.full_name,
            role: user.role,
          },
        });
        
        if (error) throw error;
        successCount++;
      } catch (error) {
        console.error("Failed to create user:", user.email, error);
        errorCount++;
      }
    }
    
    // Log audit action
    await supabase.rpc("log_admin_action", {
      _action_type: "bulk_import_users",
      _table_affected: "client_users",
      _new_value: { 
        organization_id: selectedOrg, 
        total: validUsers.length,
        success: successCount,
        failed: errorCount 
      },
    });
    
    toast.success(`Imported ${successCount} users${errorCount > 0 ? `, ${errorCount} failed` : ""}`);
    setParsedUsers([]);
    setCsvContent("");
    setIsLoading(false);
  };

  // Bulk Invite
  const handleBulkInvite = async () => {
    if (!selectedOrg) {
      toast.error("Please select an organization");
      return;
    }
    
    const emails = bulkEmails
      .split(/[\n,;]/)
      .map(e => e.trim())
      .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    
    if (emails.length === 0) {
      toast.error("No valid emails found");
      return;
    }
    
    setIsLoading(true);
    let successCount = 0;
    
    for (const email of emails) {
      try {
        const { error } = await supabase.functions.invoke("create-client-user", {
          body: {
            organization_id: selectedOrg,
            email,
            full_name: "",
            role: defaultRole,
          },
        });
        
        if (!error) successCount++;
      } catch (error) {
        console.error("Failed to invite:", email, error);
      }
    }
    
    await supabase.rpc("log_admin_action", {
      _action_type: "bulk_invite_users",
      _table_affected: "client_users",
      _new_value: { 
        organization_id: selectedOrg, 
        emails_count: emails.length,
        success: successCount 
      },
    });
    
    toast.success(`Sent ${successCount} invitations`);
    setBulkEmails("");
    setIsLoading(false);
  };

  // Clone Configuration
  const handleCloneConfig = async () => {
    if (!sourceOrg || !targetOrg) {
      toast.error("Please select both source and target organizations");
      return;
    }
    
    if (sourceOrg === targetOrg) {
      toast.error("Source and target must be different");
      return;
    }
    
    setIsLoading(true);
    const clonedItems: string[] = [];
    
    try {
      // Clone watchlists
      if (cloneOptions.watchlists) {
        const { data: watchlists } = await supabase
          .from("entity_watchlist")
          .select("entity_name, entity_type, is_active, alert_threshold, sentiment_alert, aliases")
          .eq("organization_id", sourceOrg);
        
        if (watchlists && watchlists.length > 0) {
          const newWatchlists = watchlists.map(w => ({
            entity_name: w.entity_name,
            entity_type: w.entity_type,
            is_active: w.is_active,
            alert_threshold: w.alert_threshold,
            sentiment_alert: w.sentiment_alert,
            aliases: w.aliases,
            organization_id: targetOrg,
          }));
          
          await supabase.from("entity_watchlist").insert(newWatchlists);
          clonedItems.push(`${watchlists.length} watchlist entities`);
        }
      }
      
      // Clone org profile
      if (cloneOptions.orgProfile) {
        const { data: profile } = await supabase
          .from("organization_profiles")
          .select("mission_summary, focus_areas, interest_topics, key_issues, geographies, sensitivity_redlines")
          .eq("organization_id", sourceOrg)
          .single();
        
        if (profile) {
          await supabase.from("organization_profiles").upsert({
            organization_id: targetOrg,
            ...profile,
          });
          clonedItems.push("organization profile");
        }
      }
      
      // Log audit action
      await supabase.rpc("log_admin_action", {
        _action_type: "clone_configuration",
        _table_affected: "multiple",
        _new_value: {
          source_org: sourceOrg,
          target_org: targetOrg,
          options: cloneOptions,
          cloned: clonedItems,
        },
      });
      
      toast.success(`Cloned: ${clonedItems.join(", ")}`);
    } catch (error) {
      console.error("Clone failed:", error);
      toast.error("Failed to clone configuration");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadTemplate = () => {
    const template = "email,full_name,role\njohn@example.com,John Doe,viewer\njane@example.com,Jane Smith,manager";
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user-import-template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Bulk Operations</h2>
        <p className="text-muted-foreground">
          Import users, send bulk invites, and clone configurations
        </p>
      </div>

      {/* Organization Selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Target Organization</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger className="w-full max-w-sm">
              <SelectValue placeholder="Select organization..." />
            </SelectTrigger>
            <SelectContent>
              {organizations.map(org => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs defaultValue="csv-import" className="space-y-4">
        <TabsList>
          <TabsTrigger value="csv-import" className="gap-2">
            <Upload className="h-4 w-4" />
            CSV Import
          </TabsTrigger>
          <TabsTrigger value="bulk-invite" className="gap-2">
            <Users className="h-4 w-4" />
            Bulk Invite
          </TabsTrigger>
          <TabsTrigger value="clone-config" className="gap-2">
            <Copy className="h-4 w-4" />
            Clone Config
          </TabsTrigger>
        </TabsList>

        {/* CSV Import Tab */}
        <TabsContent value="csv-import">
          <Card>
            <CardHeader>
              <CardTitle>Import Users from CSV</CardTitle>
              <CardDescription>
                Upload a CSV file with columns: email, full_name, role (admin/manager/viewer)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label htmlFor="csv-file">CSV File</Label>
                  <Input
                    id="csv-file"
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="mt-1"
                  />
                </div>
                <Button variant="outline" onClick={downloadTemplate} className="mt-6">
                  <Download className="h-4 w-4 mr-2" />
                  Template
                </Button>
              </div>

              {parsedUsers.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {parsedUsers.filter(u => u.valid).length} valid
                    </Badge>
                    {parsedUsers.filter(u => !u.valid).length > 0 && (
                      <Badge variant="destructive">
                        {parsedUsers.filter(u => !u.valid).length} invalid
                      </Badge>
                    )}
                  </div>

                  <div className="rounded-md border max-h-64 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Status</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Role</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {parsedUsers.slice(0, 20).map((user, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              {user.valid ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{user.email}</TableCell>
                            <TableCell>{user.full_name || "-"}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{user.role}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {parsedUsers.length > 20 && (
                    <p className="text-sm text-muted-foreground">
                      Showing first 20 of {parsedUsers.length} users
                    </p>
                  )}

                  <Button 
                    onClick={handleCSVImport} 
                    disabled={isLoading || !selectedOrg}
                    className="w-full"
                  >
                    {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Import {parsedUsers.filter(u => u.valid).length} Users
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bulk Invite Tab */}
        <TabsContent value="bulk-invite">
          <Card>
            <CardHeader>
              <CardTitle>Bulk Invite Users</CardTitle>
              <CardDescription>
                Paste email addresses separated by commas, semicolons, or new lines
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="default-role">Default Role</Label>
                <Select value={defaultRole} onValueChange={setDefaultRole}>
                  <SelectTrigger className="w-full max-w-sm mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="bulk-emails">Email Addresses</Label>
                <Textarea
                  id="bulk-emails"
                  placeholder="john@example.com, jane@example.com&#10;bob@example.com"
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  className="mt-1 min-h-[150px] font-mono"
                />
              </div>

              <Button 
                onClick={handleBulkInvite} 
                disabled={isLoading || !selectedOrg || !bulkEmails.trim()}
                className="w-full"
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Invitations
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Clone Config Tab */}
        <TabsContent value="clone-config">
          <Card>
            <CardHeader>
              <CardTitle>Clone Configuration</CardTitle>
              <CardDescription>
                Copy watchlists, profiles, and settings from one organization to another
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Source Organization</Label>
                  <Select value={sourceOrg} onValueChange={setSourceOrg}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Copy from..." />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Target Organization</Label>
                  <Select value={targetOrg} onValueChange={setTargetOrg}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Copy to..." />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map(org => (
                        <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>What to Clone</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[
                    { key: "watchlists", label: "Watchlist Entities" },
                    { key: "alertThresholds", label: "Alert Thresholds" },
                    { key: "orgProfile", label: "Organization Profile" },
                    { key: "integrationMeta", label: "Integration Metadata (not secrets)" },
                  ].map(option => (
                    <label key={option.key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cloneOptions[option.key as keyof typeof cloneOptions]}
                        onChange={(e) => setCloneOptions(prev => ({
                          ...prev,
                          [option.key]: e.target.checked,
                        }))}
                        className="rounded border-input"
                      />
                      <span className="text-sm">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button 
                onClick={handleCloneConfig} 
                disabled={isLoading || !sourceOrg || !targetOrg}
                className="w-full"
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Clone Configuration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
