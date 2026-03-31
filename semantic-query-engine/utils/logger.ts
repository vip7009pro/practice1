/**
 * Logger Utility - Structured logging for the semantic query engine
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LogEntry {
  level: string;
  timestamp: string;
  component: string;
  message: string;
  duration_ms?: number;
  data?: any;
  error?: string;
}

class Logger {
  private component: string;
  private level: LogLevel;
  private isDev: boolean;

  constructor(component: string) {
    this.component = component;
    this.level = this.parseLogLevel();
    this.isDev = String(process.env.NODE_ENV || '').toLowerCase() === 'development';
  }

  private parseLogLevel(): LogLevel {
    const levelStr = String(process.env.LOG_LEVEL || 'INFO').toUpperCase();
    switch (levelStr) {
      case 'DEBUG':
        return LogLevel.DEBUG;
      case 'WARN':
        return LogLevel.WARN;
      case 'ERROR':
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private format(entry: LogEntry): string {
    const { level, timestamp, component, message, duration_ms, data, error } = entry;
    const parts = [
      `[${timestamp}]`,
      `[${level}]`,
      `[${component}]`,
      message,
    ];

    if (duration_ms !== undefined) {
      parts.push(`(${duration_ms}ms)`);
    }

    let result = parts.join(' ');

    if (error) {
      result += `\n  Error: ${error}`;
    }

    if (data && typeof data === 'object') {
      result += `\n  Data: ${JSON.stringify(data, null, 2)}`;
    }

    return result;
  }

  private log(level: LogLevel, levelStr: string, message: string, data?: any): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      level: levelStr,
      timestamp: new Date().toISOString(),
      component: this.component,
      message,
      data,
    };

    const formatted = this.format(entry);

    switch (level) {
      case LogLevel.DEBUG:
        if (this.isDev) console.debug(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, 'INFO', message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, 'WARN', message, data);
  }

  error(message: string, error?: Error | string, data?: any): void {
    const errorStr = error instanceof Error ? error.message : String(error);
    const entry: LogEntry = {
      level: 'ERROR',
      timestamp: new Date().toISOString(),
      component: this.component,
      message,
      error: errorStr,
      data,
    };
    const formatted = this.format(entry);
    console.error(formatted);
    if (error instanceof Error) {
      console.error(error.stack);
    }
  }

  profile(message: string, duration_ms: number, data?: any): void {
    this.log(LogLevel.INFO, 'PROFILE', message, { ...data, duration_ms });
  }
}

export function createLogger(component: string): Logger {
  return new Logger(component);
}
