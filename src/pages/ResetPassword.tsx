import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Loader2, Eye, EyeOff, CheckCircle, XCircle, ArrowRight, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { isPasswordValid, validatePassword } from "@/lib/password-validation";
import { toast } from "sonner";

type ViewState = "loading" | "form" | "success" | "error";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  useEffect(() => {
    // Check if we have a valid session from the magic link
    const checkSession = async () => {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error("Session error:", sessionError);
        setError("Invalid or expired reset link. Please request a new password reset.");
        setViewState("error");
        return;
      }

      if (!session) {
        // Try to get session from URL hash (for magic links)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        if (accessToken && refreshToken && type === "recovery") {
          try {
            const { error: setSessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (setSessionError) {
              throw setSessionError;
            }

            // Clear the hash from URL
            window.history.replaceState(null, "", window.location.pathname);
            setViewState("form");
          } catch (err: any) {
            console.error("Set session error:", err);
            setError("Invalid or expired reset link. Please request a new password reset.");
            setViewState("error");
          }
        } else {
          setError("Invalid or expired reset link. Please request a new password reset.");
          setViewState("error");
        }
      } else {
        setViewState("form");
      }
    };

    checkSession();
  }, []);

  // Countdown for redirect after success
  useEffect(() => {
    if (viewState !== "success") return;

    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/login");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [viewState, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate password
    const validation = validatePassword(password);
    if (!validation.valid) {
      setError(validation.errors[0]);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      // Sign out after password change for security
      await supabase.auth.signOut();
      
      toast.success("Password updated successfully!");
      setViewState("success");
    } catch (err: any) {
      console.error("Password update error:", err);
      setError(err.message || "Failed to update password. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <AnimatePresence mode="wait">
          {viewState === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="mt-4 text-muted-foreground">Verifying reset link...</p>
            </motion.div>
          )}

          {viewState === "error" && (
            <motion.div
              key="error"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="shadow-xl">
                <CardHeader className="text-center">
                  <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-2">
                    <XCircle className="h-7 w-7 text-destructive" />
                  </div>
                  <CardTitle className="text-xl">Link Expired</CardTitle>
                  <CardDescription>{error}</CardDescription>
                </CardHeader>
                <CardContent className="text-center">
                  <Button onClick={() => navigate("/forgot-password")} className="gap-2">
                    Request New Link
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {viewState === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <Card className="shadow-xl">
                <CardHeader className="text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                    className="mx-auto w-16 h-16 rounded-full bg-[hsl(142_76%_36%)]/10 flex items-center justify-center mb-2"
                  >
                    <CheckCircle className="h-8 w-8 text-[hsl(142_76%_36%)]" />
                  </motion.div>
                  <CardTitle className="text-xl">Password Updated!</CardTitle>
                  <CardDescription>
                    Your password has been successfully reset. You can now sign in with your new password.
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Redirecting to login in {redirectCountdown} seconds...
                  </p>
                  <Button onClick={() => navigate("/login")} className="gap-2">
                    Go to Login
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {viewState === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Card className="shadow-xl">
                <CardHeader className="text-center space-y-2">
                  <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <KeyRound className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl font-bold">Set New Password</CardTitle>
                  <CardDescription>
                    Create a strong password to secure your account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="password">New Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter new password"
                          className="pl-10 pr-10"
                          autoComplete="new-password"
                          disabled={isSubmitting}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? "Hide password" : "Show password"}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <PasswordStrengthMeter password={password} />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? "text" : "password"}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm new password"
                          className="pl-10 pr-10"
                          autoComplete="new-password"
                          disabled={isSubmitting}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="text-xs text-destructive">Passwords do not match</p>
                      )}
                    </div>

                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isSubmitting || !isPasswordValid(password) || password !== confirmPassword}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Updating Password...
                        </>
                      ) : (
                        "Update Password"
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
