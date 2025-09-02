/**
 * Cross-platform Rust module loader with napi-rs prebuild support
 * Handles platform-specific NAPI binary loading with fallbacks
 */

import { createRequire } from 'module';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../infrastructure/logging/unified-logger.js';

const require = createRequire(import.meta.url);

/**
 * Load prebuilt binary using napi-rs approach
 * Falls back to manual loading if prebuilt is not available
 */
function loadPrebuiltBinding(name: string, fallbackPath?: string): any {
  try {
    // Try to load from optionalDependencies first (napi-rs approach)
    const packageName = `@codecrucible/rust-executor-${process.platform}-${process.arch}`;
    if (process.platform === 'win32') {
      const winPackageName = `@codecrucible/rust-executor-win32-${process.arch}-msvc`;
      try {
        return require(winPackageName);
      } catch {
        // Fall through to try other variants
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
    throw new Error(`Failed to load ${name}: ${error instanceof Error ? error.message : String(error)}`);
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
  const platform = process.platform;
  const arch = process.arch;
  
  // Map Node.js platform names to NAPI naming convention
  const platformMap: Record<string, string> = {
    'win32': 'win32',
    'darwin': 'darwin',
    'linux': 'linux',
    'freebsd': 'freebsd',
    'openbsd': 'openbsd'
  };

  // Map Node.js arch names to NAPI naming convention  
  const archMap: Record<string, string> = {
    'x64': 'x64',
    'arm64': 'arm64',
    'ia32': 'ia32',
    'arm': 'arm'
  };

  const napiPlatform = platformMap[platform] || platform;
  const napiArch = archMap[arch] || arch;

  // Determine ABI for Windows
  let abi: string | undefined;
  if (platform === 'win32') {
    abi = 'msvc'; // Default to MSVC on Windows
  }

  return {
    platform: napiPlatform,
    arch: napiArch,
    abi
  };
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
export function loadRustExecutor(baseDir?: string): any {
  // First try to load from prebuilt binaries (napi-rs approach)
  try {
    return loadPrebuiltBinding('codecrucible-rust-executor');
  } catch (prebuiltError) {
    logger.warn('Prebuilt binary not available, falling back to local build:', prebuiltError.message);
    
    // Fallback to manual path resolution (for development)
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = dirname(currentFile);
    
    // Default base directory calculation if not provided
    const projectRoot = baseDir || join(currentDir, '../..');
    
    // Search paths in order of preference
    const searchPaths = [
      join(projectRoot, 'rust-executor'),  // rust-executor directory
      projectRoot,                         // project root
      join(currentDir, '../rust-executor'), // relative to current file
      join(currentDir, '../../rust-executor'),
      join(currentDir, '../../../rust-executor'),
      join(currentDir, '../../../../rust-executor')
    ];
    
    const binaryPath = findNAPIBinary(searchPaths, 'codecrucible-rust-executor');
    
    if (!binaryPath) {
      const error = new Error(
        `Rust executor binary not found. Tried prebuilt packages and local paths. ` +
        `Searched paths: ${searchPaths.join(', ')}. ` +
        `Expected binaries: ${generateBinaryNames('codecrucible-rust-executor').join(', ')}. ` +
        `Prebuilt error: ${prebuiltError.message}`
      );
      throw error;
    }
    
    try {
      const rustModule = loadPrebuiltBinding('codecrucible-rust-executor', binaryPath);
      logger.info(`Successfully loaded Rust executor from local build: ${binaryPath}`);
      return rustModule;
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
  module: any | null; 
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
      const packageName = `@codecrucible/rust-executor-${process.platform}-${process.arch}`;
      require.resolve(packageName);
      source = 'prebuilt';
      binaryPath = packageName;
    } catch {
      // Must be loaded from local build
      source = 'local';
      binaryPath = findNAPIBinary(
        baseDir ? [join(baseDir, 'rust-executor'), baseDir] : [
          join(dirname(fileURLToPath(import.meta.url)), '../..', 'rust-executor'),
          join(dirname(fileURLToPath(import.meta.url)), '../..')
        ],
        'codecrucible-rust-executor'
      ) || undefined;
    }
    
    logger.info(`Rust executor loaded from ${source} source`);
    
    return {
      module: rustModule,
      available: true,
      binaryPath,
      source
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn('Rust executor not available:', errorMessage);
    
    return {
      module: null,
      available: false,
      error: errorMessage,
      source: 'none'
    };
  }
}

/**
 * Create fallback Rust executor for when binary is not available
 */
export function createFallbackRustExecutor(error: string): any {
  return {
    RustExecutor: class RustExecutor {
      constructor() {
        throw new Error(`Rust module not available: ${error}`);
      }
      
      static create() {
        throw new Error(`Rust module not available: ${error}`);
      }
      
      initialize() {
        throw new Error(`Rust module not available: ${error}`);
      }
      
      streamFile() {
        throw new Error(`Rust streaming not available: ${error}`);
      }
      
      streamCommand() {
        throw new Error(`Rust streaming not available: ${error}`);
      }
    },
    
    createRustExecutor() {
      throw new Error(`Rust module not available: ${error}`);
    },
    
    initLogging() {
      logger.warn('Rust logging not available - module failed to load');
    },
    
    getVersion() {
      return 'unavailable';
    },
    
    benchmarkExecution() {
      throw new Error(`Rust benchmarks not available: ${error}`);
    }
  };
}