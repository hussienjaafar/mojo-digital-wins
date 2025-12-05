import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, BarChart3 } from "lucide-react";

const ClientLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        checkClientUser(session.user.id);
      }
    });
  }, []);

  const checkClientUser = async (userId: string) => {
    const { data } = await (supabase as any)
      .from('client_users')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      navigate('/client/dashboard');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        // Update last login
        await (supabase as any)
          .from('client_users')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', data.user.id);

        toast({
          title: "Success",
          description: "Logged in successfully",
        });

        navigate('/client/dashboard');
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to log in",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="portal-theme min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--portal-bg-primary))] via-[hsl(var(--portal-bg-secondary))] to-[hsl(var(--portal-accent-blue)/0.1)] p-4">
      <Card className="w-full max-w-md border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-secondary))] backdrop-blur shadow-lg">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-[hsl(var(--portal-accent-blue)/0.1)] flex items-center justify-center mb-2">
            <BarChart3 className="w-6 h-6 text-[hsl(var(--portal-accent-blue))]" />
          </div>
          <CardTitle className="text-2xl text-[hsl(var(--portal-text-primary))]">Client Portal</CardTitle>
          <CardDescription className="text-[hsl(var(--portal-text-secondary))]">
            Access your campaign metrics and analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-[hsl(var(--portal-text-primary))]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))] placeholder:text-[hsl(var(--portal-text-muted))]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-[hsl(var(--portal-text-primary))]">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="bg-[hsl(var(--portal-bg-tertiary))] border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-primary))] placeholder:text-[hsl(var(--portal-text-muted))]"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                  ) : (
                    <Eye className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                  )}
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))] text-white" disabled={isLoading}>
              {isLoading ? "Logging in..." : "Log In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientLogin;
