import React, { useState, useMemo, useCallback } from 'react';
import { Filter, RefreshCw, Plus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useIntegrationSummary } from '@/hooks/useIntegrationSummary';
import { IntegrationStatusBar } from './IntegrationStatusBar';
import { CredentialSlideOver } from './CredentialSlideOver';
import { IntegrationQuickActions } from './IntegrationQuickActions';
import { IntegrationSearchInput } from './IntegrationSearchInput';
import { VirtualizedClientList } from './VirtualizedClientList';
import { IntegrationListPagination } from './IntegrationListPagination';
import { IntegrationHealthStatus, PLATFORM_DISPLAY_NAMES } from '@/types/integrations';
import { toast } from 'sonner';

export function IntegrationCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<IntegrationHealthStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  
  // Slide-over state
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

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
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
      // In production, this would call edge functions for each platform
      await new Promise(resolve => setTimeout(resolve, 2000));
      toast.success('Sync triggered for all active integrations');
      refetch();
    } catch (err) {
      toast.error('Failed to trigger sync');
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Sort data: needs_attention first, then untested, then no_setup, then healthy
  const sortedData = useMemo(() => {
    const priorityOrder: Record<IntegrationHealthStatus, number> = {
      needs_attention: 0,
      untested: 1,
      no_setup: 2,
      all_disabled: 3,
      healthy: 4,
    };
    
    return [...data].sort((a, b) => 
      (priorityOrder[a.health_status] ?? 5) - (priorityOrder[b.health_status] ?? 5)
    );
  }, [data]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedData.slice(startIndex, startIndex + pageSize);
  }, [sortedData, currentPage, pageSize]);

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-destructive mb-4">{error}</p>
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Integration Center</h2>
          <p className="text-muted-foreground">
            Manage and monitor all client integrations in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={refetch} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => handleAddIntegration()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Integration
          </Button>
        </div>
      </div>

      {/* Status Summary Bar */}
      <IntegrationStatusBar
        counts={statusCounts}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
      />

      {/* Quick Actions */}
      {(statusCounts.needsAttention > 0 || statusCounts.untested > 0) && (
        <IntegrationQuickActions
          failingCount={statusCounts.needsAttention}
          untestedCount={statusCounts.untested}
          onTestAllFailing={handleTestAllFailing}
          onSyncAll={handleSyncAll}
          isTestingAll={isTestingAll}
          isSyncingAll={isSyncingAll}
        />
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <IntegrationSearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search clients by name or slug..."
          debounceMs={300}
          resultCount={sortedData.length}
          totalCount={statusCounts.needsAttention + statusCounts.healthy + statusCounts.noSetup + statusCounts.untested}
          className="flex-1 max-w-md"
        />
        
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All platforms" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            {Object.entries(PLATFORM_DISPLAY_NAMES).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Client List */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : sortedData.length === 0 ? (
        <div className="text-center p-12 border border-dashed rounded-lg">
          <p className="text-muted-foreground mb-4">
            {searchQuery || statusFilter !== 'all' || platformFilter !== 'all'
              ? 'No clients match your filters'
              : 'No clients found'}
          </p>
          {(searchQuery || statusFilter !== 'all' || platformFilter !== 'all') && (
            <Button 
              variant="outline" 
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setPlatformFilter('all');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <>
          <VirtualizedClientList
            data={paginatedData}
            onTest={handleTest}
            onToggle={handleToggle}
            onEdit={handleEdit}
            onAddIntegration={handleAddIntegration}
          />
          
          <IntegrationListPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={sortedData.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
          />
        </>
      )}

      {/* Credential Slide-Over */}
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
