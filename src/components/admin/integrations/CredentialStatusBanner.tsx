import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

export interface CredentialStatus {
  lastTestedAt?: string | null;
  lastTestStatus?: string | null;
  lastTestError?: string | null;
  lastSyncAt?: string | null;
  lastSyncStatus?: string | null;
  lastSyncError?: string | null;
}

interface CredentialStatusBannerProps {
  status: CredentialStatus;
  className?: string;
}

function getRecommendation(error: string | null | undefined): string | null {
  if (!error) return null;
  
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('401') || lowerError.includes('unauthorized')) {
    return 'Invalid credentials. Please verify your username and password.';
  }
  if (lowerError.includes('entity') || lowerError.includes('entity_id')) {
    return 'Entity ID mismatch. Check your ActBlue entity ID.';
  }
  if (lowerError.includes('403') || lowerError.includes('forbidden')) {
    return 'Access denied. Check your API permissions.';
  }
  if (lowerError.includes('timeout') || lowerError.includes('network')) {
    return 'Connection issue. This may be temporary - try again later.';
  }
  
  return 'Update your API credentials to resolve this issue.';
}

function formatTimeAgo(date: string | null | undefined): string | null {
  if (!date) return null;
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return null;
  }
}

export function CredentialStatusBanner({ status, className }: CredentialStatusBannerProps) {
  // Check for errors in both status and error fields
  const hasTestError = status.lastTestStatus?.toLowerCase().includes('error') || 
                       status.lastTestStatus?.toLowerCase().includes('failed') ||
                       !!status.lastTestError;
  const hasSyncError = status.lastSyncStatus?.toLowerCase().includes('error') || 
                       status.lastSyncStatus?.toLowerCase().includes('failed') ||
                       !!status.lastSyncError;
  const neverTested = !status.lastTestedAt && !status.lastSyncAt && !status.lastSyncStatus && !status.lastTestStatus;
  const hasIssues = hasTestError || hasSyncError;
  
  // Determine the most recent activity
  const testTime = formatTimeAgo(status.lastTestedAt);
  const syncTime = formatTimeAgo(status.lastSyncAt);
  
  // Success state: no errors and at least one successful operation
  const isSuccess = !hasIssues && (status.lastTestStatus || status.lastSyncStatus);
  
  // Extract error message from status or error field
  const testErrorMessage = status.lastTestError || 
    (status.lastTestStatus?.toLowerCase().includes('error') ? status.lastTestStatus : null);
  const syncErrorMessage = status.lastSyncError || 
    (status.lastSyncStatus?.toLowerCase().includes('error') ? status.lastSyncStatus : null);
  
  if (neverTested) {
    return (
      <Alert className={cn("bg-muted/50 border-muted-foreground/20", className)}>
        <Clock className="h-4 w-4 text-muted-foreground" />
        <AlertTitle className="text-muted-foreground">Credentials not yet verified</AlertTitle>
        <AlertDescription className="text-muted-foreground">
          Use the "Test" button below to verify your credentials work correctly.
        </AlertDescription>
      </Alert>
    );
  }
  
  if (hasTestError) {
    const recommendation = getRecommendation(testErrorMessage);
    return (
      <Alert className={cn("bg-destructive/10 border-destructive/30", className)}>
        <XCircle className="h-4 w-4 text-destructive" />
        <AlertTitle className="text-destructive">Credential test failed</AlertTitle>
        <AlertDescription className="space-y-1">
          {testErrorMessage && (
            <p className="text-sm text-destructive/90">{testErrorMessage}</p>
          )}
          {recommendation && (
            <p className="text-sm text-muted-foreground">{recommendation}</p>
          )}
          {testTime && (
            <p className="text-xs text-muted-foreground">Last tested {testTime}</p>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  
  if (hasSyncError) {
    const recommendation = getRecommendation(syncErrorMessage);
    return (
      <Alert className={cn("bg-[hsl(var(--portal-warning))]/10 border-[hsl(var(--portal-warning))]/30", className)}>
        <AlertTriangle className="h-4 w-4 text-[hsl(var(--portal-warning))]" />
        <AlertTitle className="text-[hsl(var(--portal-warning))]">Sync issue detected</AlertTitle>
        <AlertDescription className="space-y-1">
          {syncErrorMessage && (
            <p className="text-sm">{syncErrorMessage}</p>
          )}
          {recommendation && (
            <p className="text-sm text-muted-foreground">{recommendation}</p>
          )}
          {syncTime && (
            <p className="text-xs text-muted-foreground">Last sync attempt {syncTime}</p>
          )}
        </AlertDescription>
      </Alert>
    );
  }
  
  if (isSuccess) {
    const timeInfo = [];
    if (testTime) timeInfo.push(`Tested ${testTime}`);
    if (syncTime) timeInfo.push(`Synced ${syncTime}`);
    
    return (
      <Alert className={cn("bg-[hsl(var(--portal-success))]/10 border-[hsl(var(--portal-success))]/30", className)}>
        <CheckCircle className="h-4 w-4 text-[hsl(var(--portal-success))]" />
        <AlertTitle className="text-[hsl(var(--portal-success))]">Credentials verified</AlertTitle>
        {timeInfo.length > 0 && (
          <AlertDescription className="text-muted-foreground text-sm">
            {timeInfo.join(' • ')}
          </AlertDescription>
        )}
      </Alert>
    );
  }
  
  return null;
}
