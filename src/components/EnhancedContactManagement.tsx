import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/fixed-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, 
  MessageSquare, 
  Download,
  Trash2,
  Eye,
  Archive,
  CheckCircle2,
  AlertCircle,
  Flag
} from "lucide-react";
import { format } from "date-fns";
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
  DialogTrigger,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

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

export const EnhancedContactManagement = () => {
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<string>>(new Set());
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithDetails | null>(null);
  const [notes, setNotes] = useState<SubmissionNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showNotesDialog, setShowNotesDialog] = useState(false);

  useEffect(() => {
    fetchSubmissions();
    fetchAdmins();
  }, []);

  useEffect(() => {
    filterSubmissions();
  }, [searchTerm, statusFilter, priorityFilter, submissions]);

  const fetchSubmissions = async () => {
    try {
      const { data, error } = await supabase.rpc('get_submissions_with_details');

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
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
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (error) throw error;

      const adminIds = data?.map(r => r.user_id) || [];
      
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', adminIds);

      if (profileError) throw profileError;
      setAdmins(profiles || []);
    } catch (error) {
      console.error('Error fetching admins:', error);
    }
  };

  const fetchNotes = async (submissionId: string) => {
    try {
      const { data, error } = await supabase
        .from('submission_notes')
        .select(`
          *,
          profiles:admin_id (email)
        `)
        .eq('submission_id', submissionId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const notesWithEmail = (data || []).map(note => ({
        ...note,
        admin_email: (note.profiles as any)?.email
      }));
      
      setNotes(notesWithEmail);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast({
        title: "Error",
        description: "Failed to load notes.",
        variant: "destructive",
      });
    }
  };

  const filterSubmissions = () => {
    let filtered = [...submissions];

    if (searchTerm) {
      filtered = filtered.filter(sub => 
        sub.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        sub.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (sub.campaign && sub.campaign.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter(sub => sub.status === statusFilter);
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter(sub => sub.priority === priorityFilter);
    }

    setFilteredSubmissions(filtered);
  };

  const updateSubmissionField = async (
    submissionId: string, 
    field: string, 
    value: string | null
  ) => {
    try {
      const { error } = await supabase
        .from('contact_submissions')
        .update({ [field]: value })
        .eq('id', submissionId);

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        _action_type: `update_submission_${field}`,
        _table_affected: 'contact_submissions',
        _record_id: submissionId,
        _new_value: { [field]: value },
      });

      toast({
        title: "Updated",
        description: `Submission ${field} updated successfully.`,
      });

      fetchSubmissions();
    } catch (error) {
      console.error(`Error updating ${field}:`, error);
      toast({
        title: "Error",
        description: `Failed to update ${field}.`,
        variant: "destructive",
      });
    }
  };

  const addNote = async () => {
    if (!selectedSubmission || !newNote.trim()) return;

    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from('submission_notes')
        .insert({
          submission_id: selectedSubmission.id,
          admin_id: session.session?.user?.id,
          note: newNote.trim(),
        });

      if (error) throw error;

      toast({
        title: "Note added",
        description: "Internal note added successfully.",
      });

      setNewNote("");
      fetchNotes(selectedSubmission.id);
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: "Error",
        description: "Failed to add note.",
        variant: "destructive",
      });
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('submission_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      toast({
        title: "Note deleted",
        description: "Internal note deleted successfully.",
      });

      if (selectedSubmission) {
        fetchNotes(selectedSubmission.id);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: "Error",
        description: "Failed to delete note.",
        variant: "destructive",
      });
    }
  };

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
      setSelectedSubmissions(new Set(filteredSubmissions.map(s => s.id)));
    }
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedSubmissions.size === 0) return;

    try {
      const { error } = await supabase
        .from('contact_submissions')
        .update({ status })
        .in('id', Array.from(selectedSubmissions));

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        _action_type: 'bulk_update_status',
        _table_affected: 'contact_submissions',
        _new_value: { status, count: selectedSubmissions.size },
      });

      toast({
        title: "Bulk update successful",
        description: `${selectedSubmissions.size} submissions updated to ${status}.`,
      });

      setSelectedSubmissions(new Set());
      fetchSubmissions();
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast({
        title: "Error",
        description: "Failed to bulk update submissions.",
        variant: "destructive",
      });
    }
  };

  const bulkDelete = async () => {
    if (selectedSubmissions.size === 0) return;

    try {
      const { error } = await supabase
        .from('contact_submissions')
        .delete()
        .in('id', Array.from(selectedSubmissions));

      if (error) throw error;

      await supabase.rpc('log_admin_action', {
        _action_type: 'bulk_delete',
        _table_affected: 'contact_submissions',
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
      console.error('Error bulk deleting:', error);
      toast({
        title: "Error",
        description: "Failed to bulk delete submissions.",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Campaign', 'Message', 'Status', 'Priority', 'Assigned To', 'Created At'];
    const csvData = filteredSubmissions.map(sub => [
      sub.name,
      sub.email,
      sub.campaign || '',
      sub.message,
      sub.status,
      sub.priority,
      sub.assigned_to_email || 'Unassigned',
      format(new Date(sub.created_at), 'yyyy-MM-dd HH:mm:ss'),
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `contact-submissions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'new': return 'default';
      case 'in_progress': return 'secondary';
      case 'resolved': return 'outline';
      case 'archived': return 'outline';
      default: return 'default';
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Contact Management</CardTitle>
          <CardDescription>Loading submissions...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const stats = {
    total: submissions.length,
    new: submissions.filter(s => s.status === 'new').length,
    inProgress: submissions.filter(s => s.status === 'in_progress').length,
    resolved: submissions.filter(s => s.status === 'resolved').length,
    urgent: submissions.filter(s => s.priority === 'urgent').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.new}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <MessageSquare className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.resolved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Urgent</CardTitle>
            <Flag className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.urgent}</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Submissions</CardTitle>
          <CardDescription>
            Manage contact form submissions with status tracking and assignments
          </CardDescription>
          
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search submissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter by priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedSubmissions.size > 0 && (
            <div className="flex gap-2 mt-4 p-4 bg-muted rounded-lg">
              <span className="text-sm font-medium self-center">
                {selectedSubmissions.size} selected
              </span>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => bulkUpdateStatus('in_progress')}
              >
                Mark In Progress
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => bulkUpdateStatus('resolved')}
              >
                Mark Resolved
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => bulkUpdateStatus('archived')}
              >
                Archive
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => setShowBulkDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedSubmissions.size === filteredSubmissions.length && filteredSubmissions.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name / Email</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assigned</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubmissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSubmissions.has(submission.id)}
                        onCheckedChange={() => toggleSelection(submission.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{submission.name}</p>
                        <p className="text-sm text-muted-foreground">{submission.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="truncate">{submission.message}</p>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={submission.status}
                        onValueChange={(value) => updateSubmissionField(submission.id, 'status', value)}
                      >
                        <SelectTrigger className="w-[130px]">
                          <SelectValue>
                            <Badge variant={getStatusBadgeVariant(submission.status)}>
                              {submission.status.replace('_', ' ')}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={submission.priority}
                        onValueChange={(value) => updateSubmissionField(submission.id, 'priority', value)}
                      >
                        <SelectTrigger className="w-[110px]">
                          <SelectValue>
                            <Badge variant={getPriorityBadgeVariant(submission.priority)}>
                              {submission.priority}
                            </Badge>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={submission.assigned_to || 'unassigned'}
                        onValueChange={(value) => 
                          updateSubmissionField(
                            submission.id, 
                            'assigned_to', 
                            value === 'unassigned' ? null : value
                          )
                        }
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue>
                            {submission.assigned_to_email || 'Unassigned'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {admins.map(admin => (
                            <SelectItem key={admin.id} value={admin.id}>
                              {admin.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedSubmission(submission);
                          fetchNotes(submission.id);
                          setShowNotesDialog(true);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {submission.notes_count}
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(submission.created_at), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this submission? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  const { error } = await supabase
                                    .from('contact_submissions')
                                    .delete()
                                    .eq('id', submission.id);

                                  if (error) throw error;

                                  toast({
                                    title: "Deleted",
                                    description: "Submission deleted successfully.",
                                  });

                                  fetchSubmissions();
                                } catch (error) {
                                  console.error('Error deleting:', error);
                                  toast({
                                    title: "Error",
                                    description: "Failed to delete submission.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Notes Dialog */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Internal Notes</DialogTitle>
            <DialogDescription>
              Add private notes about this submission for other admins
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-4">
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No notes yet. Add one below.
                </p>
              ) : (
                notes.map(note => (
                  <div key={note.id} className="border rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{note.admin_email}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(note.created_at), 'PPpp')}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteNote(note.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm">{note.note}</p>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <div className="space-y-4">
            <div>
              <Label htmlFor="note">Add Note</Label>
              <Textarea
                id="note"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Type your note here..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNotesDialog(false)}>
              Close
            </Button>
            <Button onClick={addNote} disabled={!newNote.trim()}>
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Delete Submissions</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedSubmissions.size} submissions? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={bulkDelete}>
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
