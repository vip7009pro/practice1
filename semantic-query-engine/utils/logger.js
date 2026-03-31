const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

class Logger {
  constructor(component) {
    this.component = component;
    this.level = this.parseLogLevel();
    this.isDev = String(process.env.NODE_ENV || '').toLowerCase() === 'development';
  }

  parseLogLevel() {
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

  format(entry) {
    const { level, timestamp, component, message, duration_ms, data, error } = entry;
    const parts = [`[${timestamp}]`, `[${level}]`, `[${component}]`, message];
    if (duration_ms !== undefined) parts.push(`(${duration_ms}ms)`);
    let result = parts.join(' ');
    if (error) result += `\n  Error: ${error}`;
    if (data && typeof data === 'object') result += `\n  Data: ${JSON.stringify(data, null, 2)}`;
    return result;
  }

  log(level, levelStr, message, data, error) {
    if (level < this.level) return;
    const entry = {
      level: levelStr,
      timestamp: new Date().toISOString(),
      component: this.component,
      message,
      duration_ms: data?.duration_ms,
      data,
      error,
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
    if (level === LogLevel.ERROR && error instanceof Error) console.error(error.stack);
  }

  debug(message, data) {
    this.log(LogLevel.DEBUG, 'DEBUG', message, data);
  }

  info(message, data) {
    this.log(LogLevel.INFO, 'INFO', message, data);
  }

  warn(message, data) {
    this.log(LogLevel.WARN, 'WARN', message, data);
  }

  error(message, error, data) {
    const err = (error instanceof Error) ? error.message : (error ? String(error) : undefined);
    this.log(LogLevel.ERROR, 'ERROR', message, data, err);
  }

  profile(message, duration_ms, data) {
    this.log(LogLevel.INFO, 'PROFILE', message, { ...data, duration_ms });
  }
}

function createLogger(component) {
  return new Logger(component);
}

module.exports = { createLogger, LogLevel };
