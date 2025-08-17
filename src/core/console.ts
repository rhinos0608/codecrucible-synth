// Console Logger Implementation
export const logger = {
  info: (message: string, ...args: any[]) => console.log('ℹ️', message, ...args),
  warn: (message: string, ...args: any[]) => console.warn('⚠️', message, ...args),
  error: (message: string, ...args: any[]) => console.error('❌', message, ...args),
  debug: (message: string, ...args: any[]) => console.log('🐛', message, ...args),
  success: (message: string, ...args: any[]) => console.log('✅', message, ...args)
};

export default logger;
