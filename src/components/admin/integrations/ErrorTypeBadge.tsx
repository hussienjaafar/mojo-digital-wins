import React from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  KeyRound, 
  Clock, 
  Ban, 
  Wifi, 
  AlertCircle,
  Lock,
  RefreshCw
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export type ErrorType = 
  | 'token_expired' 
  | 'rate_limited' 
  | 'scope_missing' 
  | 'connection_failed'
  | 'auth_revoked'
  | 'api_error'
  | 'unknown';

interface ErrorTypeBadgeProps {
  errorMessage?: string | null;
  className?: string;
}

function categorizeError(errorMessage?: string | null): ErrorType {
  if (!errorMessage) return 'unknown';
  
  const msg = errorMessage.toLowerCase();
  
  if (msg.includes('expired') || msg.includes('token') && msg.includes('invalid')) {
    return 'token_expired';
  }
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('throttl')) {
    return 'rate_limited';
  }
  if (msg.includes('scope') || msg.includes('permission') || msg.includes('unauthorized')) {
    return 'scope_missing';
  }
  if (msg.includes('timeout') || msg.includes('connection') || msg.includes('network')) {
    return 'connection_failed';
  }
  if (msg.includes('revoked') || msg.includes('deauthorized')) {
    return 'auth_revoked';
  }
  if (msg.includes('api') || msg.includes('server') || msg.includes('500')) {
    return 'api_error';
  }
  
  return 'unknown';
}

const errorConfig: Record<ErrorType, {
  icon: React.ReactNode;
  label: string;
  description: string;
  action: string;
  variant: 'destructive' | 'secondary' | 'outline';
  className: string;
}> = {
  token_expired: {
    icon: <Clock className="h-3 w-3" />,
    label: 'Token Expired',
    description: 'The access token has expired and needs to be refreshed.',
    action: 'Reconnect to refresh the token',
    variant: 'destructive',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  rate_limited: {
    icon: <RefreshCw className="h-3 w-3" />,
    label: 'Rate Limited',
    description: 'Too many requests were made. This is usually temporary.',
    action: 'Wait a few minutes and retry',
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  scope_missing: {
    icon: <Lock className="h-3 w-3" />,
    label: 'Missing Permissions',
    description: 'The integration lacks required permissions.',
    action: 'Reconnect and grant all requested permissions',
    variant: 'destructive',
    className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  },
  connection_failed: {
    icon: <Wifi className="h-3 w-3" />,
    label: 'Connection Failed',
    description: 'Unable to connect to the API. This may be temporary.',
    action: 'Check network and retry',
    variant: 'secondary',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
  auth_revoked: {
    icon: <Ban className="h-3 w-3" />,
    label: 'Access Revoked',
    description: 'The user revoked access to the integration.',
    action: 'User must reconnect and reauthorize',
    variant: 'destructive',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  api_error: {
    icon: <AlertCircle className="h-3 w-3" />,
    label: 'API Error',
    description: 'The external API returned an error.',
    action: 'Check API status and retry',
    variant: 'secondary',
    className: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  },
  unknown: {
    icon: <AlertCircle className="h-3 w-3" />,
    label: 'Error',
    description: 'An unknown error occurred.',
    action: 'Check the error details and retry',
    variant: 'outline',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
};

export function ErrorTypeBadge({ errorMessage, className }: ErrorTypeBadgeProps) {
  const errorType = categorizeError(errorMessage);
  const config = errorConfig[errorType];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={config.variant}
            className={`${config.className} ${className} flex items-center gap-1 cursor-help`}
          >
            {config.icon}
            <span className="text-xs">{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground">{config.description}</p>
            <p className="text-xs font-medium">💡 {config.action}</p>
            {errorMessage && (
              <p className="text-xs text-muted-foreground mt-2 pt-2 border-t">
                Raw error: {errorMessage}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { categorizeError };