/**
 * Centralized logging utility
 * Provides environment-aware logging with different levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  level: LogLevel;
  enablePerformance: boolean;
}

const isDevelopment = import.meta.env.DEV;

const config: LoggerConfig = {
  enabled: isDevelopment,
  level: 'info',
  enablePerformance: isDevelopment,
};

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private shouldLog(level: LogLevel): boolean {
    if (!config.enabled) return false;
    return levelPriority[level] >= levelPriority[config.level];
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, error);
    }
  }

  performance(name: string, duration: number): void {
    if (config.enablePerformance) {
      const status = duration < 100 ? '✅' : duration < 500 ? '⚠️' : '❌';
      console.log(`[PERF] ${name}: ${duration.toFixed(2)}ms ${status}`);
    }
  }

  group(label: string): void {
    if (config.enabled) {
      console.group(label);
    }
  }

  groupEnd(): void {
    if (config.enabled) {
      console.groupEnd();
    }
  }
}

export const logger = new Logger();
export default logger;
