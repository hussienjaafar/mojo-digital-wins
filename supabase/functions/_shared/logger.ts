/**
 * Structured Logging Utility
 *
 * Provides consistent, structured logging across all Edge Functions.
 * Logs are JSON-formatted for easy parsing by log aggregation tools.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  function_name: string;
  request_id?: string;
  user_id?: string;
  org_id?: string;
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  function_name: string;
  request_id?: string;
  user_id?: string;
  org_id?: string;
  duration_ms?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  metadata?: Record<string, unknown>;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Default to 'info' in production, 'debug' in development
const currentLogLevel = (Deno.env.get('LOG_LEVEL') || 'info') as LogLevel;

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

function formatError(error: unknown): LogEntry['error'] | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    name: 'UnknownError',
    message: String(error),
  };
}

function createLogEntry(
  level: LogLevel,
  message: string,
  context: LogContext,
  metadata?: Record<string, unknown>,
  error?: unknown
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    function_name: context.function_name,
  };

  if (context.request_id) entry.request_id = context.request_id;
  if (context.user_id) entry.user_id = context.user_id;
  if (context.org_id) entry.org_id = context.org_id;
  if (metadata && Object.keys(metadata).length > 0) entry.metadata = metadata;
  if (error) entry.error = formatError(error);

  return entry;
}

function outputLog(entry: LogEntry): void {
  const jsonLog = JSON.stringify(entry);

  switch (entry.level) {
    case 'error':
      console.error(jsonLog);
      break;
    case 'warn':
      console.warn(jsonLog);
      break;
    case 'debug':
      console.debug(jsonLog);
      break;
    default:
      console.log(jsonLog);
  }
}

/**
 * Creates a logger instance for a specific function.
 *
 * @example
 * const logger = createLogger('send-user-invitation');
 * logger.info('Processing invitation', { email: 'user@example.com' });
 * logger.error('Failed to send', {}, error);
 */
export function createLogger(functionName: string, requestId?: string) {
  const context: LogContext = {
    function_name: functionName,
    request_id: requestId || crypto.randomUUID().slice(0, 8),
  };

  const startTime = Date.now();

  return {
    /**
     * Set user context for subsequent log entries
     */
    setUser(userId: string) {
      context.user_id = userId;
    },

    /**
     * Set organization context for subsequent log entries
     */
    setOrg(orgId: string) {
      context.org_id = orgId;
    },

    /**
     * Log debug message (only in development)
     */
    debug(message: string, metadata?: Record<string, unknown>) {
      if (!shouldLog('debug')) return;
      const entry = createLogEntry('debug', message, context, metadata);
      outputLog(entry);
    },

    /**
     * Log info message
     */
    info(message: string, metadata?: Record<string, unknown>) {
      if (!shouldLog('info')) return;
      const entry = createLogEntry('info', message, context, metadata);
      outputLog(entry);
    },

    /**
     * Log warning message
     */
    warn(message: string, metadata?: Record<string, unknown>, error?: unknown) {
      if (!shouldLog('warn')) return;
      const entry = createLogEntry('warn', message, context, metadata, error);
      outputLog(entry);
    },

    /**
     * Log error message
     */
    error(message: string, metadata?: Record<string, unknown>, error?: unknown) {
      if (!shouldLog('error')) return;
      const entry = createLogEntry('error', message, context, metadata, error);
      outputLog(entry);
    },

    /**
     * Log request start
     */
    requestStart(method: string, path: string) {
      this.info('Request started', { method, path });
    },

    /**
     * Log request completion with duration
     */
    requestEnd(statusCode: number, metadata?: Record<string, unknown>) {
      const duration = Date.now() - startTime;
      const entry = createLogEntry(
        statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info',
        'Request completed',
        context,
        { ...metadata, status_code: statusCode }
      );
      entry.duration_ms = duration;
      outputLog(entry);
    },

    /**
     * Create a child logger with additional context
     */
    child(additionalContext: Partial<LogContext>) {
      return createLogger(functionName, context.request_id);
    },

    /**
     * Get elapsed time since logger creation
     */
    getElapsedMs(): number {
      return Date.now() - startTime;
    },

    /**
     * Get the request ID for correlation
     */
    getRequestId(): string {
      return context.request_id || '';
    },
  };
}

/**
 * Utility to sanitize sensitive data from logs
 */
export function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'api_key',
    'apiKey',
    'authorization',
    'cookie',
    'credit_card',
    'ssn',
  ];

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Middleware-style wrapper for request handling with automatic logging
 */
export async function withLogging<T>(
  functionName: string,
  req: Request,
  handler: (logger: ReturnType<typeof createLogger>) => Promise<T>
): Promise<T> {
  const logger = createLogger(functionName);
  const url = new URL(req.url);

  logger.requestStart(req.method, url.pathname);

  try {
    const result = await handler(logger);
    return result;
  } catch (error) {
    logger.error('Unhandled error', {}, error);
    throw error;
  }
}
