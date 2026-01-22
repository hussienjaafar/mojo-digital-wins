import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, Loader2, ArrowLeft, CheckCircle, KeyRound } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/request-password-reset`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send reset email");
      }

      setIsSuccess(true);
    } catch (err: any) {
      // Start cooldown on error
      setCooldownSeconds(30);
      const interval = setInterval(() => {
        setCooldownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      setError(err.message || "Something went wrong. Please try again.");
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
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Reset Your Password</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a link to reset your password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {isSuccess ? (
                <motion.div
                  key="success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="text-center space-y-4"
                >
                  <div className="mx-auto w-16 h-16 rounded-full bg-[hsl(142_76%_36%)]/10 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-[hsl(142_76%_36%)]" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">Check Your Email</h3>
                    <p className="text-sm text-muted-foreground">
                      If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
                    </p>
                  </div>
                  <div className="pt-4 space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Didn't receive an email? Check your spam folder or try again in a few minutes.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsSuccess(false);
                          setEmail("");
                        }}
                        className="w-full"
                      >
                        Try a different email
                      </Button>
                      <Link to="/login" className="w-full">
                        <Button variant="ghost" className="w-full gap-2">
                          <ArrowLeft className="h-4 w-4" />
                          Back to Login
                        </Button>
                      </Link>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.form
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onSubmit={handleSubmit}
                  className="space-y-4"
                >
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="pl-10"
                        autoComplete="email"
                        disabled={isSubmitting || cooldownSeconds > 0}
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isSubmitting || cooldownSeconds > 0}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : cooldownSeconds > 0 ? (
                      `Wait ${cooldownSeconds}s to retry`
                    ) : (
                      "Send Reset Link"
                    )}
                  </Button>

                  <div className="text-center pt-2">
                    <Link 
                      to="/login" 
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    >
                      <ArrowLeft className="h-3 w-3" />
                      Back to Login
                    </Link>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
