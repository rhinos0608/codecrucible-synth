/**
 * Cross-platform Rust module loader with napi-rs prebuild support
 * Handles platform-specific NAPI binary loading with fallbacks
 */

import { createRequire } from 'module';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../infrastructure/logging/unified-logger.js';
import { toReadonlyRecord } from './type-guards.js';

const require = createRequire(import.meta.url);

/**
 * Load prebuilt binary using napi-rs approach
 * Falls back to manual loading if prebuilt is not available
 */
function loadPrebuiltBinding(name: string, fallbackPath?: string): unknown {
  try {
    // Try to load from optionalDependencies first (napi-rs approach)
    const packageName = `@codecrucible/rust-executor-${process.platform}-${process.arch}`;

    if (process.platform === 'win32') {
      // Windows uses MSVC ABI
      const winPackageName = `@codecrucible/rust-executor-win32-${process.arch}-msvc`;
      try {
        return require(winPackageName);
      } catch {
        // Fall through to try other variants
      }
    } else if (process.platform === 'linux') {
      // Linux requires GNU or Musl ABI suffix
      // Try GNU first (most common)
      const gnuPackageName = `@codecrucible/rust-executor-linux-${process.arch}-gnu`;
      try {
        return require(gnuPackageName);
      } catch {
        // Try Musl variant
        const muslPackageName = `@codecrucible/rust-executor-linux-${process.arch}-musl`;
        try {
          return require(muslPackageName);
        } catch {
          // Fall through to try without ABI suffix
        }
      }
    }

    try {
      return require(packageName);
    } catch {
      // Fall through to manual loading
    }

    // Fallback to manual path resolution
    if (fallbackPath && existsSync(fallbackPath)) {
      return require(fallbackPath);
    }

    throw new Error(`No prebuilt binary available for ${process.platform}-${process.arch}`);
  } catch (error) {
    throw new Error(
      `Failed to load ${name}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export interface PlatformInfo {
  platform: string;
  arch: string;
  abi?: string;
}

/**
 * Get current platform information for NAPI binary selection
 */
export function getPlatformInfo(): PlatformInfo {
  const { platform, arch } = process;

  // Map Node.js platform names to NAPI naming convention
  const platformMap: Record<string, string> = {
    win32: 'win32',
    darwin: 'darwin',
    linux: 'linux',
    freebsd: 'freebsd',
    openbsd: 'openbsd',
  };

  // Map Node.js arch names to NAPI naming convention
  const archMap: Record<string, string> = {
    x64: 'x64',
    arm64: 'arm64',
    ia32: 'ia32',
    arm: 'arm',
  };

  const napiPlatform = platformMap[platform] || platform;
  const napiArch = archMap[arch] || arch;

  // Determine ABI
  let abi: string | undefined;
  if (platform === 'win32') {
    abi = 'msvc'; // Default to MSVC on Windows
  } else if (platform === 'linux') {
    // Detect GNU vs Musl libc
    // Default to GNU as it's most common
    // Alpine Linux uses Musl
    abi = detectLinuxABI();
  }

  return {
    platform: napiPlatform,
    arch: napiArch,
    abi,
  };
}

/**
 * Detect Linux ABI (GNU vs Musl)
 * Returns 'gnu' for most Linux distros, 'musl' for Alpine
 */
function detectLinuxABI(): string {
  try {
    // Check if we're on Alpine Linux (uses Musl)
    // Use explicit import type for fs
    const fs = require('fs') as typeof import('fs');
    if (fs.existsSync('/etc/alpine-release')) {
      return 'musl';
    }

    // Check ldd version for musl
    const { execSync } = require('child_process') as typeof import('child_process');
    try {
      const lddOutput: string = execSync('ldd --version 2>&1', { encoding: 'utf8' });
      if (lddOutput.toLowerCase().includes('musl')) {
        return 'musl';
      }
    } catch {
      // ldd might not exist or fail
    }
  } catch {
    // Default to GNU if detection fails
  }

  return 'gnu'; // Default to GNU
}

/**
 * Generate possible NAPI binary names for current platform
 */
export function generateBinaryNames(baseName: string): string[] {
  const { platform, arch, abi } = getPlatformInfo();

  const names: string[] = [];

  // Platform-specific with ABI (e.g., codecrucible-rust-executor.win32-x64-msvc.node)
  if (abi) {
    names.push(`${baseName}.${platform}-${arch}-${abi}.node`);

    // For Linux, also try the opposite ABI as fallback
    if (platform === 'linux') {
      const alternateABI = abi === 'gnu' ? 'musl' : 'gnu';
      names.push(`${baseName}.${platform}-${arch}-${alternateABI}.node`);
    }
  }

  // Platform-specific without ABI (e.g., codecrucible-rust-executor.darwin-arm64.node)
  names.push(`${baseName}.${platform}-${arch}.node`);

  // Generic fallbacks
  names.push(`${baseName}.node`);
  names.push('index.node');

  return names;
}

/**
 * Find the best NAPI binary for current platform
 */
export function findNAPIBinary(searchPaths: string[], baseName: string): string | null {
  const binaryNames = generateBinaryNames(baseName);

  logger.debug('Searching for NAPI binary:', { searchPaths, binaryNames });

  for (const searchPath of searchPaths) {
    for (const binaryName of binaryNames) {
      const fullPath = join(searchPath, binaryName);

      if (existsSync(fullPath)) {
        logger.info(`Found NAPI binary: ${fullPath}`);
        return fullPath;
      }
    }
  }

  logger.warn('No NAPI binary found', { searchPaths, binaryNames });
  return null;
}

/**
 * Load Rust executor module with cross-platform support
 * Uses napi-rs prebuild approach with fallback to local binary
 */
export interface RustExecutorModule {
  RustExecutor: new (...args: unknown[]) => {
    id: () => string;
    initialize: () => Promise<boolean>;
    execute: (toolId: string, args: string, options?: unknown) => unknown;
    executeFilesystem: (
      operation: string,
      path: string,
      content?: string,
      options?: unknown
    ) => unknown;
    executeCommand: (command: string, args: string[], options?: unknown) => unknown;
    read_file_fast: (path: string) => Promise<string>;
    is_runtime_available: () => boolean;
    get_runtime_stats: () => string;
    ensure_tokio_runtime: () => boolean;
    get_performance_metrics: () => Promise<string>;
    reset_performance_metrics: () => Promise<void>;
    health_check: () => string;
    get_supported_tools: () => string[];
    get_filesystem_operations: () => string[];
    get_supported_commands: () => string[];
    cleanup: () => void;
    stream_file: (
      filePath: string,
      chunkSize?: number,
      contextType?: string,
      callback?: unknown
    ) => string;
    stream_command: (
      command: string,
      args: string[],
      chunkSize?: number,
      callback?: unknown
    ) => string;
    terminateStream?: (sessionId: string) => void;
    send_input?: (sessionId: string, input: string) => void;
  };
  createRustExecutor?: () => unknown;
  initLogging?: (level?: string) => void;
  getVersion?: () => string;
  benchmarkExecution?: (iterations: number) => Promise<string>;
}

export function loadRustExecutor(baseDir?: string): RustExecutorModule {
  // First try to load from prebuilt binaries (napi-rs approach)
  try {
    return loadPrebuiltBinding('codecrucible-rust-executor') as RustExecutorModule;
  } catch (prebuiltError) {
    // FIXED: Reduce noise - use debug level instead of warn for expected fallback behavior
    logger.debug(
      'Prebuilt binary not available, falling back to local build:',
      toReadonlyRecord({ message: (prebuiltError as Error).message })
    );

    // Fallback to manual path resolution (for development)
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = dirname(currentFile);

    // Default base directory calculation if not provided
    const projectRoot = baseDir || join(currentDir, '../..');

    // Search paths in order of preference
    const searchPaths = [
      join(projectRoot, 'rust-executor'), // rust-executor directory
      projectRoot, // project root
      join(currentDir, '../rust-executor'), // relative to current file
      join(currentDir, '../../rust-executor'),
      join(currentDir, '../../../rust-executor'),
      join(currentDir, '../../../../rust-executor'),
    ];

    const binaryPath = findNAPIBinary(searchPaths, 'codecrucible-rust-executor');

    if (!binaryPath) {
      const error = new Error(
        `Rust executor binary not found. Tried prebuilt packages and local paths. ` +
          `Searched paths: ${searchPaths.join(', ')}. ` +
          `Expected binaries: ${generateBinaryNames('codecrucible-rust-executor').join(', ')}. ` +
          `Prebuilt error: ${(prebuiltError as Error).message}`
      );
      throw error;
    }

    try {
      const rustModule = loadPrebuiltBinding('codecrucible-rust-executor', binaryPath);
      logger.info(`Successfully loaded Rust executor from local build: ${binaryPath}`);
      return rustModule as RustExecutorModule;
    } catch (error) {
      const loadError = new Error(
        `Failed to load Rust executor from ${binaryPath}: ${error instanceof Error ? error.message : String(error)}`
      );
      throw loadError;
    }
  }
}

/**
 * Load Rust executor with graceful fallback
 * Supports both prebuilt binaries and local development builds
 */
export function loadRustExecutorSafely(baseDir?: string): {
  module: RustExecutorModule | null;
  available: boolean;
  error?: string;
  binaryPath?: string;
  source: 'prebuilt' | 'local' | 'none';
  diagnostics?: {
    platform: string;
    arch: string;
    abi?: string;
    searchPaths?: string[];
    triedPackages?: string[];
    nodeVersion: string;
  };
} {
  const diagnostics = {
    platform: process.platform,
    arch: process.arch,
    abi: getPlatformInfo().abi,
    nodeVersion: process.version,
    searchPaths: [] as string[],
    triedPackages: [] as string[],
  };

  try {
    const rustModule = loadRustExecutor(baseDir);

    // Try to determine the source
    let source: 'prebuilt' | 'local' = 'prebuilt';
    let binaryPath: string | undefined;

    try {
      // Check if prebuilt package exists
      let packageName = `@codecrucible/rust-executor-${process.platform}-${process.arch}`;
      diagnostics.triedPackages.push(packageName);

      // Add ABI suffix for platforms that need it
      const { abi } = getPlatformInfo();
      if (abi && (process.platform === 'win32' || process.platform === 'linux')) {
        packageName = `@codecrucible/rust-executor-${process.platform}-${process.arch}-${abi}`;
        diagnostics.triedPackages.push(packageName);
      }

      require.resolve(packageName);
      source = 'prebuilt';
      binaryPath = packageName;
    } catch {
      // Must be loaded from local build
      source = 'local';
      const searchPaths = baseDir
        ? [join(baseDir, 'rust-executor'), baseDir]
        : [
            join(dirname(fileURLToPath(import.meta.url)), '../..', 'rust-executor'),
            join(dirname(fileURLToPath(import.meta.url)), '../..'),
          ];

      diagnostics.searchPaths = searchPaths;
      binaryPath = findNAPIBinary(searchPaths, 'codecrucible-rust-executor') || undefined;
    }

    logger.info(`Rust executor loaded from ${source} source`, { binaryPath });

    return {
      module: rustModule,
      available: true,
      binaryPath,
      source,
      diagnostics,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // FIXED: Provide comprehensive error reporting instead of silencing failures
    logger.warn('Rust executor load failed - comprehensive diagnostics:', {
      error: errorMessage,
      diagnostics,
      possibleCauses: [
        'Rust binary not built for this platform',
        'Missing napi-rs dependencies',
        'Incorrect Node.js ABI version',
        'Platform-specific compilation issues',
      ],
      suggestedActions: [
        'Run `npm run build:rust` to build Rust executor',
        'Check if prebuilt binaries exist for your platform',
        'Verify Node.js version compatibility',
        'Review Rust compilation logs',
      ],
    });

    // Return fallback module with detailed diagnostic information
    return {
      module: createFallbackRustExecutor(
        `${errorMessage} | Platform: ${diagnostics.platform}-${diagnostics.arch}${diagnostics.abi ? `-${diagnostics.abi}` : ''} | Node: ${diagnostics.nodeVersion}`
      ),
      available: false,
      error: errorMessage,
      source: 'none',
      diagnostics,
    };
  }
}

/**
 * Create fallback Rust executor for when binary is not available
 * FIXED: Provide detailed error information instead of silencing failures
 */
export function createFallbackRustExecutor(error: string): RustExecutorModule {
  const detailedError = `Rust module not available: ${error}`;

  // Log the initialization failure with context
  logger.warn('Creating fallback Rust executor due to initialization failure', {
    error: detailedError,
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
  });

  const fallbackExecutor = {
    id: (): never => {
      throw new Error(detailedError);
    },
    initialize: async (): Promise<never> => {
      throw new Error(detailedError);
    },
    execute: (): never => {
      throw new Error(`Rust module not available: ${error}`);
    },
    executeFilesystem: (): never => {
      throw new Error(`Rust module not available: ${error}`);
    },
    executeCommand: (): never => {
      throw new Error(`Rust module not available: ${error}`);
    },
    read_file_fast: async (): Promise<never> => {
      throw new Error(`Rust file operations not available: ${error}`);
    },
    is_runtime_available: (): boolean => false,
    get_runtime_stats: (): string => JSON.stringify({ runtime_available: false, error }),
    ensure_tokio_runtime: (): boolean => false,
    get_performance_metrics: async (): Promise<string> =>
      Promise.resolve(
        JSON.stringify({
          total_requests: 0,
          successful_requests: 0,
          failed_requests: 0,
          average_execution_time_ms: 0,
          error: 'Rust module not available',
        })
      ),
    reset_performance_metrics: async (): Promise<void> => {
      logger.warn('Rust performance metrics not available - module failed to load');
      return Promise.resolve();
    },
    health_check: (): string => JSON.stringify({ status: 'unhealthy', reason: error }),
    get_supported_tools: (): string[] => [],
    get_filesystem_operations: (): string[] => [],
    get_supported_commands: (): string[] => [],
    cleanup: (): void => {
      /* no-op */
    },
    stream_file: (): never => {
      throw new Error(`Rust streaming not available: ${error}`);
    },
    stream_command: (): never => {
      throw new Error(`Rust streaming not available: ${error}`);
    },
  };

  return {
    RustExecutor: function RustExecutor() {
      return fallbackExecutor;
    } as unknown as new (...args: unknown[]) => InstanceType<RustExecutorModule['RustExecutor']>,

    createRustExecutor: (): never => {
      throw new Error(`Rust module not available: ${error}`);
    },

    initLogging: (): void => {
      logger.warn('Rust logging not available - module failed to load');
    },

    getVersion: (): string => 'unavailable',

    benchmarkExecution: async (): Promise<never> => {
      throw new Error(`Rust benchmarks not available: ${error}`);
    },
  };
}
