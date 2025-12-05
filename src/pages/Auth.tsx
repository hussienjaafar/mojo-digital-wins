import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Session } from "@supabase/supabase-js";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Lock, Eye, EyeOff, Check, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { logger } from "@/lib/logger";

// Password strength calculation
const calculatePasswordStrength = (password: string): { score: number; label: string; color: string } => {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: "Weak", color: "text-destructive" };
  if (score <= 3) return { score, label: "Medium", color: "text-yellow-500" };
  return { score, label: "Strong", color: "text-green-500" };
};

const getPasswordRequirements = (password: string) => ({
  length: password.length >= 8,
  lowercase: /[a-z]/.test(password),
  uppercase: /[A-Z]/.test(password),
  number: /[0-9]/.test(password),
  special: /[^a-zA-Z0-9]/.test(password),
});

// Validation schemas
const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z.string().min(1, { message: "Password is required" }),
});

const signUpSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "Please enter a valid email address" })
    .max(255, { message: "Email must be less than 255 characters" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[0-9]/, { message: "Password must contain at least one number" })
    .regex(/[^a-zA-Z0-9]/, { message: "Password must contain at least one special character" }),
  confirmPassword: z.string().min(1, { message: "Please confirm your password" }),
  adminCode: z.string().optional(),
  acceptTerms: z.boolean().refine((val) => val === true, {
    message: "You must accept the terms and conditions",
  }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type SignInFormData = z.infer<typeof signInSchema>;
type SignUpFormData = z.infer<typeof signUpSchema>;

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: "", color: "" });
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    lowercase: false,
    uppercase: false,
    number: false,
    special: false,
  });
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

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      adminCode: "",
      acceptTerms: false,
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

  const handlePasswordChange = (password: string) => {
    setPasswordStrength(calculatePasswordStrength(password));
    setPasswordRequirements(getPasswordRequirements(password));
  };

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

  const handleSignUp = async (data: SignUpFormData) => {
    try {
      const redirectUrl = `${window.location.origin}/admin`;
      
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) throw error;

      // If admin code was provided, verify it
      if (data.adminCode && authData.user) {
        const { data: result, error: rpcError } = await supabase
          .rpc('verify_admin_invite_code' as any, {
            invite_code: data.adminCode,
            user_id: authData.user.id
          });

        if (rpcError) {
          logger.error('Admin code verification failed', rpcError);
          toast({
            title: "Invalid admin code",
            description: "The admin code you provided is invalid or has already been used.",
            variant: "destructive",
          });
        } else if (result) {
          toast({
            title: "Admin account created!",
            description: "Your account has been created with admin privileges.",
          });
          return;
        }
      }

      toast({
        title: "Account created!",
        description: "Please check your email to verify your account.",
      });
    } catch (error: any) {
      let errorMessage = "An error occurred during sign up. Please try again.";
      
      if (error.message?.includes("already registered")) {
        errorMessage = "This email is already registered. Please sign in instead.";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Sign up failed",
        description: errorMessage,
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
          <CardTitle className="text-2xl font-bold text-center">Admin Access</CardTitle>
          <CardDescription className="text-center">
            Sign in to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          {session && isEmailVerified === false && (
            <Alert className="mb-4 border-yellow-500/50 bg-yellow-500/10">
              <AlertCircle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Email not verified</span>
                  <Badge variant="outline" className="border-yellow-500 text-yellow-600">
                    <X className="h-3 w-3 mr-1" />
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
            <Alert className="mb-4 border-green-500/50 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">Email verified</span>
                <Badge variant="outline" className="border-green-500 text-green-600">
                  <Check className="h-3 w-3 mr-1" />
                  Verified
                </Badge>
              </AlertDescription>
            </Alert>
          )}
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
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
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={signInForm.formState.isSubmitting}
                  >
                    {signInForm.formState.isSubmitting ? "Signing in..." : "Sign In"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
            
            <TabsContent value="signup">
              <Form {...signUpForm}>
                <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                  <FormField
                    control={signUpForm.control}
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
                              disabled={signUpForm.formState.isSubmitting}
                            />
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={signUpForm.control}
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
                              autoComplete="new-password"
                              disabled={signUpForm.formState.isSubmitting}
                              onChange={(e) => {
                                field.onChange(e);
                                handlePasswordChange(e.target.value);
                              }}
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
                        {field.value && (
                          <div className="space-y-2 mt-2">
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${
                                    passwordStrength.score <= 2
                                      ? "bg-destructive w-1/3"
                                      : passwordStrength.score <= 3
                                      ? "bg-yellow-500 w-2/3"
                                      : "bg-green-500 w-full"
                                  }`}
                                />
                              </div>
                              <span className={`text-xs font-medium ${passwordStrength.color}`}>
                                {passwordStrength.label}
                              </span>
                            </div>
                            <div className="text-xs space-y-1">
                              <div className="flex items-center gap-1">
                                {passwordRequirements.length ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <X className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className={passwordRequirements.length ? "text-green-500" : "text-muted-foreground"}>
                                  At least 8 characters
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {passwordRequirements.uppercase ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <X className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className={passwordRequirements.uppercase ? "text-green-500" : "text-muted-foreground"}>
                                  One uppercase letter
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {passwordRequirements.lowercase ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <X className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className={passwordRequirements.lowercase ? "text-green-500" : "text-muted-foreground"}>
                                  One lowercase letter
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {passwordRequirements.number ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <X className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className={passwordRequirements.number ? "text-green-500" : "text-muted-foreground"}>
                                  One number
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                {passwordRequirements.special ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <X className="h-3 w-3 text-muted-foreground" />
                                )}
                                <span className={passwordRequirements.special ? "text-green-500" : "text-muted-foreground"}>
                                  One special character
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={signUpForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              {...field}
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="••••••••"
                              className="pl-10 pr-10"
                              autoComplete="new-password"
                              disabled={signUpForm.formState.isSubmitting}
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
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={signUpForm.control}
                    name="adminCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admin Invite Code (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            placeholder="Enter admin code if you have one"
                            disabled={signUpForm.formState.isSubmitting}
                          />
                        </FormControl>
                        <FormDescription>
                          If you have an admin invite code, enter it here to get admin access.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  
                  <FormField
                    control={signUpForm.control}
                    name="acceptTerms"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={signUpForm.formState.isSubmitting}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm font-normal">
                            I accept the{" "}
                            <a href="/privacy-policy" className="text-primary hover:underline" target="_blank">
                              Terms of Service and Privacy Policy
                            </a>
                          </FormLabel>
                          <FormMessage />
                        </div>
                      </FormItem>
                    )}
                  />
                  
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={signUpForm.formState.isSubmitting}
                  >
                    {signUpForm.formState.isSubmitting ? "Creating account..." : "Sign Up"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
