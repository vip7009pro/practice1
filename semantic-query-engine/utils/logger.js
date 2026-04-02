"use strict";
/**
 * Logger Utility - Structured logging for the semantic query engine
 */
Object.defineProperty(exports, "__esModule", { value: true });
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
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
    log(level, levelStr, message, data) {
        if (level < this.level)
            return;
        const entry = {
            level: levelStr,
            timestamp: new Date().toISOString(),
            component: this.component,
            message,
            data,
        };
        const formatted = this.format(entry);
        switch (level) {
            case LogLevel.DEBUG:
                if (this.isDev)
                    console.debug(formatted);
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
        const errorStr = error instanceof Error ? error.message : String(error);
        const entry = {
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
    profile(message, duration_ms, data) {
        this.log(LogLevel.INFO, 'PROFILE', message, { ...data, duration_ms });
    }
}
function createLogger(component) {
    return new Logger(component);
}
exports.createLogger = createLogger;
