import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
import { toast } from "sonner";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  LogOut,
  Loader2,
  AlertTriangle,
  KeyRound,
  Copy,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface AccountLockout {
  id: string;
  locked_at: string;
  unlock_at: string;
  reason: string;
  failed_attempts: number;
  is_active: boolean;
}

interface UserSecurityCardProps {
  userId: string;
  userEmail: string;
  mfaEnabled: boolean;
  mfaMethod?: string | null;
  lockout?: AccountLockout | null;
  sessionRevokedAt?: string | null;
  onUpdate: () => void;
  isPlatformAdmin?: boolean;
}

export function UserSecurityCard({
  userId,
  userEmail,
  mfaEnabled,
  mfaMethod,
  lockout,
  sessionRevokedAt,
  onUpdate,
  isPlatformAdmin = false,
}: UserSecurityCardProps) {
  const [terminateDialogOpen, setTerminateDialogOpen] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [passwordResetDialogOpen, setPasswordResetDialogOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const isLocked = lockout?.is_active && new Date(lockout.unlock_at) > new Date();

  const handleTerminateSessions = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("terminate-user-sessions", {
        body: {
          user_id: userId,
          reason: terminateReason || "Admin initiated session termination",
        },
      });

      if (error) throw error;

      toast.success("All user sessions have been terminated");
      setTerminateDialogOpen(false);
      setTerminateReason("");
      onUpdate();
    } catch (err: any) {
      console.error("Error terminating sessions:", err);
      toast.error(err.message || "Failed to terminate sessions");
    } finally {
      setProcessing(false);
    }
  };

  const handleUnlockAccount = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("unlock-account", {
        body: { user_id: userId },
      });

      if (error) throw error;

      toast.success("Account unlocked successfully");
      setUnlockDialogOpen(false);
      onUpdate();
    } catch (err: any) {
      console.error("Error unlocking account:", err);
      toast.error(err.message || "Failed to unlock account");
    } finally {
      setProcessing(false);
    }
  };

  const handlePasswordReset = async () => {
    setProcessing(true);
    setResetLink(null);
    try {
      const { data, error } = await supabase.functions.invoke("reset-admin-password", {
        body: { user_id: userId },
      });

      if (error) throw error;

      if (data.email_sent) {
        toast.success(`Password reset email sent to ${userEmail}`);
        setPasswordResetDialogOpen(false);
      } else if (data.reset_link) {
        // Email not configured, show the link
        setResetLink(data.reset_link);
        toast.info("Reset link generated - email not configured");
      } else {
        toast.success(data.message || "Password reset initiated");
        setPasswordResetDialogOpen(false);
      }
      onUpdate();
    } catch (err: any) {
      console.error("Error resetting password:", err);
      toast.error(err.message || "Failed to reset password");
    } finally {
      setProcessing(false);
    }
  };

  const copyResetLink = () => {
    if (resetLink) {
      navigator.clipboard.writeText(resetLink);
      toast.success("Reset link copied to clipboard");
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Status
          </CardTitle>
          <CardDescription>
            MFA status, account lockouts, and session management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account Lockout Alert */}
          {isLocked && lockout && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-3">
              <div className="flex items-center gap-2 text-destructive font-medium">
                <Lock className="h-5 w-5" />
                Account Locked
              </div>
              <div className="text-sm space-y-1">
                <p><strong>Reason:</strong> {lockout.reason}</p>
                <p><strong>Failed attempts:</strong> {lockout.failed_attempts}</p>
                <p><strong>Locked at:</strong> {format(new Date(lockout.locked_at), "PPp")}</p>
                <p><strong>Auto-unlock:</strong> {formatDistanceToNow(new Date(lockout.unlock_at), { addSuffix: true })}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setUnlockDialogOpen(true)}
                disabled={processing}
              >
                <Unlock className="h-4 w-4 mr-2" />
                Unlock Account Now
              </Button>
            </div>
          )}

          {/* Security Items Grid */}
          <div className="grid gap-4">
            {/* MFA Status */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                {mfaEnabled ? (
                  <ShieldCheck className="h-6 w-6 text-green-500" />
                ) : (
                  <ShieldAlert className="h-6 w-6 text-yellow-500" />
                )}
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">
                    {mfaEnabled
                      ? `Enabled via ${mfaMethod || "authenticator app"}`
                      : "Not enabled"}
                  </p>
                </div>
              </div>
              <Badge variant={mfaEnabled ? "default" : "secondary"}>
                {mfaEnabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>

            {/* Session Status */}
            <div className="flex items-center justify-between p-4 rounded-lg border">
              <div className="flex items-center gap-3">
                <LogOut className="h-6 w-6 text-muted-foreground" />
                <div>
                  <p className="font-medium">Active Sessions</p>
                  <p className="text-sm text-muted-foreground">
                    {sessionRevokedAt
                      ? `Last revoked ${formatDistanceToNow(new Date(sessionRevokedAt), { addSuffix: true })}`
                      : "Sessions have never been force-terminated"}
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setTerminateDialogOpen(true)}
                disabled={processing}
              >
                <LogOut className="h-4 w-4 mr-2" />
                Terminate All
              </Button>
            </div>

            {/* Lockout Status (if not currently locked) */}
            {!isLocked && (
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  {lockout ? (
                    <AlertTriangle className="h-6 w-6 text-yellow-500" />
                  ) : (
                    <ShieldCheck className="h-6 w-6 text-green-500" />
                  )}
                  <div>
                    <p className="font-medium">Account Lockout</p>
                    <p className="text-sm text-muted-foreground">
                      {lockout
                        ? `Previously locked (${lockout.failed_attempts} attempts)`
                        : "No lockout history"}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-green-600">
                  Unlocked
                </Badge>
              </div>
            )}

            {/* Password Reset - Only for Platform Admins */}
            {isPlatformAdmin && (
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <KeyRound className="h-6 w-6 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Password Management</p>
                    <p className="text-sm text-muted-foreground">
                      Send a password reset link to this admin
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPasswordResetDialogOpen(true)}
                  disabled={processing}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Reset Password
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Terminate Sessions Dialog */}
      <AlertDialog open={terminateDialogOpen} onOpenChange={setTerminateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <LogOut className="h-5 w-5 text-destructive" />
              Terminate All Sessions
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately sign out {userEmail} from all devices and sessions.
              They will need to log in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g., Security incident, account compromise suspected..."
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTerminateSessions}
              disabled={processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Terminating...
                </>
              ) : (
                "Terminate Sessions"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlock Account Dialog */}
      <AlertDialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5" />
              Unlock Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately unlock {userEmail}'s account, allowing them to log in again.
              Make sure the security concern has been resolved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlockAccount} disabled={processing}>
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Unlocking...
                </>
              ) : (
                "Unlock Account"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Reset Dialog */}
      <AlertDialog open={passwordResetDialogOpen} onOpenChange={(open) => {
        setPasswordResetDialogOpen(open);
        if (!open) setResetLink(null);
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Reset Admin Password
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will send a password reset link to {userEmail}. They will receive an email with instructions to create a new password.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {resetLink && (
            <div className="py-4 space-y-2">
              <Label>Reset Link (email not configured)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs break-all max-h-20 overflow-y-auto">
                  {resetLink}
                </code>
                <Button variant="outline" size="sm" onClick={copyResetLink}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Copy this link and send it to the user manually.
              </p>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>
              {resetLink ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {!resetLink && (
              <AlertDialogAction onClick={handlePasswordReset} disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
