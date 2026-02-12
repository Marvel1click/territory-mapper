/**
 * Production logging utility
 * 
 * Replaces console statements with a configurable logger
 * that can be disabled in production or set to different levels.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class Logger {
  private shouldLog(level: LogLevel): boolean {
    // In production, only log warnings and errors by default
    if (typeof window === 'undefined') {
      // Server-side: check NODE_ENV
      if (process.env.NODE_ENV === 'production') {
        return level === 'error' || level === 'warn';
      }
      return true;
    }

    // Client-side: check for custom log level config
    const configLevel = (window as Window & { __LOG_LEVEL__?: LogLevel }).__LOG_LEVEL__;
    if (!configLevel) {
      // Default: only log errors in production
      if (process.env.NODE_ENV === 'production') {
        return level === 'error';
      }
      return true;
    }

    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(configLevel);
  }

  debug(...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.debug('[DEBUG]', ...args);
    }
  }

  info(...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.info('[INFO]', ...args);
    }
  }

  warn(...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn('[WARN]', ...args);
    }
  }

  error(...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error('[ERROR]', ...args);
    }
  }
}

export const logger = new Logger();
