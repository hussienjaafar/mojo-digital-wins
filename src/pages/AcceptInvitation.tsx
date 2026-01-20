import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, 
  CheckCircle, 
  XCircle, 
  Mail, 
  Lock, 
  User, 
  Eye, 
  EyeOff,
  PartyPopper,
  ArrowRight,
  LogIn
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { isPasswordValid, validatePassword } from "@/lib/password-validation";

interface InvitationDetails {
  id: string;
  email: string;
  invitation_type: string;
  organization_id: string | null;
  organization_name: string | null;
  role: string | null;
  status: string;
  expires_at: string;
}

type ViewMode = 'choice' | 'signup' | 'login' | 'accepted';

export default function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('choice');
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  // Signup form state
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [signingUp, setSigningUp] = useState(false);
  const [signupError, setSignupError] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided");
      setLoading(false);
      return;
    }

    loadInvitation();
    checkAuthStatus();
  }, [token]);

  // Countdown for redirect after acceptance
  useEffect(() => {
    if (viewMode !== 'accepted') return;
    
    const timer = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [viewMode]);

  const handleRedirect = useCallback(() => {
    if (invitation?.invitation_type === "platform_admin") {
      navigate("/admin");
    } else if (invitation?.organization_id) {
      navigate("/client-portal");
    } else {
      navigate("/");
    }
  }, [invitation, navigate]);

  const checkAuthStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setIsLoggedIn(true);
      setCurrentUser({ id: user.id, email: user.email || "" });
    }
  };

  const loadInvitation = async () => {
    try {
      const { data, error } = await supabase.rpc("get_invitation_by_token", {
        p_token: token!,
      });

      if (error) throw error;

      if (!data || data.length === 0) {
        setError("Invitation not found or has expired");
        return;
      }

      const inv = data[0] as InvitationDetails;
      
      if (inv.status === "accepted") {
        setError("This invitation has already been accepted");
        return;
      }

      if (inv.status === "revoked") {
        setError("This invitation has been revoked");
        return;
      }

      if (new Date(inv.expires_at) < new Date()) {
        setError("This invitation has expired");
        return;
      }

      setInvitation(inv);
      setLoginEmail(inv.email);
    } catch (err: any) {
      console.error("Error loading invitation:", err);
      setError("Failed to load invitation details");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    // Validate password
    const validation = validatePassword(password);
    if (!validation.valid) {
      setSignupError(validation.errors[0]);
      return;
    }

    if (!fullName.trim()) {
      setSignupError("Please enter your full name");
      return;
    }

    setSigningUp(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invitation-signup`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            token: token!,
            email: invitation!.email,
            password: password,
            full_name: fullName.trim(),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        if (result.code === "USER_EXISTS") {
          setSignupError("An account with this email already exists. Please log in instead.");
          setViewMode('login');
          return;
        }
        throw new Error(result.error || "Failed to create account");
      }

      // Set the session if returned
      if (result.access_token && result.refresh_token) {
        await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
      }

      setViewMode('accepted');
      toast.success("Welcome aboard! Your account has been created.");
    } catch (err: any) {
      console.error("Signup error:", err);
      setSignupError(err.message || "Failed to create account");
    } finally {
      setSigningUp(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoggingIn(true);

    try {
      const { data: authData, error: loginError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });

      if (loginError) throw loginError;

      if (authData.user) {
        setIsLoggedIn(true);
        setCurrentUser({ id: authData.user.id, email: authData.user.email || "" });
        setViewMode('choice');
        toast.success("Logged in successfully");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setLoginError(err.message || "Failed to log in");
    } finally {
      setLoggingIn(false);
    }
  };

  const acceptInvitation = async (userId: string) => {
    setAccepting(true);

    try {
      const { data, error } = await supabase.rpc("accept_invitation", {
        p_token: token!,
        p_user_id: userId,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string; invitation_type?: string; organization_id?: string };

      if (!result.success) {
        throw new Error(result.error || "Failed to accept invitation");
      }

      setViewMode('accepted');
      toast.success("Invitation accepted successfully!");
    } catch (err: any) {
      console.error("Accept error:", err);
      toast.error(err.message || "Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  const handleAcceptAsCurrentUser = () => {
    if (currentUser) {
      acceptInvitation(currentUser.id);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading invitation...</p>
        </motion.div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <CardTitle>Invalid Invitation</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button onClick={() => navigate("/login")}>
                Go to Login
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Success state with celebration
  if (viewMode === 'accepted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", duration: 0.5 }}
        >
          <Card className="w-full max-w-md overflow-hidden">
            <CardHeader className="text-center pb-2">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                className="relative"
              >
                <div className="h-20 w-20 mx-auto rounded-full bg-[hsl(142_76%_36%)]/10 flex items-center justify-center">
                  <CheckCircle className="h-10 w-10 text-[hsl(142_76%_36%)]" />
                </div>
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="absolute -top-2 -right-2"
                >
                  <PartyPopper className="h-8 w-8 text-primary" />
                </motion.div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <CardTitle className="text-2xl mt-4">Welcome Aboard!</CardTitle>
                <CardDescription className="mt-2">
                  {invitation?.invitation_type === "platform_admin"
                    ? "You now have platform admin access."
                    : `You're now a member of ${invitation?.organization_name}.`}
                </CardDescription>
              </motion.div>
            </CardHeader>
            <CardContent className="text-center space-y-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <p className="text-sm text-muted-foreground mb-4">
                  Redirecting in {redirectCountdown} seconds...
                </p>
                <Button onClick={handleRedirect} className="gap-2">
                  Go to Dashboard
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card>
          <CardHeader className="text-center">
            <div className="h-12 w-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>You're Invited!</CardTitle>
            <CardDescription>
              {invitation?.invitation_type === "platform_admin" ? (
                "You've been invited to become a Platform Admin with full system access."
              ) : (
                <>
                  You've been invited to join{" "}
                  <strong>{invitation?.organization_name}</strong> as a{" "}
                  <strong className="capitalize">{invitation?.role}</strong>.
                </>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AnimatePresence mode="wait">
              {isLoggedIn && currentUser ? (
                <motion.div
                  key="logged-in"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <Alert>
                    <AlertDescription>
                      You're logged in as <strong>{currentUser.email}</strong>.
                      {currentUser.email.toLowerCase() !== invitation?.email.toLowerCase() && (
                        <span className="block mt-1 text-amber-600">
                          Note: This invitation was sent to {invitation?.email}
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>
                  <Button 
                    onClick={handleAcceptAsCurrentUser} 
                    className="w-full"
                    disabled={accepting}
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Accepting...
                      </>
                    ) : (
                      <>
                        Accept Invitation
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setIsLoggedIn(false);
                      setCurrentUser(null);
                    }}
                    className="w-full"
                  >
                    Sign out and use different account
                  </Button>
                </motion.div>
              ) : viewMode === 'signup' ? (
                <motion.form
                  key="signup"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleSignup}
                  className="space-y-4"
                >
                  {signupError && (
                    <Alert variant="destructive">
                      <AlertDescription>{signupError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="fullName"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Enter your full name"
                        className="pl-10"
                        autoComplete="name"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={invitation?.email || ""}
                        className="pl-10 bg-muted"
                        readOnly
                        aria-describedby="email-help"
                      />
                    </div>
                    <p id="email-help" className="text-xs text-muted-foreground">
                      This email is linked to your invitation
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Create a strong password"
                        className="pl-10 pr-10"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <PasswordStrengthMeter password={password} />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={signingUp || !isPasswordValid(password)}
                  >
                    {signingUp ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      <>
                        Create Account & Accept
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setViewMode('login')}
                    className="w-full"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Already have an account? Log in
                  </Button>
                </motion.form>
              ) : viewMode === 'login' ? (
                <motion.form
                  key="login"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  onSubmit={handleLogin}
                  className="space-y-4"
                >
                  {loginError && (
                    <Alert variant="destructive">
                      <AlertDescription>{loginError}</AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="loginEmail">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="loginEmail"
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="pl-10"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="loginPassword">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="loginPassword"
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="pl-10"
                        autoComplete="current-password"
                        required
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full" disabled={loggingIn}>
                    {loggingIn ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Logging in...
                      </>
                    ) : (
                      <>
                        Log In & Accept
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">
                        Or
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setViewMode('signup')}
                    className="w-full"
                  >
                    <User className="mr-2 h-4 w-4" />
                    Don't have an account? Sign up
                  </Button>
                </motion.form>
              ) : (
                <motion.div
                  key="choice"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <Button onClick={() => setViewMode('signup')} className="w-full gap-2">
                    <User className="h-4 w-4" />
                    Create New Account
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setViewMode('login')}
                    className="w-full gap-2"
                  >
                    <LogIn className="h-4 w-4" />
                    I Already Have an Account
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
