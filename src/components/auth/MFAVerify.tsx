import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2 } from "lucide-react";

interface MFAVerifyProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function MFAVerify({ onSuccess, onCancel }: MFAVerifyProps) {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  useEffect(() => {
    initializeChallenge();
  }, []);

  const initializeChallenge = async () => {
    try {
      // Get the user's MFA factors
      const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) throw factorsError;

      const totpFactor = factorsData.totp.find(f => f.status === "verified");
      if (!totpFactor) {
        setError("No verified MFA factor found");
        return;
      }

      setFactorId(totpFactor.id);

      // Create a challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totpFactor.id,
      });

      if (challengeError) throw challengeError;

      setChallengeId(challengeData.id);
    } catch (err: any) {
      console.error("MFA challenge error:", err);
      setError(err.message || "Failed to initialize MFA challenge");
    }
  };

  const handleVerify = async () => {
    if (!factorId || !challengeId || code.length !== 6) return;
    
    setLoading(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code,
      });

      if (verifyError) throw verifyError;

      // Log successful verification
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("mfa_enrollment_log").insert({
          user_id: user.id,
          action: "verified",
          method: "totp",
        });
      }

      onSuccess();
    } catch (err: any) {
      console.error("MFA verification error:", err);
      setError(err.message || "Invalid verification code");
      setCode("");
      
      // Log failed attempt
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("mfa_enrollment_log").insert({
          user_id: user.id,
          action: "failed",
          method: "totp",
        });
      }

      // Refresh challenge for next attempt
      initializeChallenge();
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (code.length === 6 && factorId && challengeId) {
      handleVerify();
    }
  }, [code, factorId, challengeId]);

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle>Two-Factor Authentication</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(value) => setCode(value)}
            disabled={loading}
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

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-3">
          <Button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Verify"
            )}
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} className="w-full">
              Cancel
            </Button>
          )}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Having trouble? Contact support if you've lost access to your authenticator.
        </p>
      </CardContent>
    </Card>
  );
}
