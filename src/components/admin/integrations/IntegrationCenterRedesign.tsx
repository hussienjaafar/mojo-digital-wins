import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Plus, Filter, Search, ChevronRight, AlertTriangle, CheckCircle, Clock, Circle, Activity, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIntegrationSummary } from '@/hooks/useIntegrationSummary';
import { IntegrationDetailDrawer } from './IntegrationDetailDrawer';
import { CredentialSlideOver } from './CredentialSlideOver';
import { InlineHealthIndicator } from './InlineHealthIndicator';
import { IntegrationHealthStatus, IntegrationSummary, PLATFORM_ICONS } from '@/types/integrations';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

// KPI Card Component
function KPICard({ 
  label, 
  value, 
  subValue,
  icon: Icon, 
  color = 'blue',
  trend,
}: { 
  label: string; 
  value: string | number; 
  subValue?: string;
  icon: React.ElementType; 
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
  trend?: 'up' | 'down' | 'neutral';
}) {
  const colorStyles = {
    blue: 'bg-[hsl(var(--portal-accent-blue))]/10 text-[hsl(var(--portal-accent-blue))]',
    green: 'bg-[hsl(var(--portal-success))]/10 text-[hsl(var(--portal-success))]',
    yellow: 'bg-[hsl(var(--portal-warning))]/10 text-[hsl(var(--portal-warning))]',
    red: 'bg-[hsl(var(--portal-error))]/10 text-[hsl(var(--portal-error))]',
    gray: 'bg-[hsl(var(--portal-bg-tertiary))] text-[hsl(var(--portal-text-muted))]',
  };

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))]">
      <div className={cn('p-2.5 rounded-lg', colorStyles[color])}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-[hsl(var(--portal-text-primary))]">{value}</p>
        <p className="text-xs text-[hsl(var(--portal-text-muted))]">{label}</p>
        {subValue && (
          <p className="text-[10px] text-[hsl(var(--portal-text-muted))] mt-0.5">{subValue}</p>
        )}
      </div>
    </div>
  );
}

// Client Row Component
function ClientRow({ 
  summary, 
  isSelected, 
  onClick 
}: { 
  summary: IntegrationSummary; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusConfig = {
    needs_attention: { 
      dot: 'bg-[hsl(var(--portal-error))]', 
      label: 'Needs attention',
      pulse: true 
    },
    healthy: { 
      dot: 'bg-[hsl(var(--portal-success))]', 
      label: 'Healthy',
      pulse: false 
    },
    untested: { 
      dot: 'bg-[hsl(var(--portal-warning))]', 
      label: 'Untested',
      pulse: false 
    },
    no_setup: { 
      dot: 'bg-[hsl(var(--portal-text-muted))]', 
      label: 'No setup',
      pulse: false 
    },
    all_disabled: { 
      dot: 'bg-[hsl(var(--portal-text-muted))]', 
      label: 'Disabled',
      pulse: false 
    },
  };

  const config = statusConfig[summary.health_status];
  const platforms = [...new Set(summary.integrations.map(i => i.platform))];

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
        'border border-transparent',
        'hover:bg-[hsl(var(--portal-bg-elevated))]',
        isSelected && 'bg-[hsl(var(--portal-accent-blue))]/5 border-[hsl(var(--portal-accent-blue))]/30',
        summary.health_status === 'needs_attention' && !isSelected && 'border-l-2 border-l-[hsl(var(--portal-error))]'
      )}
    >
      {/* Status dot */}
      <div className="relative flex-shrink-0">
        {config.pulse && (
          <div className={cn('absolute inset-0 rounded-full animate-ping opacity-40', config.dot)} />
        )}
        <div className={cn('w-2.5 h-2.5 rounded-full', config.dot)} />
      </div>

      {/* Client info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-[hsl(var(--portal-text-primary))] truncate">
            {summary.organization_name}
          </span>
          {!summary.org_is_active && (
            <Badge variant="secondary" className="text-[10px] h-4">Inactive</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-[hsl(var(--portal-text-muted))]">
            {summary.total_count} integration{summary.total_count !== 1 ? 's' : ''}
          </span>
          {summary.error_count > 0 && (
            <span className="text-xs text-[hsl(var(--portal-error))]">
              • {summary.error_count} error{summary.error_count !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        
        {/* Inline diagnostics */}
        {summary.diagnostics && (
          <InlineHealthIndicator
            webhookFailures={summary.diagnostics.webhookStats?.failures}
            failureRate={summary.diagnostics.webhookStats?.failure_rate}
            lastError={summary.diagnostics.webhookStats?.last_error || undefined}
            daysStale={summary.diagnostics.dataFreshness?.days_stale || undefined}
          />
        )}
      </div>

      {/* Platform icons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {platforms.slice(0, 3).map((platform) => (
          <span key={platform} className="text-sm opacity-60" title={platform}>
            {PLATFORM_ICONS[platform] || '🔌'}
          </span>
        ))}
      </div>

      <ChevronRight className="h-4 w-4 text-[hsl(var(--portal-text-muted))] flex-shrink-0" />
    </button>
  );
}

export function IntegrationCenterRedesign() {
  // Filter & search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IntegrationHealthStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  
  // Detail drawer state
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  
  // Slide-over state (for adding new integrations)
  const [slideOverOpen, setSlideOverOpen] = useState(false);
  const [editingCredentialId, setEditingCredentialId] = useState<string | null>(null);
  const [preselectedOrgId, setPreselectedOrgId] = useState<string | null>(null);
  
  const { 
    data, 
    isLoading, 
    error, 
    statusCounts, 
    refetch,
    testConnection,
    toggleActive,
  } = useIntegrationSummary({
    statusFilter,
    platformFilter,
    searchQuery,
  });

  // Calculate KPIs
  const kpis = useMemo(() => {
    const totalClients = data.length;
    const totalIntegrations = data.reduce((sum, d) => sum + d.total_count, 0);
    const healthyIntegrations = data.reduce((sum, d) => sum + d.healthy_count, 0);
    const failingIntegrations = data.reduce((sum, d) => sum + d.error_count, 0);
    const healthPercentage = totalIntegrations > 0 
      ? Math.round((healthyIntegrations / totalIntegrations) * 100) 
      : 100;
    
    return { totalClients, totalIntegrations, healthyIntegrations, failingIntegrations, healthPercentage };
  }, [data]);

  // Sort data - needs attention first
  const sortedData = useMemo(() => {
    const healthPriority: Record<IntegrationHealthStatus, number> = {
      needs_attention: 0,
      untested: 1,
      no_setup: 2,
      all_disabled: 3,
      healthy: 4,
    };
    
    return [...data].sort((a, b) => 
      (healthPriority[a.health_status] ?? 5) - (healthPriority[b.health_status] ?? 5)
    );
  }, [data]);

  // Filtered data
  const filteredData = useMemo(() => {
    let filtered = sortedData;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.organization_name.toLowerCase().includes(query) ||
        d.organization_slug.toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.health_status === statusFilter);
    }
    
    return filtered;
  }, [sortedData, searchQuery, statusFilter]);

  const selectedOrg = useMemo(() => {
    return data.find(d => d.organization_id === selectedOrgId) || null;
  }, [data, selectedOrgId]);

  const handleSelectOrg = useCallback((orgId: string) => {
    setSelectedOrgId(orgId);
    setDrawerOpen(true);
  }, []);

  const handleTest = async (integrationId: string) => {
    const success = await testConnection(integrationId);
    if (success) {
      toast.success('Connection test successful');
    } else {
      toast.error('Connection test failed');
    }
    return success;
  };

  const handleToggle = async (integrationId: string, currentState: boolean) => {
    const success = await toggleActive(integrationId, currentState);
    if (success) {
      toast.success(`Integration ${currentState ? 'disabled' : 'enabled'}`);
    } else {
      toast.error('Failed to update integration');
    }
    return success;
  };

  const handleEdit = (credentialId: string) => {
    setEditingCredentialId(credentialId);
    setPreselectedOrgId(null);
    setSlideOverOpen(true);
  };

  const handleAddIntegration = (orgId?: string) => {
    setEditingCredentialId(null);
    setPreselectedOrgId(orgId || null);
    setSlideOverOpen(true);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="p-4 rounded-full bg-[hsl(var(--portal-error))]/10">
          <AlertTriangle className="h-8 w-8 text-[hsl(var(--portal-error))]" />
        </div>
        <p className="text-[hsl(var(--portal-text-secondary))]">{error}</p>
        <Button onClick={refetch} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[hsl(var(--portal-text-primary))]">
            Integration Center
          </h2>
          <p className="text-[hsl(var(--portal-text-secondary))] text-sm">
            Monitor and manage client integrations across all platforms
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={refetch} 
            disabled={isLoading}
            className="border-[hsl(var(--portal-border))]"
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => handleAddIntegration()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard 
          label="Total Clients" 
          value={kpis.totalClients}
          icon={Activity}
          color="blue"
        />
        <KPICard 
          label="Healthy" 
          value={`${kpis.healthPercentage}%`}
          subValue={`${kpis.healthyIntegrations} of ${kpis.totalIntegrations} integrations`}
          icon={CheckCircle}
          color="green"
        />
        <KPICard 
          label="Needs Attention" 
          value={statusCounts.needsAttention}
          icon={AlertTriangle}
          color={statusCounts.needsAttention > 0 ? 'red' : 'gray'}
        />
        <KPICard 
          label="Untested" 
          value={statusCounts.untested}
          icon={Clock}
          color={statusCounts.untested > 0 ? 'yellow' : 'gray'}
        />
      </div>

      {/* Health bar */}
      {kpis.totalIntegrations > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[hsl(var(--portal-text-secondary))]">Overall Health</span>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Percentage of integrations with successful last sync</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Progress 
            value={kpis.healthPercentage} 
            className="h-2 bg-[hsl(var(--portal-bg-tertiary))]"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--portal-text-muted))]" />
          <Input
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as IntegrationHealthStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-[180px] bg-[hsl(var(--portal-bg-secondary))] border-[hsl(var(--portal-border))]">
            <Filter className="h-4 w-4 mr-2 text-[hsl(var(--portal-text-muted))]" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="needs_attention">Needs attention</SelectItem>
            <SelectItem value="healthy">Healthy</SelectItem>
            <SelectItem value="untested">Untested</SelectItem>
            <SelectItem value="no_setup">No setup</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Client List */}
      <div className="rounded-xl border border-[hsl(var(--portal-border))] bg-[hsl(var(--portal-bg-card))] overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-6 w-6 animate-spin text-[hsl(var(--portal-text-muted))]" />
            <p className="text-sm text-[hsl(var(--portal-text-muted))]">Loading integrations...</p>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="p-8 flex flex-col items-center justify-center gap-3">
            <Circle className="h-8 w-8 text-[hsl(var(--portal-text-muted))]" />
            <p className="text-sm text-[hsl(var(--portal-text-muted))]">
              {searchQuery || statusFilter !== 'all' ? 'No matching clients found' : 'No clients yet'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button size="sm" variant="outline" onClick={() => handleAddIntegration()}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Integration
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--portal-border))]">
            {filteredData.map((summary) => (
              <ClientRow
                key={summary.organization_id}
                summary={summary}
                isSelected={selectedOrgId === summary.organization_id}
                onClick={() => handleSelectOrg(summary.organization_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      {!isLoading && filteredData.length > 0 && (
        <p className="text-xs text-[hsl(var(--portal-text-muted))] text-center">
          Showing {filteredData.length} of {data.length} clients
        </p>
      )}

      {/* Integration Detail Drawer */}
      <IntegrationDetailDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        organization={selectedOrg}
        onTest={handleTest}
        onToggle={handleToggle}
        onEdit={handleEdit}
        onAddIntegration={handleAddIntegration}
      />

      {/* Credential Slide-Over (for adding/editing) */}
      <CredentialSlideOver
        open={slideOverOpen}
        onOpenChange={setSlideOverOpen}
        editingCredentialId={editingCredentialId}
        preselectedOrgId={preselectedOrgId}
        onSuccess={refetch}
      />
    </div>
  );
}
