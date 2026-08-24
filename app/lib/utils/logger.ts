type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const sensitiveKey = /address|authorization|cookie|coordinate|email|key|note|password|phone|secret|session|token/i;

function safeValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return '[truncated]';
  if (value instanceof Error) {
    const withCode = value as Error & { code?: unknown };
    return {
      name: value.name,
      ...(typeof withCode.code === 'string' ? { code: withCode.code.slice(0, 80) } : {}),
    };
  }
  if (typeof value === 'string') return value.slice(0, 160);
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => safeValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 20)
        .map(([key, item]) => [
          key,
          sensitiveKey.test(key) ? '[redacted]' : safeValue(item, depth + 1),
        ]),
    );
  }
  return String(value).slice(0, 80);
}

class Logger {
  private shouldLog(level: LogLevel): boolean {
    if (process.env.NODE_ENV === 'production') return level === 'warn' || level === 'error';
    return true;
  }

  private emit(level: LogLevel, event: string, context: unknown[]): void {
    if (!this.shouldLog(level)) return;
    const output = JSON.stringify({
      level,
      event: event.slice(0, 120),
      timestamp: new Date().toISOString(),
      ...(context.length ? { context: context.map((item) => safeValue(item)) } : {}),
    });
    if (level === 'error') console.error(output);
    else if (level === 'warn') console.warn(output);
    else if (level === 'info') console.info(output);
    else console.debug(output);
  }

  debug(event: string, ...context: unknown[]): void {
    this.emit('debug', event, context);
  }

  info(event: string, ...context: unknown[]): void {
    this.emit('info', event, context);
  }

  warn(event: string, ...context: unknown[]): void {
    this.emit('warn', event, context);
  }

  error(event: string, ...context: unknown[]): void {
    this.emit('error', event, context);
  }
}

export const logger = new Logger();
