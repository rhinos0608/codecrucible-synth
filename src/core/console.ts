// Console Logger Implementation
export const logger = {
  info: (message: string, ...args: unknown[]) => console.log('ℹ️', message, ...args),
  warn: (message: string, ...args: unknown[]) => console.warn('⚠️', message, ...args),
  error: (message: string, ...args: unknown[]) => console.error('❌', message, ...args),
  debug: (message: string, ...args: unknown[]) => console.log('🐛', message, ...args),
  success: (message: string, ...args: unknown[]) => console.log('✅', message, ...args),
};

export default logger;
