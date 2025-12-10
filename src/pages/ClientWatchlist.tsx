import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Plus, Trash2, Sparkles, Target, Building2, User, Hash, MapPin, ShieldAlert, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Session } from "@supabase/supabase-js";
import { ClientLayout } from "@/components/client/ClientLayout";
import { motion, AnimatePresence } from "framer-motion";
import {
  V3Card,
  V3CardContent,
  V3CardHeader,
  V3CardTitle,
  V3CardDescription,
  V3SectionHeader,
  V3LoadingState,
  V3EmptyState,
} from "@/components/v3";
import { cn } from "@/lib/utils";

type WatchlistItem = {
  id: string;
  entity_name: string;
  entity_type: string;
  aliases: string[];
  alert_threshold: number;
  sentiment_alerts_enabled: boolean;
  relevance_score: number;
  created_at: string;
};

type Organization = {
  id: string;
  name: string;
  logo_url: string | null;
};

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
};

const formVariants = {
  hidden: { opacity: 0, height: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
};

// Entity type configuration with icons and accents
const entityTypeConfig: Record<string, { icon: typeof Building2; accent: "blue" | "purple" | "green" | "amber" | "red" }> = {
  organization: { icon: Building2, accent: "blue" },
  person: { icon: User, accent: "purple" },
  topic: { icon: Hash, accent: "green" },
  location: { icon: MapPin, accent: "amber" },
  opposition: { icon: ShieldAlert, accent: "red" },
  issue: { icon: FileText, accent: "blue" },
};

const ClientWatchlist = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    entity_name: "",
    entity_type: "organization",
    aliases: "",
    alert_threshold: 70,
    sentiment_alerts_enabled: true,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (!session) {
        navigate("/client-login");
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/client-login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      loadData();
    }
  }, [session]);

  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load organization
      const { data: clientUser } = await (supabase as any)
        .from('client_users')
        .select('organization_id')
        .eq('id', session?.user?.id)
        .maybeSingle();

      if (!clientUser) throw new Error("Organization not found");

      const { data: org } = await (supabase as any)
        .from('client_organizations')
        .select('*')
        .eq('id', clientUser.organization_id)
        .maybeSingle();

      setOrganization(org);

      // Load watchlist
      const { data: watchlistData, error } = await (supabase as any)
        .from('entity_watchlist')
        .select('*')
        .eq('organization_id', clientUser.organization_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setWatchlist(watchlistData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEntity = async () => {
    if (!organization || !formData.entity_name) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await (supabase as any)
        .from('entity_watchlist')
        .insert({
          organization_id: organization.id,
          entity_name: formData.entity_name,
          entity_type: formData.entity_type,
          aliases: formData.aliases ? formData.aliases.split(',').map((a: string) => a.trim()) : [],
          alert_threshold: formData.alert_threshold,
          sentiment_alerts_enabled: formData.sentiment_alerts_enabled,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Entity added to watchlist",
      });

      setFormData({
        entity_name: "",
        entity_type: "organization",
        aliases: "",
        alert_threshold: 70,
        sentiment_alerts_enabled: true,
      });
      setShowForm(false);
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteEntity = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('entity_watchlist')
        .update({ is_active: false })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Entity removed from watchlist",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleSentimentAlerts = async (id: string, current: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('entity_watchlist')
        .update({ sentiment_alerts_enabled: !current })
        .eq('id', id);

      if (error) throw error;
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getEntityConfig = (type: string) => {
    return entityTypeConfig[type] || entityTypeConfig.organization;
  };

  if (isLoading) {
    return (
      <ClientLayout>
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-6">
          <V3LoadingState variant="channel" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <V3LoadingState variant="kpi" />
            <V3LoadingState variant="kpi" />
            <V3LoadingState variant="kpi" />
          </div>
        </div>
      </ClientLayout>
    );
  }

  if (!organization) {
    return (
      <ClientLayout>
        <div className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6">
          <V3EmptyState
            icon={Target}
            title="Organization Not Found"
            description="Unable to load your organization details. Please try refreshing the page."
            accent="red"
          />
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout>
      <motion.div
        className="container mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 space-y-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Page Header */}
        <motion.div variants={itemVariants}>
          <V3SectionHeader
            title="Entity Watchlist"
            subtitle="Track organizations, people, topics, and issues relevant to your mission"
            icon={Target}
            size="lg"
          />
        </motion.div>

        {/* Add Entity Section */}
        <motion.div variants={itemVariants}>
          <V3Card accent="blue">
            <V3CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <motion.div
                    className="p-2.5 rounded-lg bg-[hsl(var(--portal-accent-blue)/0.1)]"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                  >
                    <Sparkles className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" aria-hidden="true" />
                  </motion.div>
                  <div>
                    <V3CardTitle>Add New Entity</V3CardTitle>
                    <V3CardDescription>
                      Monitor real-time news and social media mentions
                    </V3CardDescription>
                  </div>
                </div>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Button
                    onClick={() => setShowForm(!showForm)}
                    className="min-h-[44px] gap-2 bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.9)] text-white"
                  >
                    <Plus className="h-4 w-4" />
                    Add Entity
                  </Button>
                </motion.div>
              </div>
            </V3CardHeader>

            <AnimatePresence>
              {showForm && (
                <motion.div
                  variants={formVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                >
                  <V3CardContent className="border-t border-[hsl(var(--portal-border))]">
                    <div className="grid gap-4 pt-4">
                      <div>
                        <Label htmlFor="entity_name" className="text-[hsl(var(--portal-text-primary))]">
                          Entity Name *
                        </Label>
                        <Input
                          id="entity_name"
                          value={formData.entity_name}
                          onChange={(e) => setFormData({ ...formData, entity_name: e.target.value })}
                          placeholder="e.g., ACLU, John Doe, Climate Change"
                          className="mt-1.5 border-[hsl(var(--portal-border))] focus:border-[hsl(var(--portal-accent-blue))]"
                        />
                      </div>

                      <div>
                        <Label htmlFor="entity_type" className="text-[hsl(var(--portal-text-primary))]">
                          Entity Type
                        </Label>
                        <Select
                          value={formData.entity_type}
                          onValueChange={(value) => setFormData({ ...formData, entity_type: value })}
                        >
                          <SelectTrigger className="mt-1.5 min-h-[44px] border-[hsl(var(--portal-border))]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="organization">Organization</SelectItem>
                            <SelectItem value="person">Person</SelectItem>
                            <SelectItem value="topic">Topic</SelectItem>
                            <SelectItem value="location">Location</SelectItem>
                            <SelectItem value="opposition">Opposition</SelectItem>
                            <SelectItem value="issue">Issue</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor="aliases" className="text-[hsl(var(--portal-text-primary))]">
                          Aliases (comma-separated)
                        </Label>
                        <Input
                          id="aliases"
                          value={formData.aliases}
                          onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                          placeholder="e.g., ACLU, American Civil Liberties Union"
                          className="mt-1.5 border-[hsl(var(--portal-border))] focus:border-[hsl(var(--portal-accent-blue))]"
                        />
                      </div>

                      <div>
                        <Label className="text-[hsl(var(--portal-text-primary))]">
                          Alert Threshold: <span className="font-bold text-[hsl(var(--portal-accent-blue))]">{formData.alert_threshold}%</span>
                        </Label>
                        <Slider
                          value={[formData.alert_threshold]}
                          onValueChange={([value]) => setFormData({ ...formData, alert_threshold: value })}
                          min={0}
                          max={100}
                          step={5}
                          className="mt-2"
                        />
                        <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
                          Receive alerts when relevance score exceeds this threshold
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="sentiment"
                            checked={formData.sentiment_alerts_enabled}
                            onChange={(e) => setFormData({ ...formData, sentiment_alerts_enabled: e.target.checked })}
                            className="rounded border-[hsl(var(--portal-border))] text-[hsl(var(--portal-accent-blue))] focus:ring-[hsl(var(--portal-accent-blue))]"
                          />
                          <Label htmlFor="sentiment" className="cursor-pointer text-[hsl(var(--portal-text-secondary))]">
                            Enable sentiment alerts
                          </Label>
                        </div>
                        <div className="flex gap-2">
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              variant="outline"
                              onClick={() => setShowForm(false)}
                              className="min-h-[44px] border-[hsl(var(--portal-border))]"
                            >
                              Cancel
                            </Button>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              onClick={handleAddEntity}
                              className="min-h-[44px] gap-2 bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue)/0.9)] text-white"
                            >
                              <Sparkles className="h-4 w-4" />
                              Add to Watchlist
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  </V3CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </V3Card>
        </motion.div>

        {/* Watchlist Items */}
        {watchlist.length === 0 ? (
          <motion.div variants={itemVariants}>
            <V3EmptyState
              icon={Target}
              title="Start Your Entity Watchlist"
              description="Track mentions of key politicians, organizations, policies, and issues in real-time news and social media. Get instant alerts when your entities are trending or mentioned in breaking news."
              accent="purple"
            />
            <motion.p
              className="text-center text-sm text-[hsl(var(--portal-text-muted))] mt-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              Click "Add Entity" above to get started
            </motion.p>
          </motion.div>
        ) : (
          <motion.div
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
            variants={containerVariants}
          >
            {watchlist.map((item, index) => {
              const config = getEntityConfig(item.entity_type);
              const EntityIcon = config.icon;

              return (
                <motion.div
                  key={item.id}
                  variants={itemVariants}
                  layout
                >
                  <V3Card
                    accent={config.accent}
                    className="h-full hover:shadow-lg transition-shadow duration-200"
                  >
                    <V3CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <motion.div
                            className={cn(
                              "p-2 rounded-lg shrink-0",
                              config.accent === "blue" && "bg-[hsl(var(--portal-accent-blue)/0.1)]",
                              config.accent === "purple" && "bg-[hsl(var(--portal-accent-purple)/0.1)]",
                              config.accent === "green" && "bg-[hsl(var(--portal-success)/0.1)]",
                              config.accent === "amber" && "bg-[hsl(var(--portal-warning)/0.1)]",
                              config.accent === "red" && "bg-[hsl(var(--portal-error)/0.1)]"
                            )}
                            whileHover={{ scale: 1.1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                          >
                            <EntityIcon className={cn(
                              "h-4 w-4",
                              config.accent === "blue" && "text-[hsl(var(--portal-accent-blue))]",
                              config.accent === "purple" && "text-[hsl(var(--portal-accent-purple))]",
                              config.accent === "green" && "text-[hsl(var(--portal-success))]",
                              config.accent === "amber" && "text-[hsl(var(--portal-warning))]",
                              config.accent === "red" && "text-[hsl(var(--portal-error))]"
                            )} />
                          </motion.div>
                          <div className="min-w-0 flex-1">
                            <V3CardTitle className="text-lg truncate">
                              {item.entity_name}
                            </V3CardTitle>
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-xs capitalize",
                                  config.accent === "blue" && "border-[hsl(var(--portal-accent-blue)/0.3)] text-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-accent-blue)/0.05)]",
                                  config.accent === "purple" && "border-[hsl(var(--portal-accent-purple)/0.3)] text-[hsl(var(--portal-accent-purple))] bg-[hsl(var(--portal-accent-purple)/0.05)]",
                                  config.accent === "green" && "border-[hsl(var(--portal-success)/0.3)] text-[hsl(var(--portal-success))] bg-[hsl(var(--portal-success)/0.05)]",
                                  config.accent === "amber" && "border-[hsl(var(--portal-warning)/0.3)] text-[hsl(var(--portal-warning))] bg-[hsl(var(--portal-warning)/0.05)]",
                                  config.accent === "red" && "border-[hsl(var(--portal-error)/0.3)] text-[hsl(var(--portal-error))] bg-[hsl(var(--portal-error)/0.05)]"
                                )}
                              >
                                {item.entity_type}
                              </Badge>
                              {item.relevance_score > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="text-xs bg-[hsl(var(--portal-bg-elevated))] text-[hsl(var(--portal-text-secondary))]"
                                >
                                  Score: {item.relevance_score}%
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </V3CardHeader>
                    <V3CardContent>
                      <div className="space-y-3">
                        {item.aliases && item.aliases.length > 0 && (
                          <div>
                            <p className="text-xs text-[hsl(var(--portal-text-muted))] mb-1.5">Aliases:</p>
                            <div className="flex flex-wrap gap-1">
                              {item.aliases.map((alias, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-xs border-[hsl(var(--portal-border))] text-[hsl(var(--portal-text-secondary))]"
                                >
                                  {alias}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[hsl(var(--portal-text-muted))]">Alert threshold:</span>
                          <span className="font-medium text-[hsl(var(--portal-text-primary))] tabular-nums">
                            {item.alert_threshold}%
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-[hsl(var(--portal-border))]">
                          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleSentimentAlerts(item.id, item.sentiment_alerts_enabled)}
                              className={cn(
                                "min-h-[44px] gap-2 transition-colors",
                                item.sentiment_alerts_enabled
                                  ? "text-[hsl(var(--portal-success))] hover:text-[hsl(var(--portal-success))] hover:bg-[hsl(var(--portal-success)/0.1)]"
                                  : "text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-text-secondary))]"
                              )}
                            >
                              {item.sentiment_alerts_enabled ? (
                                <>
                                  <Eye className="h-4 w-4" />
                                  Alerts On
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-4 w-4" />
                                  Alerts Off
                                </>
                              )}
                            </Button>
                          </motion.div>
                          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteEntity(item.id)}
                              className="text-[hsl(var(--portal-error))] hover:text-[hsl(var(--portal-error))] hover:bg-[hsl(var(--portal-error)/0.1)] min-h-[44px] min-w-[44px]"
                              aria-label="Delete entity"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </motion.div>
                        </div>
                      </div>
                    </V3CardContent>
                  </V3Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </ClientLayout>
  );
};

export default ClientWatchlist;
