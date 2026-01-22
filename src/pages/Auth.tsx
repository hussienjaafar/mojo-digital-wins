import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Session } from "@supabase/supabase-js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ForgotPasswordLink } from "@/components/auth/ForgotPasswordLink";

// Validation schema for sign in
const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type SignInFormData = z.infer<typeof signInSchema>;

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState<boolean | null>(null);
  const [userEmail, setUserEmail] = useState<string>("");
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  const signInForm = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setIsEmailVerified(session?.user?.email_confirmed_at ? true : false);
      setUserEmail(session?.user?.email || "");
      
      if (session && session.user.email_confirmed_at) {
        navigate("/admin");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsEmailVerified(session?.user?.email_confirmed_at ? true : false);
      setUserEmail(session?.user?.email || "");
      
      if (session && session.user.email_confirmed_at) {
        navigate("/admin");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSignIn = async (data: SignInFormData) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message || "Invalid email or password. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleResendVerification = async () => {
    if (!userEmail) {
      toast({
        title: "Error",
        description: "No email address found. Please sign up first.",
        variant: "destructive",
      });
      return;
    }

    setIsResendingVerification(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/admin`,
        }
      });

      if (error) throw error;

      toast({
        title: "Verification email sent!",
        description: "Please check your inbox for the verification link.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to resend email",
        description: error.message || "Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsResendingVerification(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Admin Login</CardTitle>
          <CardDescription className="text-center">
            Sign in to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          {session && isEmailVerified === false && (
            <Alert className="mb-4 border-[hsl(45_93%_47%)/0.5] bg-[hsl(45_93%_47%)/0.1]">
              <AlertCircle className="h-4 w-4 text-[hsl(45_93%_47%)]" />
              <AlertDescription className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Email not verified</span>
                  <Badge variant="outline" className="border-[hsl(45_93%_47%)] text-[hsl(45_93%_47%)]">
                    Unverified
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Please check your email and click the verification link to access the admin dashboard.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={isResendingVerification}
                  className="w-full mt-2"
                >
                  {isResendingVerification ? "Sending..." : "Resend Verification Email"}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          {session && isEmailVerified === true && (
            <Alert className="mb-4 border-[hsl(142_76%_36%)/0.5] bg-[hsl(142_76%_36%)/0.1]">
              <CheckCircle2 className="h-4 w-4 text-[hsl(142_76%_36%)]" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">Email verified</span>
                <Badge variant="outline" className="border-[hsl(142_76%_36%)] text-[hsl(142_76%_36%)]">
                  Verified
                </Badge>
              </AlertDescription>
            </Alert>
          )}
          
          <Form {...signInForm}>
            <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
              <FormField
                control={signInForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="email"
                          placeholder="admin@example.com"
                          className="pl-10"
                          autoComplete="email"
                          disabled={signInForm.formState.isSubmitting}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={signInForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          className="pl-10 pr-10"
                          autoComplete="current-password"
                          disabled={signInForm.formState.isSubmitting}
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
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <ForgotPasswordLink className="mt-1" />
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={signInForm.formState.isSubmitting}
              >
                {signInForm.formState.isSubmitting ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </Form>
          
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Admin access is by invitation only.{" "}
            <Link to="/contact" className="text-primary hover:underline">
              Contact us
            </Link>{" "}
            if you need access.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
