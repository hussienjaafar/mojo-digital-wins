import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Plus, Trash2, Send, Clock, CheckCircle, XCircle, Settings } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import ReportCustomizationDialog from "./ReportCustomizationDialog";

type Organization = {
  id: string;
  name: string;
};

type Schedule = {
  id: string;
  organization_id: string;
  organization?: { name: string };
  recipient_emails: string[];
  frequency: string;
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  is_active: boolean;
  last_sent_at: string | null;
  created_at: string;
};

type ReportLog = {
  id: string;
  schedule_id: string;
  recipients: string[];
  status: string;
  error_message: string | null;
  sent_at: string;
};

const EmailReportManager = () => {
  const { toast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<ReportLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [customizeScheduleId, setCustomizeScheduleId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    organization_id: "",
    recipient_emails: "",
    frequency: "weekly",
    day_of_week: 1,
    day_of_month: 1,
    time_of_day: "09:00",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [orgsRes, schedulesRes, logsRes] = await Promise.all([
        (supabase as any).from("client_organizations").select("id, name").order("name"),
        (supabase as any)
          .from("email_report_schedules")
          .select("*, organization:client_organizations(name)")
          .order("created_at", { ascending: false }),
        (supabase as any)
          .from("email_report_logs")
          .select("*")
          .order("sent_at", { ascending: false })
          .limit(50),
      ]);

      if (orgsRes.error) throw orgsRes.error;
      if (schedulesRes.error) throw schedulesRes.error;
      if (logsRes.error) throw logsRes.error;

      setOrganizations(orgsRes.data || []);
      setSchedules(schedulesRes.data || []);
      setLogs(logsRes.data || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    const emails = formData.recipient_emails
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e);

    if (emails.length === 0) {
      toast({
        title: "Error",
        description: "Please enter at least one recipient email",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await (supabase as any).from("email_report_schedules").insert([
        {
          organization_id: formData.organization_id,
          recipient_emails: emails,
          frequency: formData.frequency,
          day_of_week: formData.frequency === "weekly" ? formData.day_of_week : null,
          day_of_month: formData.frequency === "monthly" ? formData.day_of_month : null,
          time_of_day: formData.time_of_day,
        },
      ]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Report schedule created successfully",
      });

      setShowCreateDialog(false);
      setFormData({
        organization_id: "",
        recipient_emails: "",
        frequency: "weekly",
        day_of_week: 1,
        day_of_month: 1,
        time_of_day: "09:00",
      });
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create schedule",
        variant: "destructive",
      });
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("email_report_schedules")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Schedule ${!currentStatus ? "activated" : "deactivated"}`,
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update schedule",
        variant: "destructive",
      });
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from("email_report_schedules")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Schedule deleted successfully",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete schedule",
        variant: "destructive",
      });
    }
  };

  const sendTestReport = async (schedule: Schedule) => {
    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-email-report", {
        body: {
          scheduleId: schedule.id,
          organizationId: schedule.organization_id,
          recipients: schedule.recipient_emails,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Test report sent successfully",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to send test report",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Report Schedules
              </CardTitle>
              <CardDescription>Configure automated email reports for clients</CardDescription>
            </div>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Schedule
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create Report Schedule</DialogTitle>
                  <DialogDescription>Set up a new automated email report</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="org">Organization</Label>
                    <Select
                      value={formData.organization_id}
                      onValueChange={(value) => setFormData({ ...formData, organization_id: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select organization" />
                      </SelectTrigger>
                      <SelectContent>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={org.id}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="emails">Recipient Emails (comma-separated)</Label>
                    <Input
                      id="emails"
                      value={formData.recipient_emails}
                      onChange={(e) => setFormData({ ...formData, recipient_emails: e.target.value })}
                      placeholder="email1@example.com, email2@example.com"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="frequency">Frequency</Label>
                    <Select
                      value={formData.frequency}
                      onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.frequency === "weekly" && (
                    <div className="space-y-2">
                      <Label htmlFor="day_of_week">Day of Week</Label>
                      <Select
                        value={formData.day_of_week.toString()}
                        onValueChange={(value) => setFormData({ ...formData, day_of_week: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Sunday</SelectItem>
                          <SelectItem value="1">Monday</SelectItem>
                          <SelectItem value="2">Tuesday</SelectItem>
                          <SelectItem value="3">Wednesday</SelectItem>
                          <SelectItem value="4">Thursday</SelectItem>
                          <SelectItem value="5">Friday</SelectItem>
                          <SelectItem value="6">Saturday</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {formData.frequency === "monthly" && (
                    <div className="space-y-2">
                      <Label htmlFor="day_of_month">Day of Month</Label>
                      <Input
                        id="day_of_month"
                        type="number"
                        min="1"
                        max="31"
                        value={formData.day_of_month}
                        onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) })}
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="time">Time of Day</Label>
                    <Input
                      id="time"
                      type="time"
                      value={formData.time_of_day}
                      onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
                      required
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Create Schedule
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Last Sent</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No schedules configured
                    </TableCell>
                  </TableRow>
                ) : (
                  schedules.map((schedule) => (
                    <TableRow key={schedule.id}>
                      <TableCell className="font-medium">
                        {schedule.organization?.name || "Unknown"}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-muted-foreground">
                          {schedule.recipient_emails.slice(0, 2).join(", ")}
                          {schedule.recipient_emails.length > 2 && ` +${schedule.recipient_emails.length - 2}`}
                        </div>
                      </TableCell>
                      <TableCell className="capitalize">{schedule.frequency}</TableCell>
                      <TableCell>
                        {schedule.frequency === "weekly" && schedule.day_of_week !== null ? (
                          <span>
                            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][schedule.day_of_week]} at{" "}
                            {schedule.time_of_day}
                          </span>
                        ) : schedule.frequency === "monthly" && schedule.day_of_month !== null ? (
                          <span>
                            Day {schedule.day_of_month} at {schedule.time_of_day}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {schedule.last_sent_at ? (
                          <span className="text-sm">
                            {new Date(schedule.last_sent_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={schedule.is_active ? "default" : "secondary"}>
                          {schedule.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCustomizeScheduleId(schedule.id)}
                          >
                            <Settings className="h-4 w-4 mr-2" />
                            Customize
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendTestReport(schedule)}
                            disabled={isSending}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Test
                          </Button>
                          <Switch
                            checked={schedule.is_active}
                            onCheckedChange={() => toggleActive(schedule.id, schedule.is_active)}
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteSchedule(schedule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Report Logs
          </CardTitle>
          <CardDescription>Last 50 report deliveries</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent At</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No reports sent yet
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.sent_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.recipients.slice(0, 2).join(", ")}
                        {log.recipients.length > 2 && ` +${log.recipients.length - 2}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.status === "sent" ? "default" : "destructive"}>
                          {log.status === "sent" ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <XCircle className="h-3 w-3 mr-1" />
                          )}
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {log.error_message || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ReportCustomizationDialog
        scheduleId={customizeScheduleId}
        open={customizeScheduleId !== null}
        onOpenChange={(open) => !open && setCustomizeScheduleId(null)}
        onSave={loadData}
      />
    </div>
  );
};

export default EmailReportManager;
