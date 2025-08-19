import { writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';
/**
 * Enhanced Logger with file and console output
 *
 * Provides structured logging with different levels, file rotation,
 * and pretty console output with colors
 */
class Logger {
    config;
    logQueue = [];
    isWriting = false;
    logDirectory;
    name;
    constructor(nameOrConfig, config) {
        // Handle overloaded constructor
        if (typeof nameOrConfig === 'string') {
            this.name = nameOrConfig;
            this.config = {
                level: 'info',
                toFile: true,
                toConsole: true,
                maxFileSize: '10MB',
                maxFiles: 5,
                ...config
            };
        }
        else {
            this.config = {
                level: 'info',
                toFile: true,
                toConsole: true,
                maxFileSize: '10MB',
                maxFiles: 5,
                ...nameOrConfig
            };
        }
        this.logDirectory = this.config.logDirectory || join(homedir(), '.codecrucible', 'logs');
        this.ensureLogDirectory();
    }
    /**
     * Ensure log directory exists
     */
    async ensureLogDirectory() {
        try {
            await access(this.logDirectory);
        }
        catch {
            try {
                await mkdir(this.logDirectory, { recursive: true });
            }
            catch (error) {
                console.warn(`Failed to create log directory: ${this.logDirectory}`);
            }
        }
    }
    /**
     * Get numeric level for comparison
     */
    getNumericLevel(level) {
        const levels = { debug: 0, info: 1, warn: 2, error: 3 };
        return levels[level];
    }
    /**
     * Check if message should be logged based on level
     */
    shouldLog(level) {
        return this.getNumericLevel(level) >= this.getNumericLevel(this.config.level);
    }
    /**
     * Format timestamp for display
     */
    formatTimestamp(date) {
        return date.toISOString().replace('T', ' ').replace('Z', '');
    }
    /**
     * Get colored prefix for console output
     */
    getColoredPrefix(level) {
        const timestamp = chalk.gray(this.formatTimestamp(new Date()));
        switch (level) {
            case 'debug':
                return `${timestamp} ${chalk.blue('DEBUG')}`;
            case 'info':
                return `${timestamp} ${chalk.green(' INFO')}`;
            case 'warn':
                return `${timestamp} ${chalk.yellow(' WARN')}`;
            case 'error':
                return `${timestamp} ${chalk.red('ERROR')}`;
        }
    }
    /**
     * Format message for console output
     */
    formatConsoleMessage(entry) {
        const prefix = this.getColoredPrefix(entry.level);
        let message = `${prefix} ${entry.message}`;
        if (entry.data) {
            const dataStr = typeof entry.data === 'string'
                ? entry.data
                : JSON.stringify(entry.data, null, 2);
            message += `\\n${chalk.gray(dataStr)}`;
        }
        if (entry.error) {
            message += `\\n${chalk.red(entry.error.stack || entry.error.message)}`;
        }
        return message;
    }
    /**
     * Format message for file output
     */
    formatFileMessage(entry) {
        const timestamp = this.formatTimestamp(entry.timestamp);
        const level = entry.level.toUpperCase().padEnd(5);
        let message = `${timestamp} ${level} ${entry.message}`;
        if (entry.data) {
            const dataStr = typeof entry.data === 'string'
                ? entry.data
                : JSON.stringify(entry.data);
            message += ` | Data: ${dataStr}`;
        }
        if (entry.error) {
            message += ` | Error: ${entry.error.message}`;
            if (entry.error.stack) {
                message += `\\n${entry.error.stack}`;
            }
        }
        return message;
    }
    /**
     * Log a message with specified level
     */
    async log(level, message, data, error) {
        if (!this.shouldLog(level)) {
            return;
        }
        const entry = {
            timestamp: new Date(),
            level,
            message,
            data,
            error
        };
        // Console output
        if (this.config.toConsole) {
            console.log(this.formatConsoleMessage(entry));
        }
        // File output
        if (this.config.toFile) {
            this.logQueue.push(entry);
            this.processLogQueue();
        }
    }
    /**
     * Process log queue and write to file
     */
    async processLogQueue() {
        if (this.isWriting || this.logQueue.length === 0) {
            return;
        }
        this.isWriting = true;
        try {
            const entries = this.logQueue.splice(0, 100); // Process in batches
            const logContent = entries
                .map(entry => this.formatFileMessage(entry))
                .join('\\n') + '\\n';
            const logFile = join(this.logDirectory, `codecrucible-${this.getCurrentDateString()}.log`);
            await writeFile(logFile, logContent, { flag: 'a' });
        }
        catch (error) {
            // Fallback to console if file writing fails
            console.error('Failed to write to log file:', error);
        }
        finally {
            this.isWriting = false;
            // Process remaining queue if any
            if (this.logQueue.length > 0) {
                setTimeout(() => this.processLogQueue(), 100);
            }
        }
    }
    /**
     * Get current date string for log file naming
     */
    getCurrentDateString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    /**
     * Debug level logging
     */
    debug(message, data) {
        this.log('debug', message, data);
    }
    /**
     * Info level logging
     */
    info(message, data) {
        this.log('info', message, data);
    }
    /**
     * Warning level logging
     */
    warn(message, data) {
        this.log('warn', message, data);
    }
    /**
     * Error level logging
     */
    error(message, error, data) {
        if (error instanceof Error) {
            this.log('error', message, data, error);
        }
        else {
            // If second parameter is not an Error, treat it as data
            this.log('error', message, error);
        }
    }
    /**
     * Update logger configuration
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Flush pending logs to file
     */
    async flush() {
        while (this.logQueue.length > 0 || this.isWriting) {
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    }
    /**
     * Create a child logger with additional context
     */
    child(context) {
        const childLogger = new Logger(this.config);
        // Override log method to include context
        const originalLog = childLogger.log.bind(childLogger);
        childLogger.log = (level, message, data, error) => {
            return originalLog(level, `[${context}] ${message}`, data, error);
        };
        return childLogger;
    }
    /**
     * Performance timing utility
     */
    time(label) {
        const start = Date.now();
        return () => {
            const duration = Date.now() - start;
            this.debug(`Timer ${label}: ${duration}ms`);
        };
    }
    /**
     * Log performance of async operations
     */
    async profile(label, operation) {
        const start = Date.now();
        try {
            const result = await operation();
            const duration = Date.now() - start;
            this.debug(`Operation ${label} completed in ${duration}ms`);
            return result;
        }
        catch (error) {
            const duration = Date.now() - start;
            this.error(`Operation ${label} failed after ${duration}ms`, error);
            throw error;
        }
    }
    /**
     * Log system information
     */
    logSystemInfo() {
        this.info('System Information', {
            platform: process.platform,
            arch: process.arch,
            nodeVersion: process.version,
            memoryUsage: process.memoryUsage(),
            uptime: process.uptime(),
            cwd: process.cwd()
        });
    }
}
// Create default logger instance
export const logger = new Logger();
// Export Logger class for custom instances
export { Logger };
// Convenience function to update global logger config
export function configureLogger(config) {
    logger.updateConfig(config);
}
// Graceful shutdown - flush logs
process.on('beforeExit', async () => {
    try {
        await logger.flush();
    }
    catch (error) {
        console.error('Failed to flush logs on exit:', error);
    }
});
process.on('SIGINT', async () => {
    try {
        await logger.flush();
    }
    catch (error) {
        console.error('Failed to flush logs on SIGINT:', error);
    }
    process.exit(0);
});
process.on('SIGTERM', async () => {
    try {
        await logger.flush();
    }
    catch (error) {
        console.error('Failed to flush logs on SIGTERM:', error);
    }
    process.exit(0);
});
//# sourceMappingURL=logger.js.map