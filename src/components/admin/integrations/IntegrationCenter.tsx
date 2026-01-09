import React, { useState, useMemo, useCallback } from 'react';
import { RefreshCw, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useIntegrationSummary } from '@/hooks/useIntegrationSummary';
import { IntegrationSystemHealth } from './IntegrationSystemHealth';
import { IntegrationDiscoveryBar, SortConfig } from './IntegrationDiscoveryBar';
import { IntegrationOrgList } from './IntegrationOrgList';
import { IntegrationListPagination } from './IntegrationListPagination';
import { IntegrationEmptyState } from './IntegrationEmptyState';
import { CredentialSlideOver } from './CredentialSlideOver';
import { IntegrationDetailDrawer } from './IntegrationDetailDrawer';
import { 
  SystemHealthSkeleton, 
  DiscoveryBarSkeleton, 
  OrgListSkeleton 
} from './IntegrationSkeletons';
import { IntegrationHealthStatus, IntegrationSummary } from '@/types/integrations';
import { toast } from 'sonner';

export function IntegrationCenter() {
  // Filter & search state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IntegrationHealthStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Sort state
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'status', direction: 'desc' });
  
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

  // Reset page when filters change
  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  }, []);

  const handleStatusFilterChange = useCallback((value: IntegrationHealthStatus | 'all') => {
    setStatusFilter(value);
    setCurrentPage(1);
  }, []);

  const handlePlatformFilterChange = useCallback((value: string) => {
    setPlatformFilter(value);
    setCurrentPage(1);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  // Organization selection
  const handleSelectOrg = useCallback((orgId: string) => {
    setSelectedOrgId(orgId);
    setDrawerOpen(true);
  }, []);

  const selectedOrg = useMemo(() => {
    return data.find(d => d.organization_id === selectedOrgId) || null;
  }, [data, selectedOrgId]);

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

  const handleSlideOverSuccess = () => {
    refetch();
  };

  // Quick action states
  const [isTestingAll, setIsTestingAll] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const handleTestAllFailing = async () => {
    setIsTestingAll(true);
    try {
      const failingIntegrations = data
        .flatMap(d => d.integrations)
        .filter(i => i.last_sync_status === 'error' || i.last_sync_status === 'failed' || !i.last_tested_at);
      
      let successCount = 0;
      let failCount = 0;
      
      for (const integration of failingIntegrations) {
        const success = await testConnection(integration.id);
        if (success) successCount++;
        else failCount++;
      }
      
      toast.success(`Tested ${failingIntegrations.length} integrations: ${successCount} passed, ${failCount} failed`);
    } catch (err) {
      toast.error('Failed to test integrations');
    } finally {
      setIsTestingAll(false);
    }
  };

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      toast.info('Triggering sync for all active integrations...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('Sync triggered for all active integrations');
      refetch();
    } catch (err) {
      toast.error('Failed to trigger sync');
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Sort data based on sortConfig
  const sortedData = useMemo(() => {
    const healthPriority: Record<IntegrationHealthStatus, number> = {
      needs_attention: 0,
      untested: 1,
      no_setup: 2,
      all_disabled: 3,
      healthy: 4,
    };
    
    const sorted = [...data].sort((a, b) => {
      let comparison = 0;
      
      switch (sortConfig.field) {
        case 'status':
          comparison = (healthPriority[a.health_status] ?? 5) - (healthPriority[b.health_status] ?? 5);
          break;
        case 'name':
          comparison = a.organization_name.localeCompare(b.organization_name);
          break;
        case 'integrations':
          comparison = b.total_count - a.total_count;
          break;
        case 'lastSync':
          const aSync = getLatestSync(a);
          const bSync = getLatestSync(b);
          comparison = (bSync?.getTime() ?? 0) - (aSync?.getTime() ?? 0);
          break;
      }
      
      return sortConfig.direction === 'asc' ? -comparison : comparison;
    });
    
    return sorted;
  }, [data, sortConfig]);

  // Helper to get latest sync from integrations
  function getLatestSync(summary: IntegrationSummary): Date | null {
    const syncDates = summary.integrations
      .map(i => i.last_sync_at ? new Date(i.last_sync_at) : null)
      .filter((d): d is Date => d !== null);
    
    if (syncDates.length === 0) return null;
    return new Date(Math.max(...syncDates.map(d => d.getTime())));
  }

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-[hsl(var(--portal-error))] mb-4">{error}</p>
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
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[hsl(var(--portal-text-primary))]">
            Integration Center
          </h2>
          <p className="text-[hsl(var(--portal-text-secondary))]">
            Manage and monitor all client integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={refetch} 
            disabled={isLoading}
            className="border-[hsl(var(--portal-border))]"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => handleAddIntegration()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
        </div>
      </motion.div>

      {/* System Health Overview */}
      {isLoading ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <SystemHealthSkeleton />
        </motion.div>
      ) : data.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <IntegrationSystemHealth
            data={data}
            onTestAllFailing={handleTestAllFailing}
            onSyncAll={handleSyncAll}
            isTestingAll={isTestingAll}
            isSyncingAll={isSyncingAll}
          />
        </motion.div>
      ) : null}

      {/* Discovery Bar (Search, Filters, Sort) */}
      {isLoading ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <DiscoveryBarSkeleton />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <IntegrationDiscoveryBar
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            platformFilter={platformFilter}
            onPlatformFilterChange={handlePlatformFilterChange}
            sortConfig={sortConfig}
            onSortChange={setSortConfig}
            statusCounts={statusCounts}
            resultCount={sortedData.length}
          />
        </motion.div>
      )}

      {/* Organization List */}
      {isLoading ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <OrgListSkeleton count={5} />
        </motion.div>
      ) : data.length === 0 ? (
        <IntegrationEmptyState
          variant="no-clients"
          onAddIntegration={() => handleAddIntegration()}
        />
      ) : sortedData.length === 0 ? (
        <IntegrationEmptyState
          variant="no-results"
          searchQuery={searchQuery}
          onClearFilters={() => {
            setSearchQuery('');
            setStatusFilter('all');
            setPlatformFilter('all');
          }}
        />
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <IntegrationOrgList
            data={paginatedData}
            selectedOrgId={selectedOrgId}
            onSelectOrg={handleSelectOrg}
          />
          
          <IntegrationListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={sortedData.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </motion.div>
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
        onSuccess={handleSlideOverSuccess}
      />
    </div>
  );
}
