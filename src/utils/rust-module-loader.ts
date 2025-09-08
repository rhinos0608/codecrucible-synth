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
  RustExecutor: new (...args: unknown[]) => unknown;
  createRustExecutor?: (...args: readonly unknown[]) => unknown;
  initLogging?: (...args: readonly unknown[]) => void;
  getVersion?: () => string;
  benchmarkExecution?: (...args: readonly unknown[]) => unknown;
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
} {
  try {
    const rustModule = loadRustExecutor(baseDir);

    // Try to determine the source
    let source: 'prebuilt' | 'local' = 'prebuilt';
    let binaryPath: string | undefined;

    try {
      // Check if prebuilt package exists
      let packageName = `@codecrucible/rust-executor-${process.platform}-${process.arch}`;

      // Add ABI suffix for platforms that need it
      const { abi } = getPlatformInfo();
      if (abi && (process.platform === 'win32' || process.platform === 'linux')) {
        packageName = `@codecrucible/rust-executor-${process.platform}-${process.arch}-${abi}`;
      }

      require.resolve(packageName);
      source = 'prebuilt';
      binaryPath = packageName;
    } catch {
      // Must be loaded from local build
      source = 'local';
      binaryPath =
        findNAPIBinary(
          baseDir
            ? [join(baseDir, 'rust-executor'), baseDir]
            : [
                join(dirname(fileURLToPath(import.meta.url)), '../..', 'rust-executor'),
                join(dirname(fileURLToPath(import.meta.url)), '../..'),
              ],
          'codecrucible-rust-executor'
        ) || undefined;
    }

    logger.info(`Rust executor loaded from ${source} source`);

    return {
      module: rustModule,
      available: true,
      binaryPath,
      source,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // FIXED: Reduce noise - use debug level for expected missing binaries in development
    logger.debug('Rust executor not available:', errorMessage);

    return {
      module: null,
      available: false,
      error: errorMessage,
      source: 'none',
    };
  }
}

/**
 * Create fallback Rust executor for when binary is not available
 */
export function createFallbackRustExecutor(error: string): RustExecutorModule {
  return {
    RustExecutor: class RustExecutor {
      public constructor() {
        throw new Error(`Rust module not available: ${error}`);
      }

      public static create(): never {
        throw new Error(`Rust module not available: ${error}`);
      }

      public initialize(): never {
        throw new Error(`Rust module not available: ${error}`);
      }

      public id(): never {
        throw new Error(`Rust module not available: ${error}`);
      }

      public get_supported_tools(): never {
        throw new Error(`Rust module not available: ${error}`);
      }

      public getFilesystemOperations(): never {
        throw new Error(`Rust module not available: ${error}`);
      }

      public getSupportedCommands(): never {
        throw new Error(`Rust module not available: ${error}`);
      }

      public execute(_toolId: string, _args: string, _options?: unknown): never {
        throw new Error(`Rust module not available: ${error}`);
      }

      public executeFilesystem(_operation: string, _path: string, _content?: string, _options?: unknown): never {
        throw new Error(`Rust module not available: ${error}`);
      }

      public executeCommand(_command: string, _args: readonly string[], _options?: unknown): never {
        throw new Error(`Rust module not available: ${error}`);
      }

      public get_performance_metrics(): string {
        return JSON.stringify({
          total_requests: 0,
          successful_requests: 0,
          failed_requests: 0,
          average_execution_time_ms: 0,
          error: 'Rust module not available',
        });
      }

      public reset_performance_metrics(): void {
        logger.warn('Rust performance metrics not available - module failed to load');
      }

      public async healthCheck(): Promise<string> {
        return Promise.resolve(`unhealthy: ${error}`);
      }

      public async cleanup(): Promise<void> {
        return Promise.resolve();
      }

      public streamFile(): never {
        throw new Error(`Rust streaming not available: ${error}`);
      }

      public streamCommand(): never {
        throw new Error(`Rust streaming not available: ${error}`);
      }
    },

    createRustExecutor(): never {
      throw new Error(`Rust module not available: ${error}`);
    },

    initLogging(): void {
      logger.warn('Rust logging not available - module failed to load');
    },

    getVersion(): string {
      return 'unavailable';
    },

    benchmarkExecution(): never {
      throw new Error(`Rust benchmarks not available: ${error}`);
    },
  };
}
