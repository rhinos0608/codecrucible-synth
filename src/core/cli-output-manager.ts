export interface CLIOutputManager {
  outputError: (message: string, exitCode?: number) => void;
  outputInfo: (message: string) => void;
  outputDebug: (message: string) => void;
  outputProgress: (message: string) => void;
  configure: (options: Record<string, unknown>) => void;
}

export function createCLIOutputManager(): CLIOutputManager {
  return {
    outputError: (message: string, exitCode?: number) => {
      console.error('❌', message);
      if (exitCode !== undefined) {
        process.exit(exitCode);
      }
    },
    outputInfo: (message: string) => {
      console.log('ℹ️', message);
    },
    outputDebug: (message: string) => {
      if (process.env.DEBUG) {
        console.log('🔍', message);
      }
    },
    outputProgress: (message: string) => {
      console.log('⏳', message);
    },
    configure: (options: Record<string, unknown>) => {
      // Configuration logic
    },
  };
}
