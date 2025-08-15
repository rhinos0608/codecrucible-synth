export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    message: string;
    data?: any;
    error?: Error;
}
export interface LoggerConfig {
    level: LogLevel;
    toFile: boolean;
    toConsole: boolean;
    maxFileSize: string;
    maxFiles: number;
    logDirectory?: string;
}
/**
 * Enhanced Logger with file and console output
 *
 * Provides structured logging with different levels, file rotation,
 * and pretty console output with colors
 */
declare class Logger {
    private config;
    private logQueue;
    private isWriting;
    private logDirectory;
    constructor(config?: Partial<LoggerConfig>);
    /**
     * Ensure log directory exists
     */
    private ensureLogDirectory;
    /**
     * Get numeric level for comparison
     */
    private getNumericLevel;
    /**
     * Check if message should be logged based on level
     */
    private shouldLog;
    /**
     * Format timestamp for display
     */
    private formatTimestamp;
    /**
     * Get colored prefix for console output
     */
    private getColoredPrefix;
    /**
     * Format message for console output
     */
    private formatConsoleMessage;
    /**
     * Format message for file output
     */
    private formatFileMessage;
    /**
     * Log a message with specified level
     */
    private log;
    /**
     * Process log queue and write to file
     */
    private processLogQueue;
    /**
     * Get current date string for log file naming
     */
    private getCurrentDateString;
    /**
     * Debug level logging
     */
    debug(message: string, data?: any): void;
    /**
     * Info level logging
     */
    info(message: string, data?: any): void;
    /**
     * Warning level logging
     */
    warn(message: string, data?: any): void;
    /**
     * Error level logging
     */
    error(message: string, error?: Error | any, data?: any): void;
    /**
     * Update logger configuration
     */
    updateConfig(config: Partial<LoggerConfig>): void;
    /**
     * Get current configuration
     */
    getConfig(): LoggerConfig;
    /**
     * Flush pending logs to file
     */
    flush(): Promise<void>;
    /**
     * Create a child logger with additional context
     */
    child(context: string): Logger;
    /**
     * Performance timing utility
     */
    time(label: string): () => void;
    /**
     * Log performance of async operations
     */
    profile<T>(label: string, operation: () => Promise<T>): Promise<T>;
    /**
     * Log system information
     */
    logSystemInfo(): void;
}
export declare const logger: Logger;
export { Logger };
export declare function configureLogger(config: Partial<LoggerConfig>): void;
