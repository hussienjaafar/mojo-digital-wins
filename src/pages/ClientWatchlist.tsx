import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  Plus,
  Sparkles,
  Target,
  Building2,
  User,
  Hash,
  MapPin,
  ShieldAlert,
  FileText,
  Bell,
  BarChart2,
  AlertCircle,
  X,
} from "lucide-react";

import { ClientShell } from "@/components/client/ClientShell";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { WatchlistEntityCard } from "@/components/client/WatchlistEntityCard";
import { useClientOrganization } from "@/hooks/useClientOrganization";
import {
  useWatchlistQuery,
  useAddWatchlistEntity,
  useDeleteWatchlistEntity,
  useToggleSentimentAlerts,
  type EntityType,
} from "@/queries/useWatchlistQuery";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ============================================================================
// Types & Constants
// ============================================================================

const ENTITY_TYPES: { value: EntityType; label: string; icon: typeof Building2 }[] = [
  { value: "organization", label: "Organization", icon: Building2 },
  { value: "person", label: "Person", icon: User },
  { value: "topic", label: "Topic", icon: Hash },
  { value: "location", label: "Location", icon: MapPin },
  { value: "opposition", label: "Opposition", icon: ShieldAlert },
  { value: "issue", label: "Issue", icon: FileText },
];

const formVariants = {
  hidden: { opacity: 0, height: 0, marginTop: 0 },
  visible: {
    opacity: 1,
    height: "auto",
    marginTop: 16,
    transition: { duration: 0.3, ease: [0, 0, 0.2, 1] as const },
  },
  exit: {
    opacity: 0,
    height: 0,
    marginTop: 0,
    transition: { duration: 0.2, ease: [0, 0, 0.2, 1] as const },
  },
};

// ============================================================================
// Sub-components
// ============================================================================

interface MetricChipProps {
  label: string;
  value: string | number;
  icon: typeof Target;
  variant?: "default" | "success" | "warning" | "info";
}

const MetricChip = ({ label, value, icon: Icon, variant = "default" }: MetricChipProps) => {
  const variantStyles = {
    default: "bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-primary))]",
    success: "bg-[hsl(var(--portal-success)/0.1)] text-[hsl(var(--portal-success))]",
    warning: "bg-[hsl(var(--portal-warning)/0.1)] text-[hsl(var(--portal-warning))]",
    info: "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]",
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg",
        variantStyles[variant]
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col">
        <span className="text-xs text-[hsl(var(--portal-text-muted))]">{label}</span>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
    </div>
  );
};

interface FilterPillProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  count?: number;
}

const FilterPill = ({ label, isActive, onClick, count }: FilterPillProps) => (
  <button
    onClick={onClick}
    className={cn(
      "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
      "border focus:outline-none focus:ring-2 focus:ring-[hsl(var(--portal-accent-blue)/0.5)]",
      isActive
        ? "bg-[hsl(var(--portal-accent-blue))] text-white border-transparent"
        : "bg-transparent text-[hsl(var(--portal-text-secondary))] border-[hsl(var(--portal-border))] hover:border-[hsl(var(--portal-border-hover))]"
    )}
    aria-pressed={isActive}
  >
    {label}
    {count !== undefined && (
      <span className={cn("ml-1.5", isActive ? "opacity-80" : "opacity-60")}>
        ({count})
      </span>
    )}
  </button>
);

// ============================================================================
// Main Component
// ============================================================================

const ClientWatchlist = () => {
  const { toast } = useToast();
  const { organizationId, isLoading: orgLoading } = useClientOrganization();

  // Query and mutations
  const { data, isLoading, error, refetch } = useWatchlistQuery(organizationId);
  const addMutation = useAddWatchlistEntity(organizationId);
  const deleteMutation = useDeleteWatchlistEntity(organizationId);
  const toggleMutation = useToggleSentimentAlerts(organizationId);

  // Local state
  const [showForm, setShowForm] = useState(false);
  const [filterType, setFilterType] = useState<EntityType | "all">("all");
  const [formData, setFormData] = useState({
    entity_name: "",
    entity_type: "organization" as EntityType,
    aliases: "",
    alert_threshold: 70,
    sentiment_alerts_enabled: true,
  });

  // Handlers
  const handleAddEntity = useCallback(async () => {
    if (!formData.entity_name.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter an entity name",
        variant: "destructive",
      });
      return;
    }

    try {
      await addMutation.mutateAsync({
        entity_name: formData.entity_name.trim(),
        entity_type: formData.entity_type,
        aliases: formData.aliases
          ? formData.aliases.split(",").map((a) => a.trim()).filter(Boolean)
          : [],
        alert_threshold: formData.alert_threshold,
        sentiment_alerts_enabled: formData.sentiment_alerts_enabled,
      });

      toast({
        title: "Entity Added",
        description: `"${formData.entity_name}" has been added to your watchlist`,
      });

      // Reset form
      setFormData({
        entity_name: "",
        entity_type: "organization",
        aliases: "",
        alert_threshold: 70,
        sentiment_alerts_enabled: true,
      });
      setShowForm(false);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to add entity",
        variant: "destructive",
      });
    }
  }, [formData, addMutation, toast]);

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteMutation.mutateAsync(id);
        toast({
          title: "Entity Removed",
          description: "Entity has been removed from your watchlist",
        });
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to remove entity",
          variant: "destructive",
        });
      }
    },
    [deleteMutation, toast]
  );

  const handleToggleSentiment = useCallback(
    async (id: string, current: boolean) => {
      try {
        await toggleMutation.mutateAsync({ entityId: id, enabled: !current });
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to update alerts",
          variant: "destructive",
        });
      }
    },
    [toggleMutation, toast]
  );

  // Filter entities
  const filteredEntities =
    data?.entities.filter(
      (e) => filterType === "all" || e.entity_type === filterType
    ) || [];

  const stats = data?.stats;
  const isPageLoading = orgLoading || isLoading;

  return (
    <ClientShell pageTitle="Watchlist & Alerts" showDateControls={false}>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
        {/* Hero Panel */}
        <ChartPanel
          title="Entity Watchlist"
          description="Track organizations, people, topics, and issues relevant to your mission"
          icon={Target}
          isLoading={isPageLoading}
          error={error}
          onRetry={refetch}
          actions={
            <div className="flex items-center gap-2">
              <Link to="/client/alerts">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 border-[hsl(var(--portal-border))] hover:bg-[hsl(var(--portal-bg-hover))]"
                >
                  <Bell className="h-4 w-4" />
                  <span className="hidden sm:inline">View Alerts</span>
                </Button>
              </Link>
              <Button
                onClick={() => setShowForm(!showForm)}
                size="sm"
                className="gap-2 bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))] text-white"
              >
                {showForm ? (
                  <>
                    <X className="h-4 w-4" />
                    <span className="hidden sm:inline">Cancel</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Entity</span>
                  </>
                )}
              </Button>
            </div>
          }
          minHeight={120}
        >
          {/* Hero Metrics */}
          <div className="flex flex-wrap gap-3">
            <MetricChip
              label="Total Entities"
              value={stats?.totalEntities ?? 0}
              icon={Eye}
              variant="info"
            />
            <MetricChip
              label="Sentiment Alerts"
              value={stats?.sentimentAlertsEnabled ?? 0}
              icon={Bell}
              variant="success"
            />
            <MetricChip
              label="Avg Threshold"
              value={`${stats?.averageThreshold ?? 0}%`}
              icon={BarChart2}
              variant="default"
            />
          </div>

          {/* Add Entity Form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                variants={formVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="overflow-hidden"
              >
                <div className="p-4 rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-tertiary)/0.5)]">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-[hsl(var(--portal-accent-blue))]" />
                    <h3 className="font-semibold text-[hsl(var(--portal-text-primary))]">
                      Add New Entity
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label
                        htmlFor="entity_name"
                        className="text-[hsl(var(--portal-text-primary))]"
                      >
                        Entity Name <span className="text-[hsl(var(--portal-error))]">*</span>
                      </Label>
                      <Input
                        id="entity_name"
                        value={formData.entity_name}
                        onChange={(e) =>
                          setFormData({ ...formData, entity_name: e.target.value })
                        }
                        placeholder="e.g., ACLU, John Doe"
                        className="border-[hsl(var(--portal-border))] focus:border-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-bg-elevated))]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label
                        htmlFor="entity_type"
                        className="text-[hsl(var(--portal-text-primary))]"
                      >
                        Entity Type
                      </Label>
                      <Select
                        value={formData.entity_type}
                        onValueChange={(value: EntityType) =>
                          setFormData({ ...formData, entity_type: value })
                        }
                      >
                        <SelectTrigger
                          id="entity_type"
                          className="border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-elevated))]"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ENTITY_TYPES.map(({ value, label, icon: Icon }) => (
                            <SelectItem key={value} value={value}>
                              <div className="flex items-center gap-2">
                                <Icon className="h-4 w-4" />
                                {label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2 sm:col-span-2">
                      <Label
                        htmlFor="aliases"
                        className="text-[hsl(var(--portal-text-primary))]"
                      >
                        Aliases (comma-separated)
                      </Label>
                      <Input
                        id="aliases"
                        value={formData.aliases}
                        onChange={(e) =>
                          setFormData({ ...formData, aliases: e.target.value })
                        }
                        placeholder="e.g., American Civil Liberties Union, ACLU Foundation"
                        className="border-[hsl(var(--portal-border))] focus:border-[hsl(var(--portal-accent-blue))] bg-[hsl(var(--portal-bg-elevated))]"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-[hsl(var(--portal-text-primary))]">
                        Alert Threshold:{" "}
                        <span className="font-bold text-[hsl(var(--portal-accent-blue))]">
                          {formData.alert_threshold}%
                        </span>
                      </Label>
                      <Slider
                        value={[formData.alert_threshold]}
                        onValueChange={([value]) =>
                          setFormData({ ...formData, alert_threshold: value })
                        }
                        min={0}
                        max={100}
                        step={5}
                        className="py-2"
                      />
                      <p className="text-xs text-[hsl(var(--portal-text-muted))]">
                        Receive alerts when relevance score exceeds this threshold
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="sentiment_alerts"
                        checked={formData.sentiment_alerts_enabled}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            sentiment_alerts_enabled: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-[hsl(var(--portal-border))] text-[hsl(var(--portal-accent-blue))] focus:ring-[hsl(var(--portal-accent-blue))]"
                      />
                      <Label
                        htmlFor="sentiment_alerts"
                        className="cursor-pointer text-[hsl(var(--portal-text-secondary))]"
                      >
                        Enable sentiment alerts
                      </Label>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setShowForm(false)}
                      className="border-[hsl(var(--portal-border))]"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleAddEntity}
                      disabled={addMutation.isPending}
                      className="gap-2 bg-[hsl(var(--portal-accent-blue))] hover:bg-[hsl(var(--portal-accent-blue-hover))] text-white"
                    >
                      <Sparkles className="h-4 w-4" />
                      {addMutation.isPending ? "Adding..." : "Add to Watchlist"}
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </ChartPanel>

        {/* Watchlist Panel */}
        <ChartPanel
          title="Monitored Entities"
          description={`${filteredEntities.length} ${filterType === "all" ? "entities" : filterType + "s"} being tracked`}
          icon={Eye}
          isLoading={isPageLoading}
          isEmpty={data?.entities.length === 0}
          emptyMessage="No entities in your watchlist yet. Click 'Add Entity' above to start tracking."
          minHeight={300}
        >
          {/* Filter Pills */}
          {data && data.entities.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4 pb-4 border-b border-[hsl(var(--portal-border)/0.5)]">
              <FilterPill
                label="All"
                isActive={filterType === "all"}
                onClick={() => setFilterType("all")}
                count={data.entities.length}
              />
              {ENTITY_TYPES.filter((t) => (stats?.byType[t.value] ?? 0) > 0).map(
                ({ value, label }) => (
                  <FilterPill
                    key={value}
                    label={label}
                    isActive={filterType === value}
                    onClick={() => setFilterType(value)}
                    count={stats?.byType[value] ?? 0}
                  />
                )
              )}
            </div>
          )}

          {/* Entity Grid */}
          {filteredEntities.length > 0 && (
            <ScrollArea className="h-[500px] pr-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence mode="popLayout">
                  {filteredEntities.map((entity) => (
                    <WatchlistEntityCard
                      key={entity.id}
                      entity={entity}
                      onToggleSentiment={handleToggleSentiment}
                      onDelete={handleDelete}
                      isDeleting={deleteMutation.isPending}
                      isToggling={toggleMutation.isPending}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          )}

          {/* Empty filtered state */}
          {data && data.entities.length > 0 && filteredEntities.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-12 w-12 text-[hsl(var(--portal-text-muted))] mb-4" />
              <p className="text-[hsl(var(--portal-text-secondary))]">
                No {filterType} entities found
              </p>
              <Button
                variant="link"
                onClick={() => setFilterType("all")}
                className="mt-2 text-[hsl(var(--portal-accent-blue))]"
              >
                Show all entities
              </Button>
            </div>
          )}
        </ChartPanel>
      </div>
    </ClientShell>
  );
};

export default ClientWatchlist;
