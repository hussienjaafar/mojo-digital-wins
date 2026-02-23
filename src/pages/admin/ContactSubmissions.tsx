import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  Search, 
  MessageSquare, 
  Download,
  Trash2,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Flag,
  Mail,
  RefreshCw,
  ArrowLeft,
  Settings,
  Plus,
  X,
} from "lucide-react";
import { logger } from "@/lib/logger";

// Admin V3 components
import { AdminDetailShell } from "@/components/admin/AdminDetailShell";
import { AdminPageHeader } from "@/components/admin/v3/AdminPageHeader";
import { AdminStatsGrid, AdminStatItem } from "@/components/admin/v3/AdminStatsGrid";
import { PortalFormInput, PortalFormSelect } from "@/components/admin/forms";
import { V3Button } from "@/components/v3/V3Button";
import { V3Badge } from "@/components/v3/V3Badge";
import { V3DataTable, V3Column } from "@/components/v3/V3DataTable";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type SubmissionWithDetails = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  campaign: string | null;
  organization_type: string | null;
  message: string;
  status: string;
  priority: string;
  assigned_to: string | null;
  assigned_to_email: string | null;
  resolved_at: string | null;
  notes_count: number;
};

type SubmissionNote = {
  id: string;
  submission_id: string;
  admin_id: string;
  note: string;
  created_at: string;
  admin_email?: string;
};

type AdminProfile = {
  id: string;
  email: string;
};

type NotificationRecipient = {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
};

const statusOptions = [
  { value: "all", label: "All Status" },
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "archived", label: "Archived" },
];

const priorityOptions = [
  { value: "all", label: "All Priority" },
  { value: "urgent", label: "Urgent" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "new": return "blue" as const;
    case "in_progress": return "amber" as const;
    case "resolved": return "green" as const;
    case "archived": return "muted" as const;
    default: return "muted" as const;
  }
};

const getPriorityBadgeVariant = (priority: string) => {
  switch (priority) {
    case "urgent": return "red" as const;
    case "high": return "amber" as const;
    case "medium": return "blue" as const;
    case "low": return "muted" as const;
    default: return "muted" as const;
  }
};

export default function ContactSubmissions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithDetails | null>(null);
  const [notes, setNotes] = useState<SubmissionNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showMessageDialog, setShowMessageDialog] = useState(false);
  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null);
  
  // Notification recipients state
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [newRecipientEmail, setNewRecipientEmail] = useState("");
  const [isAddingRecipient, setIsAddingRecipient] = useState(false);
  const [showRecipientsSection, setShowRecipientsSection] = useState(false);

  useEffect(() => {
    fetchSubmissions();
    fetchAdmins();
    fetchRecipients();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase.rpc("get_submissions_with_details");
      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load submissions.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (error) throw error;

      const adminIds = data?.map((r) => r.user_id) || [];

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, email")
        .in("id", adminIds);

      if (profileError) throw profileError;
      setAdmins(profiles || []);
    } catch (error) {
      logger.error("Failed to fetch admins", error);
    }
  };

  const fetchRecipients = async () => {
    try {
      const { data, error } = await supabase
        .from("contact_notification_recipients")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setRecipients((data as NotificationRecipient[]) || []);
    } catch (error) {
      logger.error("Failed to fetch recipients", error);
    }
  };

  const addRecipient = async () => {
    const email = newRecipientEmail.trim().toLowerCase();
    if (!email) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }
    setIsAddingRecipient(true);
    try {
      const { error } = await supabase
        .from("contact_notification_recipients")
        .insert({ email, added_by: (await supabase.auth.getSession()).data.session?.user?.id } as any);
      if (error) {
        if (error.code === "23505") {
          toast({ title: "Duplicate", description: "This email is already a recipient.", variant: "destructive" });
        } else {
          throw error;
        }
      } else {
        toast({ title: "Added", description: `${email} will now receive notifications.` });
        setNewRecipientEmail("");
        fetchRecipients();
      }
    } catch (error) {
      logger.error("Failed to add recipient", error);
      toast({ title: "Error", description: "Failed to add recipient.", variant: "destructive" });
    } finally {
      setIsAddingRecipient(false);
    }
  };

  const toggleRecipientActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("contact_notification_recipients")
        .update({ is_active: isActive } as any)
        .eq("id", id);
      if (error) throw error;
      fetchRecipients();
    } catch (error) {
      logger.error("Failed to toggle recipient", error);
      toast({ title: "Error", description: "Failed to update recipient.", variant: "destructive" });
    }
  };

  const removeRecipient = async (id: string) => {
    try {
      const { error } = await supabase
        .from("contact_notification_recipients")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Removed", description: "Recipient removed." });
      fetchRecipients();
    } catch (error) {
      logger.error("Failed to remove recipient", error);
      toast({ title: "Error", description: "Failed to remove recipient.", variant: "destructive" });
    }
  };

  const fetchNotes = async (submissionId: string) => {
    try {
      const { data, error } = await supabase
        .from("submission_notes")
        .select(`*, profiles:admin_id (email)`)
        .eq("submission_id", submissionId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const notesWithEmail = (data || []).map((note) => ({
        ...note,
        admin_email: (note.profiles as any)?.email,
      }));

      setNotes(notesWithEmail);
    } catch (error) {
      logger.error("Failed to fetch notes", error);
      toast({
        title: "Error",
        description: "Failed to load notes.",
        variant: "destructive",
      });
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSubmissions();
    setIsRefreshing(false);
  };

  // Filter submissions
  const filteredSubmissions = useMemo(() => {
    let filtered = [...submissions];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (sub) =>
          sub.name.toLowerCase().includes(lower) ||
          sub.email.toLowerCase().includes(lower) ||
          sub.message.toLowerCase().includes(lower) ||
          (sub.campaign && sub.campaign.toLowerCase().includes(lower))
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((sub) => sub.status === statusFilter);
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter((sub) => sub.priority === priorityFilter);
    }

    return filtered;
  }, [submissions, searchTerm, statusFilter, priorityFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: submissions.length,
    new: submissions.filter((s) => s.status === "new").length,
    inProgress: submissions.filter((s) => s.status === "in_progress").length,
    resolved: submissions.filter((s) => s.status === "resolved").length,
    urgent: submissions.filter((s) => s.priority === "urgent").length,
  }), [submissions]);

  const statItems: AdminStatItem[] = [
    { id: "total", label: "Total Submissions", value: stats.total, icon: MessageSquare, accent: "blue" },
    { id: "new", label: "New", value: stats.new, icon: AlertCircle, accent: "blue" },
    { id: "in_progress", label: "In Progress", value: stats.inProgress, icon: Clock, accent: "amber" },
    { id: "resolved", label: "Resolved", value: stats.resolved, icon: CheckCircle2, accent: "green" },
    { id: "urgent", label: "Urgent", value: stats.urgent, icon: Flag, accent: "red" },
  ];

  // CRUD operations
  const updateSubmissionField = async (submissionId: string, field: string, value: string | null) => {
    try {
      const { error } = await supabase
        .from("contact_submissions")
        .update({ [field]: value })
        .eq("id", submissionId);

      if (error) throw error;

      await supabase.rpc("log_admin_action", {
        _action_type: `update_submission_${field}`,
        _table_affected: "contact_submissions",
        _record_id: submissionId,
        _new_value: { [field]: value },
      });

      toast({ title: "Updated", description: `Submission ${field} updated successfully.` });
      fetchSubmissions();
    } catch (error) {
      logger.error(`Failed to update ${field}`, error);
      toast({ title: "Error", description: `Failed to update ${field}.`, variant: "destructive" });
    }
  };

  const addNote = async () => {
    if (!selectedSubmission || !newNote.trim()) return;

    try {
      const { data: session } = await supabase.auth.getSession();

      const { error } = await supabase.from("submission_notes").insert({
        submission_id: selectedSubmission.id,
        admin_id: session.session?.user?.id,
        note: newNote.trim(),
      });

      if (error) throw error;

      toast({ title: "Note added", description: "Internal note added successfully." });
      setNewNote("");
      fetchNotes(selectedSubmission.id);
    } catch (error) {
      logger.error("Failed to add note", error);
      toast({ title: "Error", description: "Failed to add note.", variant: "destructive" });
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase.from("submission_notes").delete().eq("id", noteId);
      if (error) throw error;
      toast({ title: "Note deleted", description: "Internal note deleted successfully." });
      if (selectedSubmission) fetchNotes(selectedSubmission.id);
    } catch (error) {
      logger.error("Failed to delete note", error);
      toast({ title: "Error", description: "Failed to delete note.", variant: "destructive" });
    }
  };

  const deleteSubmission = async (id: string) => {
    try {
      const { error } = await supabase.from("contact_submissions").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Submission deleted successfully." });
      fetchSubmissions();
    } catch (error) {
      logger.error("Failed to delete submission", error);
      toast({ title: "Error", description: "Failed to delete submission.", variant: "destructive" });
    }
  };

  // Selection
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedSubmissions);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedSubmissions(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedSubmissions.size === filteredSubmissions.length) {
      setSelectedSubmissions(new Set());
    } else {
      setSelectedSubmissions(new Set(filteredSubmissions.map((s) => s.id)));
    }
  };

  // Bulk operations
  const bulkUpdateStatus = async (status: string) => {
    if (selectedSubmissions.size === 0) return;

    try {
      const { error } = await supabase
        .from("contact_submissions")
        .update({ status })
        .in("id", Array.from(selectedSubmissions));

      if (error) throw error;

      await supabase.rpc("log_admin_action", {
        _action_type: "bulk_update_status",
        _table_affected: "contact_submissions",
        _new_value: { status, count: selectedSubmissions.size },
      });

      toast({
        title: "Bulk update successful",
        description: `${selectedSubmissions.size} submissions updated to ${status}.`,
      });

      setSelectedSubmissions(new Set());
      fetchSubmissions();
    } catch (error) {
      logger.error("Failed to bulk update", error);
      toast({ title: "Error", description: "Failed to bulk update submissions.", variant: "destructive" });
    }
  };

  const bulkDelete = async () => {
    if (selectedSubmissions.size === 0) return;

    try {
      const { error } = await supabase
        .from("contact_submissions")
        .delete()
        .in("id", Array.from(selectedSubmissions));

      if (error) throw error;

      await supabase.rpc("log_admin_action", {
        _action_type: "bulk_delete",
        _table_affected: "contact_submissions",
        _new_value: { count: selectedSubmissions.size },
      });

      toast({
        title: "Bulk delete successful",
        description: `${selectedSubmissions.size} submissions deleted.`,
      });

      setSelectedSubmissions(new Set());
      setShowBulkDeleteDialog(false);
      fetchSubmissions();
    } catch (error) {
      logger.error("Failed to bulk delete", error);
      toast({ title: "Error", description: "Failed to bulk delete submissions.", variant: "destructive" });
    }
  };

  const exportToCSV = () => {
    const headers = ["Name", "Email", "Campaign", "Message", "Status", "Priority", "Assigned To", "Created At"];
    const csvData = filteredSubmissions.map((sub) => [
      sub.name,
      sub.email,
      sub.campaign || "",
      sub.message,
      sub.status,
      sub.priority,
      sub.assigned_to_email || "Unassigned",
      format(new Date(sub.created_at), "yyyy-MM-dd HH:mm:ss"),
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contact-submissions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  // V3DataTable columns
  const columns: V3Column<SubmissionWithDetails>[] = [
    {
      key: "select",
      header: "",
      width: "48px",
      render: (row) => (
        <Checkbox
          checked={selectedSubmissions.has(row.id)}
          onCheckedChange={() => toggleSelection(row.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
    },
    {
      key: "contact",
      header: "Contact",
      primary: true,
      sortable: true,
      sortFn: (a, b) => a.name.localeCompare(b.name),
      render: (row) => (
        <div>
          <p className="font-medium text-[hsl(var(--portal-text-primary))]">{row.name}</p>
          <p className="text-sm text-[hsl(var(--portal-text-muted))]">{row.email}</p>
        </div>
      ),
    },
    {
      key: "message",
      header: "Message",
      hideOnMobile: true,
      render: (row) => (
        <p className="truncate max-w-[200px] text-[hsl(var(--portal-text-secondary))]">{row.message}</p>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortFn: (a, b) => a.status.localeCompare(b.status),
      render: (row) => (
        <Select
          value={row.status}
          onValueChange={(value) => updateSubmissionField(row.id, "status", value)}
        >
          <SelectTrigger
            className="w-[120px] h-8 border-[hsl(var(--portal-border))] bg-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <SelectValue>
              <V3Badge variant={getStatusBadgeVariant(row.status)}>
                {row.status.replace("_", " ")}
              </V3Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      hideOnMobile: true,
      sortable: true,
      sortFn: (a, b) => {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority as keyof typeof order] ?? 4) - (order[b.priority as keyof typeof order] ?? 4);
      },
      render: (row) => (
        <Select
          value={row.priority}
          onValueChange={(value) => updateSubmissionField(row.id, "priority", value)}
        >
          <SelectTrigger
            className="w-[100px] h-8 border-[hsl(var(--portal-border))] bg-transparent"
            onClick={(e) => e.stopPropagation()}
          >
            <SelectValue>
              <V3Badge variant={getPriorityBadgeVariant(row.priority)}>{row.priority}</V3Badge>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgent">Urgent</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "assigned",
      header: "Assigned",
      hideOnMobile: true,
      render: (row) => (
        <Select
          value={row.assigned_to || "unassigned"}
          onValueChange={(value) =>
            updateSubmissionField(row.id, "assigned_to", value === "unassigned" ? null : value)
          }
        >
          <SelectTrigger
            className="w-[140px] h-8 border-[hsl(var(--portal-border))] bg-transparent text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <SelectValue>
              <span className="truncate text-[hsl(var(--portal-text-secondary))]">
                {row.assigned_to_email || "Unassigned"}
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {admins.map((admin) => (
              <SelectItem key={admin.id} value={admin.id}>
                {admin.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ),
    },
    {
      key: "notes",
      header: "Notes",
      hideOnMobile: true,
      width: "80px",
      render: (row) => (
        <V3Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSubmission(row);
            fetchNotes(row.id);
            setShowNotesDialog(true);
          }}
        >
          <Eye className="h-4 w-4 mr-1" />
          {row.notes_count}
        </V3Button>
      ),
    },
    {
      key: "date",
      header: "Date",
      hideOnMobile: true,
      sortable: true,
      sortFn: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      render: (row) => (
        <span className="text-sm text-[hsl(var(--portal-text-muted))]">
          {format(new Date(row.created_at), "MMM dd, yyyy")}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      render: (row) => (
        <V3Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setSubmissionToDelete(row.id);
            setShowDeleteDialog(true);
          }}
        >
          <Trash2 className="h-4 w-4 text-[hsl(var(--portal-error))]" />
        </V3Button>
      ),
    },
  ];

  return (
    <AdminDetailShell>
      <div className="space-y-6">
        {/* Back button */}
        <V3Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin?tab=analytics")}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Admin
        </V3Button>

        {/* Page Header */}
        <AdminPageHeader
          title="Contact Submissions"
          description="Manage contact form submissions with status tracking and assignments"
          icon={Mail}
          iconColor="blue"
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          actions={
            <V3Button variant="secondary" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </V3Button>
          }
        />

        {/* Stats Grid */}
        <AdminStatsGrid items={statItems} isLoading={isLoading} columns={4} />

        {/* Notification Recipients */}
        <Collapsible open={showRecipientsSection} onOpenChange={setShowRecipientsSection}>
          <div className="portal-card p-4">
            <CollapsibleTrigger asChild>
              <button className="flex items-center gap-2 w-full text-left">
                <Settings className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                  Notification Recipients
                </span>
                <span className="text-xs text-[hsl(var(--portal-text-muted))] ml-1">
                  ({recipients.filter(r => r.is_active).length} active)
                </span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4 space-y-3">
              {/* Add recipient */}
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="email@example.com"
                  value={newRecipientEmail}
                  onChange={(e) => setNewRecipientEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRecipient()}
                  className="flex-1"
                />
                <V3Button size="sm" onClick={addRecipient} disabled={isAddingRecipient || !newRecipientEmail.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </V3Button>
              </div>

              {/* Recipient list */}
              {recipients.length === 0 ? (
                <p className="text-sm text-[hsl(var(--portal-text-muted))] py-2">
                  No recipients configured. Notifications will use the default environment variable.
                </p>
              ) : (
                <div className="space-y-2">
                  {recipients.map((recipient) => (
                    <div
                      key={recipient.id}
                      className="flex items-center justify-between gap-3 py-2 px-3 rounded-md bg-[hsl(var(--portal-bg-secondary))]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Switch
                          checked={recipient.is_active}
                          onCheckedChange={(checked) => toggleRecipientActive(recipient.id, checked)}
                        />
                        <span className={`text-sm truncate ${recipient.is_active ? "text-[hsl(var(--portal-text-primary))]" : "text-[hsl(var(--portal-text-muted))] line-through"}`}>
                          {recipient.email}
                        </span>
                      </div>
                      <V3Button variant="ghost" size="sm" onClick={() => removeRecipient(recipient.id)}>
                        <X className="h-4 w-4" />
                      </V3Button>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </div>
        </Collapsible>

        {/* Filter Bar */}
        <div className="portal-card p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
              <PortalFormInput
                placeholder="Search submissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <PortalFormSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={statusOptions}
              placeholder="All Status"
              triggerClassName="w-full sm:w-[160px]"
            />
            <PortalFormSelect
              value={priorityFilter}
              onValueChange={setPriorityFilter}
              options={priorityOptions}
              placeholder="All Priority"
              triggerClassName="w-full sm:w-[160px]"
            />
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedSubmissions.size > 0 && (
          <div className="portal-card p-4 flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
              {selectedSubmissions.size} selected
            </span>
            <V3Button size="sm" variant="secondary" onClick={() => bulkUpdateStatus("in_progress")}>
              Mark In Progress
            </V3Button>
            <V3Button size="sm" variant="secondary" onClick={() => bulkUpdateStatus("resolved")}>
              Mark Resolved
            </V3Button>
            <V3Button size="sm" variant="secondary" onClick={() => bulkUpdateStatus("archived")}>
              Archive
            </V3Button>
            <V3Button size="sm" variant="destructive" onClick={() => setShowBulkDeleteDialog(true)}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </V3Button>
          </div>
        )}

        {/* Data Table */}
        <V3DataTable
          data={filteredSubmissions}
          columns={columns}
          getRowKey={(row) => row.id}
          isLoading={isLoading}
          emptyTitle="No submissions found"
          emptyDescription="There are no contact submissions matching your filters."
          pagination
          pageSize={25}
          defaultSortKey="date"
          defaultSortDirection="desc"
          onRowClick={(row) => {
            setSelectedSubmission(row);
            setShowMessageDialog(true);
          }}
        />
      </div>

      {/* Notes Dialog */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent className="max-w-2xl bg-[hsl(var(--portal-bg-primary))] border-[hsl(var(--portal-border))]">
          <DialogHeader>
            <DialogTitle className="text-[hsl(var(--portal-text-primary))]">Internal Notes</DialogTitle>
            <DialogDescription className="text-[hsl(var(--portal-text-muted))]">
              Add private notes about this submission for other admins
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-4">
              {notes.length === 0 ? (
                <p className="text-sm text-[hsl(var(--portal-text-muted))] text-center py-8">
                  No notes yet. Add one below.
                </p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="portal-card p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
                          {note.admin_email}
                        </p>
                        <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                          {format(new Date(note.created_at), "PPpp")}
                        </p>
                      </div>
                      <V3Button variant="ghost" size="sm" onClick={() => deleteNote(note.id)}>
                        <Trash2 className="h-4 w-4" />
                      </V3Button>
                    </div>
                    <p className="text-sm text-[hsl(var(--portal-text-secondary))]">{note.note}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="space-y-4">
            <div>
              <Label
                htmlFor="note"
                className="text-sm font-medium text-[hsl(var(--portal-text-primary))]"
              >
                Add Note
              </Label>
              <Textarea
                id="note"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Type your note here..."
                rows={3}
                className="mt-2 bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))]"
              />
            </div>
          </div>

          <DialogFooter>
            <V3Button variant="secondary" onClick={() => setShowNotesDialog(false)}>
              Close
            </V3Button>
            <V3Button onClick={addNote} disabled={!newNote.trim()}>
              Add Note
            </V3Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Submission Detail Dialog */}
      <Dialog open={showMessageDialog} onOpenChange={setShowMessageDialog}>
        <DialogContent className="max-w-2xl bg-[hsl(var(--portal-bg-primary))] border-[hsl(var(--portal-border))]">
          <DialogHeader>
            <DialogTitle className="text-[hsl(var(--portal-text-primary))]">Submission Details</DialogTitle>
            <DialogDescription className="text-[hsl(var(--portal-text-muted))]">
              Full submission from {selectedSubmission?.name}
            </DialogDescription>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-4">
              {/* Contact info */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
                <div>
                  <p className="text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wide">Name</p>
                  <p className="text-sm text-[hsl(var(--portal-text-primary))]">{selectedSubmission.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wide">Email</p>
                  <p className="text-sm text-[hsl(var(--portal-text-primary))]">{selectedSubmission.email}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wide">Date</p>
                  <p className="text-sm text-[hsl(var(--portal-text-primary))]">
                    {format(new Date(selectedSubmission.created_at), "PPpp")}
                  </p>
                </div>
              </div>

              {/* Status & Priority */}
              <div className="flex items-center gap-3">
                <V3Badge variant={getStatusBadgeVariant(selectedSubmission.status)}>
                  {selectedSubmission.status.replace("_", " ")}
                </V3Badge>
                <V3Badge variant={getPriorityBadgeVariant(selectedSubmission.priority)}>
                  {selectedSubmission.priority}
                </V3Badge>
              </div>

              {/* Campaign */}
              {selectedSubmission.campaign && (
                <div>
                  <p className="text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wide mb-1">Campaign</p>
                  <p className="text-sm text-[hsl(var(--portal-text-secondary))]">{selectedSubmission.campaign}</p>
                </div>
              )}

              {/* Full message */}
              <div>
                <p className="text-xs font-medium text-[hsl(var(--portal-text-muted))] uppercase tracking-wide mb-1">Message</p>
                <div className="portal-card p-4 rounded-lg">
                  <p className="text-sm text-[hsl(var(--portal-text-primary))] whitespace-pre-wrap break-words">
                    {selectedSubmission.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <V3Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setShowMessageDialog(false);
                if (selectedSubmission) {
                  fetchNotes(selectedSubmission.id);
                  setShowNotesDialog(true);
                }
              }}
            >
              <Eye className="h-4 w-4 mr-1" />
              View Notes ({selectedSubmission?.notes_count ?? 0})
            </V3Button>
            <V3Button variant="secondary" onClick={() => setShowMessageDialog(false)}>
              Close
            </V3Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent className="bg-[hsl(var(--portal-bg-primary))] border-[hsl(var(--portal-border))]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[hsl(var(--portal-text-primary))]">
              Bulk Delete Submissions
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[hsl(var(--portal-text-muted))]">
              Are you sure you want to delete {selectedSubmissions.size} submissions? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[hsl(var(--portal-border))]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete} className="bg-[hsl(var(--portal-error))]">
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Single Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-[hsl(var(--portal-bg-primary))] border-[hsl(var(--portal-border))]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[hsl(var(--portal-text-primary))]">
              Delete Submission
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[hsl(var(--portal-text-muted))]">
              Are you sure you want to delete this submission? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[hsl(var(--portal-border))]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (submissionToDelete) {
                  deleteSubmission(submissionToDelete);
                  setSubmissionToDelete(null);
                  setShowDeleteDialog(false);
                }
              }}
              className="bg-[hsl(var(--portal-error))]"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminDetailShell>
  );
}
