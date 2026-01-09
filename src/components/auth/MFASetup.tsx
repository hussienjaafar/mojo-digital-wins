import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { Shield, Copy, CheckCircle, Loader2, QrCode } from "lucide-react";

interface MFASetupProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function MFASetup({ onComplete, onCancel }: MFASetupProps) {
  const [step, setStep] = useState<"enroll" | "verify">("enroll");
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startEnrollment = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator App",
      });

      if (error) throw error;

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStep("verify");
    } catch (err: any) {
      console.error("MFA enrollment error:", err);
      setError(err.message || "Failed to start MFA enrollment");
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable = async () => {
    if (!factorId || verifyCode.length !== 6) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode,
      });

      if (verifyError) throw verifyError;

      // Update profile to mark MFA enabled
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("profiles")
          .update({
            mfa_enabled_at: new Date().toISOString(),
            mfa_method: "totp",
          })
          .eq("id", user.id);

        // Log the enrollment
        await supabase.from("mfa_enrollment_log").insert({
          user_id: user.id,
          action: "enrolled",
          method: "totp",
        });
      }

      toast.success("Two-factor authentication enabled successfully!");
      onComplete?.();
    } catch (err: any) {
      console.error("MFA verification error:", err);
      setError(err.message || "Invalid verification code");
      setVerifyCode("");
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (step === "enroll") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Enable Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account by enabling 2FA with an authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>You'll need an authenticator app like:</p>
            <ul className="list-disc list-inside ml-2">
              <li>Google Authenticator</li>
              <li>Authy</li>
              <li>1Password</li>
              <li>Microsoft Authenticator</li>
            </ul>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button onClick={startEnrollment} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Setting up...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4 mr-2" />
                  Begin Setup
                </>
              )}
            </Button>
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Scan QR Code
        </CardTitle>
        <CardDescription>
          Scan this QR code with your authenticator app, then enter the 6-digit code.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* QR Code */}
        <div className="flex justify-center">
          {qrCode && (
            <img
              src={qrCode}
              alt="MFA QR Code"
              className="rounded-lg border p-2 bg-white"
              width={200}
              height={200}
            />
          )}
        </div>

        {/* Manual Entry */}
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground text-center">
            Can't scan? Enter this code manually:
          </p>
          <div className="flex items-center justify-center gap-2">
            <code className="bg-muted px-3 py-1.5 rounded text-sm font-mono">
              {secret}
            </code>
            <Button variant="ghost" size="sm" onClick={copySecret}>
              {copied ? (
                <CheckCircle className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Verification */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-center">
            Enter the 6-digit code from your app:
          </p>
          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={verifyCode}
              onChange={(value) => setVerifyCode(value)}
            >
              <InputOTPGroup>
                <InputOTPSlot index={0} />
                <InputOTPSlot index={1} />
                <InputOTPSlot index={2} />
                <InputOTPSlot index={3} />
                <InputOTPSlot index={4} />
                <InputOTPSlot index={5} />
              </InputOTPGroup>
            </InputOTP>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-3 justify-center">
          <Button
            onClick={verifyAndEnable}
            disabled={loading || verifyCode.length !== 6}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Enable 2FA
              </>
            )}
          </Button>
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
