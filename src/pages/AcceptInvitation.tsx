import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle, XCircle, Mail, Lock, User } from "lucide-react";
import { toast } from "sonner";

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
  const [accepted, setAccepted] = useState(false);

  // Signup form state
  const [signupMode, setSignupMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [signingUp, setSigningUp] = useState(false);

  // Login form state
  const [loginMode, setLoginMode] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No invitation token provided");
      setLoading(false);
      return;
    }

    loadInvitation();
    checkAuthStatus();
  }, [token]);

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
      setEmail(inv.email);
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
    setSigningUp(true);

    try {
      // Create the user account
      const { data: authData, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (signupError) throw signupError;

      if (authData.user) {
        // Accept the invitation
        await acceptInvitation(authData.user.id);
      }
    } catch (err: any) {
      console.error("Signup error:", err);
      toast.error(err.message || "Failed to create account");
    } finally {
      setSigningUp(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
        setLoginMode(false);
        toast.success("Logged in successfully");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      toast.error(err.message || "Failed to log in");
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

      setAccepted(true);
      toast.success("Invitation accepted successfully!");

      // Redirect based on invitation type
      setTimeout(() => {
        if (result.invitation_type === "platform_admin") {
          navigate("/admin");
        } else if (result.organization_id) {
          navigate("/client-portal");
        } else {
          navigate("/");
        }
      }, 2000);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
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
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Welcome!</CardTitle>
            <CardDescription>
              {invitation?.invitation_type === "platform_admin"
                ? "You now have platform admin access. Redirecting to admin dashboard..."
                : `You're now a member of ${invitation?.organization_name}. Redirecting...`}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
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
          {isLoggedIn && currentUser ? (
            <div className="space-y-4">
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
                  "Accept Invitation"
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
            </div>
          ) : signupMode ? (
            <form onSubmit={handleSignup} className="space-y-4">
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a password"
                    className="pl-10"
                    minLength={6}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={signingUp}>
                {signingUp ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account & Accept"
                )}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setSignupMode(false);
                  setLoginMode(true);
                }}
                className="w-full"
              >
                Already have an account? Log in
              </Button>
            </form>
          ) : loginMode ? (
            <form onSubmit={handleLogin} className="space-y-4">
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
                  "Log In & Accept"
                )}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setLoginMode(false);
                  setSignupMode(true);
                }}
                className="w-full"
              >
                Don't have an account? Sign up
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <Button onClick={() => setSignupMode(true)} className="w-full">
                Create New Account
              </Button>
              <Button
                variant="outline"
                onClick={() => setLoginMode(true)}
                className="w-full"
              >
                I Already Have an Account
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}