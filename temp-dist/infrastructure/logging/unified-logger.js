/**
 * Unified Logger System
 *
 * Consolidates 6 different logging implementations into one comprehensive system.
 * Replaces: core/logger.ts, structured-logger.ts, security-audit-logger.ts, etc.
 */
import { EventEmitter } from 'events';
import * as fs from 'fs';
export var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["DEBUG"] = 0] = "DEBUG";
    LogLevel[LogLevel["INFO"] = 1] = "INFO";
    LogLevel[LogLevel["WARN"] = 2] = "WARN";
    LogLevel[LogLevel["ERROR"] = 3] = "ERROR";
    LogLevel[LogLevel["FATAL"] = 4] = "FATAL";
    LogLevel[LogLevel["AUDIT"] = 5] = "AUDIT";
})(LogLevel || (LogLevel = {}));
export class UnifiedLogger extends EventEmitter {
    constructor(config, eventBus) {
        super();
        this.eventBus = eventBus;
        this.config = {
            level: LogLevel.INFO,
            destinations: [],
            format: 'json',
            enableConsole: true,
            enableFile: false,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            enableAudit: false,
            ...config,
        };
        this.initialize();
    }
    initialize() {
        if (this.config.enableFile && this.config.filePath) {
            this.fileStream = fs.createWriteStream(this.config.filePath, { flags: 'a' });
        }
        if (this.config.enableAudit && this.config.auditPath) {
            this.auditStream = fs.createWriteStream(this.config.auditPath, { flags: 'a' });
        }
    }
    debug(message, metadata) {
        this.log(LogLevel.DEBUG, message, metadata);
    }
    trace(message, metadata) {
        this.log(LogLevel.DEBUG, message, metadata);
    }
    info(message, metadata) {
        this.log(LogLevel.INFO, message, metadata);
    }
    warn(message, metadata) {
        this.log(LogLevel.WARN, message, metadata);
    }
    error(message, error, metadata) {
        if (error instanceof Error) {
            this.log(LogLevel.ERROR, message, { ...metadata, error: error.message, stack: error.stack });
        }
        else {
            this.log(LogLevel.ERROR, message, { ...metadata, error });
        }
    }
    fatal(message, error, metadata) {
        this.log(LogLevel.FATAL, message, { ...metadata, error });
        // Fatal errors might trigger system shutdown
        this.emit('fatal', { message, error, metadata });
    }
    audit(action, result, metadata) {
        const entry = {
            timestamp: new Date(),
            level: LogLevel.AUDIT,
            message: `AUDIT: ${action} - ${result}`,
            metadata: { ...metadata, action, result },
        };
        this.writeAudit(entry);
    }
    log(level, message, metadata) {
        if (level < this.config.level)
            return;
        const entry = {
            timestamp: new Date(),
            level,
            message,
            metadata,
            context: this.getContext(),
        };
        this.writeLog(entry);
    }
    writeLog(entry) {
        const formatted = this.format(entry);
        if (this.config.enableConsole) {
            this.writeToConsole(entry, formatted);
        }
        if (this.config.enableFile && this.fileStream) {
            this.fileStream.write(`${formatted}\n`);
        }
        // Emit to event bus
        if (this.eventBus) {
            this.eventBus.emit('log:entry', entry);
        }
        // Emit local event
        this.emit('log', entry);
    }
    writeAudit(entry) {
        if (this.auditStream) {
            const formatted = this.format(entry);
            this.auditStream.write(`${formatted}\n`);
        }
        // Always write audit logs to main log as well
        this.writeLog(entry);
    }
    format(entry) {
        switch (this.config.format) {
            case 'json':
                return JSON.stringify(entry);
            case 'structured':
                return this.structuredFormat(entry);
            case 'text':
            default:
                return this.textFormat(entry);
        }
    }
    structuredFormat(entry) {
        const level = LogLevel[entry.level];
        const timestamp = entry.timestamp.toISOString();
        const metadata = entry.metadata ? JSON.stringify(entry.metadata) : '';
        return `[${timestamp}] [${level}] ${entry.message} ${metadata}`;
    }
    textFormat(entry) {
        const level = LogLevel[entry.level];
        const timestamp = entry.timestamp.toLocaleTimeString();
        return `${timestamp} [${level}] ${entry.message}`;
    }
    writeToConsole(entry, formatted) {
        const colors = {
            [LogLevel.DEBUG]: '\x1b[90m', // gray
            [LogLevel.INFO]: '\x1b[36m', // cyan
            [LogLevel.WARN]: '\x1b[33m', // yellow
            [LogLevel.ERROR]: '\x1b[31m', // red
            [LogLevel.FATAL]: '\x1b[35m', // magenta
            [LogLevel.AUDIT]: '\x1b[32m', // green
        };
        const resetColor = '\x1b[0m';
        const color = colors[entry.level] || resetColor;
        if (entry.level >= LogLevel.ERROR) {
            console.error(`${color}${formatted}${resetColor}`);
        }
        else {
            console.log(`${color}${formatted}${resetColor}`);
        }
    }
    getContext() {
        // Get calling context from stack trace
        const stack = new Error().stack;
        if (!stack)
            return 'unknown';
        const lines = stack.split('\n');
        const callerLine = lines[3]; // Skip Error, this method, and log method
        const match = callerLine?.match(/at\s+(\S+)/);
        return match ? match[1] : 'unknown';
    }
    setLevel(level) {
        this.config.level = level;
    }
    close() {
        if (this.fileStream) {
            this.fileStream.end();
        }
        if (this.auditStream) {
            this.auditStream.end();
        }
    }
}
// Global logger instance
let globalLogger = null;
export function getGlobalLogger(config) {
    if (!globalLogger) {
        globalLogger = new UnifiedLogger(config);
    }
    return globalLogger;
}
// Convenience exports
export const logger = getGlobalLogger();
// For backward compatibility
export class Logger extends UnifiedLogger {
    constructor(name, config) {
        super({ ...config, context: name });
    }
}
