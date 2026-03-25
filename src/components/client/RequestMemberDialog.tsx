import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { toast } from "sonner";
import { UserPlus, Loader2, CheckCircle } from "lucide-react";

interface RequestMemberDialogProps {
  organizationId: string;
  canManageAdmins?: boolean;
  onRequestSubmitted?: () => void;
  trigger?: React.ReactNode;
}

export function RequestMemberDialog({
  organizationId,
  canManageAdmins = false,
  onRequestSubmitted,
  trigger,
}: RequestMemberDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: "viewer",
    notes: "",
  });

  const handleSubmit = async () => {
    if (!form.email || !form.full_name) {
      toast.error("Please fill in email and name");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("pending_member_requests")
        .insert({
          organization_id: organizationId,
          requested_by: user.id,
          email: form.email.toLowerCase().trim(),
          full_name: form.full_name.trim(),
          requested_role: form.role,
          notes: form.notes.trim() || null,
        });

      if (error) throw error;

      setSubmitted(true);
      onRequestSubmitted?.();
    } catch (error: any) {
      console.error("Error submitting member request:", error);
      toast.error(error.message || "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset form after dialog closes
    setTimeout(() => {
      setForm({ email: "", full_name: "", role: "viewer", notes: "" });
      setSubmitted(false);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) handleClose();
      else setOpen(true);
    }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm">
            <UserPlus className="h-4 w-4 mr-2" />
            Request Member
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        {submitted ? (
          <>
            <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Request Submitted
            </DialogTitle>
              <DialogDescription>
                Your request has been submitted to the platform administrator for review.
                You'll be notified once it's processed.
              </DialogDescription>
            </DialogHeader>
            <div className="py-6">
              <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">{form.full_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <span className="font-medium">{form.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Role</span>
                  <span className="font-medium capitalize">{form.role}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Request New Team Member</DialogTitle>
              <DialogDescription>
                Submit a request for a new team member. Your platform administrator 
                will review and process this request based on your seat allocation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="request-name">Full Name</Label>
                <Input
                  id="request-name"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-email">Email Address</Label>
                <Input
                  id="request-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-role">Requested Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => setForm({ ...form, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewer">Viewer</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    {canManageAdmins && (
                      <SelectItem value="admin">Admin</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Admins can manage all settings. Managers can request members. Viewers have read-only access.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="request-notes">Notes (optional)</Label>
                <Textarea
                  id="request-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Reason for this request or any additional context..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Request"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
