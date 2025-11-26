import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Globe, RefreshCw, Sparkles, CheckCircle, AlertCircle } from "lucide-react";

interface OrganizationProfile {
  id: string;
  organization_id: string;
  website_url: string | null;
  mission_summary: string | null;
  focus_areas: string[] | null;
  key_issues: string[] | null;
  scraped_at: string | null;
}

interface SuggestedEntity {
  entity_name: string;
  entity_type: string;
  ai_relevance_score: number;
}

export default function OrganizationProfile() {
  const [profile, setProfile] = useState<OrganizationProfile | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestedEntities, setSuggestedEntities] = useState<SuggestedEntity[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientUser } = await supabase
        .from("client_users")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!clientUser) return;

      const { data, error } = await supabase
        .from("organization_profiles")
        .select("*")
        .eq("organization_id", clientUser.organization_id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfile(data);
        setWebsiteUrl(data.website_url || "");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeWebsite = async () => {
    if (!websiteUrl || !websiteUrl.startsWith('http')) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid website URL starting with http:// or https://",
        variant: "destructive",
      });
      return;
    }

    setAnalyzing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: clientUser } = await supabase
        .from("client_users")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!clientUser) throw new Error("Organization not found");

      const { data, error } = await supabase.functions.invoke("scrape-organization-website", {
        body: {
          organizationId: clientUser.organization_id,
          websiteUrl,
        },
      });

      if (error) throw error;

      if (data.error) {
        if (data.error.includes('Rate limited')) {
          toast({
            title: "Rate Limited",
            description: "Too many requests. Please try again in a few minutes.",
            variant: "destructive",
          });
          return;
        }
        if (data.error.includes('Payment required')) {
          toast({
            title: "Credits Required",
            description: "Please add Lovable AI credits to continue.",
            variant: "destructive",
          });
          return;
        }
        throw new Error(data.error);
      }

      setSuggestedEntities(data.suggestedEntities || []);
      
      toast({
        title: "Analysis Complete",
        description: "Your organization profile has been updated with AI insights.",
      });

      fetchProfile();
    } catch (error: any) {
      console.error("Error analyzing website:", error);
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze website",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const addToWatchlist = async (entity: SuggestedEntity) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: clientUser } = await supabase
        .from("client_users")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!clientUser) return;

      const { error } = await supabase
        .from("entity_watchlist")
        .insert({
          organization_id: clientUser.organization_id,
          entity_name: entity.entity_name,
          entity_type: entity.entity_type,
          ai_relevance_score: entity.ai_relevance_score,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Already Added",
            description: "This entity is already in your watchlist",
            variant: "default",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Added to Watchlist",
        description: `${entity.entity_name} has been added to your watchlist`,
      });

      setSuggestedEntities(entities => 
        entities.filter(e => e.entity_name !== entity.entity_name)
      );
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      toast({
        title: "Error",
        description: "Failed to add entity to watchlist",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Loading profile...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Organization Profile
          </CardTitle>
          <CardDescription>
            Let AI analyze your website to understand your mission and suggest relevant entities to track
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="website">Organization Website</Label>
            <div className="flex gap-2">
              <Input
                id="website"
                type="url"
                placeholder="https://yourorganization.org"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                disabled={analyzing}
              />
              <Button
                onClick={analyzeWebsite}
                disabled={analyzing || !websiteUrl}
                className="min-w-32"
              >
                {analyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              AI will extract your mission, focus areas, and key issues
            </p>
          </div>

          {profile && (
            <div className="space-y-4 pt-4 border-t">
              {profile.mission_summary && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Mission</h4>
                  <p className="text-sm text-muted-foreground">{profile.mission_summary}</p>
                </div>
              )}

              {profile.focus_areas && profile.focus_areas.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Focus Areas</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.focus_areas.map((area, idx) => (
                      <Badge key={idx} variant="secondary">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {profile.key_issues && profile.key_issues.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-foreground mb-2">Key Issues</h4>
                  <div className="flex flex-wrap gap-2">
                    {profile.key_issues.map((issue, idx) => (
                      <Badge key={idx} variant="outline">
                        {issue}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {profile.scraped_at && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle className="h-3 w-3" />
                  Last updated: {new Date(profile.scraped_at).toLocaleDateString()}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {suggestedEntities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Suggested Watchlist Entities
            </CardTitle>
            <CardDescription>
              Based on your organization's profile, we recommend tracking these entities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Click "Add to Watchlist" to start monitoring any of these suggested entities
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              {suggestedEntities.map((entity, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-foreground">{entity.entity_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Type: {entity.entity_type} • Relevance: {entity.ai_relevance_score}%
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => addToWatchlist(entity)}
                  >
                    Add to Watchlist
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
