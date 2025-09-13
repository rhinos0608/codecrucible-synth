const { existsSync, readFileSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');

const { platform, arch } = process;

let bindingCache = null;

function isMusl() {
  if (!process.report || typeof process.report.getReport !== 'function') {
    try {
      const lddPath = execSync('which ldd').toString().trim();
      return readFileSync(lddPath, 'utf8').includes('musl');
    } catch {
      return true;
    }
  }
  const { glibcVersionRuntime } = process.report.getReport().header;
  return !glibcVersionRuntime;
}

const PLATFORM_ARCH_MAP = {
  'android-arm': 'android-arm-eabi',
  'android-arm64': 'android-arm64',
  'win32-ia32': 'win32-ia32-msvc',
  'win32-x64': 'win32-x64-msvc',
  'win32-arm64': 'win32-arm64-msvc',
  'darwin-universal': 'darwin-universal',
  'linux-x64-gnu': 'linux-x64-gnu',
  'linux-x64-musl': 'linux-x64-musl',
  'linux-arm64-gnu': 'linux-arm64-gnu',
  'linux-arm64-musl': 'linux-arm64-musl',
  'linux-arm': 'linux-arm-gnueabihf',
  'linux-riscv64-gnu': 'linux-riscv64-gnu',
  'linux-riscv64-musl': 'linux-riscv64-musl',
  'linux-s390x': 'linux-s390x-gnu',
  'freebsd-x64': 'freebsd-x64',
};

function resolveKey() {
  if (platform === 'darwin') return 'darwin-universal';
  if (platform === 'linux') {
    if (['x64', 'arm64', 'riscv64'].includes(arch)) {
      return `linux-${arch}-${isMusl() ? 'musl' : 'gnu'}`;
    }
    if (arch === 'arm') return 'linux-arm';
    if (arch === 's390x') return 'linux-s390x';
    return null;
  }
  return `${platform}-${arch}`;
}

function createDiagnosticInfo() {
  const key = resolveKey();
  const fileToken = key && PLATFORM_ARCH_MAP[key];
  const expectedFilename = fileToken ? `codecrucible-rust-executor.${fileToken}.node` : 'unknown';
  const expectedPackage = fileToken ? `@codecrucible/rust-executor-${fileToken}` : 'unknown';
  
  return {
    platform: platform,
    arch: arch,
    nodeVersion: process.version,
    resolvedKey: key,
    expectedFilename: expectedFilename,
    expectedPackage: expectedPackage,
    isMuslDetected: platform === 'linux' ? isMusl() : null,
    searchPaths: [
      join(__dirname, expectedFilename),
      `node_modules/${expectedPackage}`,
    ],
    supportedPlatforms: Object.keys(PLATFORM_ARCH_MAP),
  };
}

function handleError(message, cause) {
  const diagnostics = createDiagnosticInfo();
  
  // Create a comprehensive error message with diagnostics
  const errorDetails = [
    `❌ ${message}`,
    '',
    '🔍 DIAGNOSTIC INFORMATION:',
    `   Platform: ${diagnostics.platform}`,
    `   Architecture: ${diagnostics.arch}`,
    `   Node.js Version: ${diagnostics.nodeVersion}`,
    `   Resolved Key: ${diagnostics.resolvedKey || 'UNSUPPORTED'}`,
    diagnostics.isMuslDetected !== null ? `   Linux ABI: ${diagnostics.isMuslDetected ? 'musl' : 'glibc'}` : '',
    '',
    '📁 EXPECTED FILES:',
    `   Local Binary: ${diagnostics.expectedFilename}`,
    `   Package Name: ${diagnostics.expectedPackage}`,
    '',
    '🔍 SEARCH PATHS:',
    ...diagnostics.searchPaths.map(path => `   - ${path}`),
    '',
    '✅ SUPPORTED PLATFORMS:',
    ...diagnostics.supportedPlatforms.map(platform => `   - ${platform}`),
    '',
    '🛠️  SUGGESTED ACTIONS:',
    '   1. Run `npm run build:rust` to build the native module',
    '   2. Check if prebuilt binaries exist for your platform',
    '   3. Verify Node.js version compatibility (requires Node.js 14+)',
    '   4. For Linux: ensure correct ABI (glibc vs musl)',
    '   5. For custom platforms: check if your platform is supported',
    '',
    '📖 MORE HELP:',
    '   - Documentation: docs/RUST-NATIVE-MODULES.md',
    '   - Build guide: npm run build:rust --help',
    '   - Issue tracker: https://github.com/codecrucible/issues',
  ].filter(line => line !== '').join('\n');

  const error = new Error(errorDetails);
  
  // Add diagnostic properties for programmatic access
  error.diagnostics = diagnostics;
  error.originalMessage = message;
  error.platformSupported = !!diagnostics.resolvedKey;
  
  if (cause) {
    error.cause = cause;
    if (cause.stack) {
      error.stack += `\n\nCaused by: ${cause.stack}`;
    }
  }
  
  throw error;
}

function loadBinding() {
  if (bindingCache) return bindingCache;

  const key = resolveKey();
  const fileToken = key && PLATFORM_ARCH_MAP[key];
  if (!fileToken) {
    handleError(`Unsupported platform or architecture: ${platform} ${arch}`);
  }

  const filename = `codecrucible-rust-executor.${fileToken}.node`;
  const localFile = join(__dirname, filename);
  const packageName = `@codecrucible/rust-executor-${fileToken}`;

  const localExists = existsSync(localFile);
  try {
    bindingCache = localExists ? require(localFile) : require(packageName);
    return bindingCache;
  } catch (err) {
    const source = localExists ? localFile : packageName;
    handleError(`Missing native binding for ${platform} ${arch}. Tried to load ${source}`, err);
  }
}

const nativeBinding = loadBinding();

const {
  RustExecutor,
  createRustExecutor,
  initLogging,
  getVersion,
  benchmarkExecution,
  SecurityLevel,
} = nativeBinding;

module.exports = {
  RustExecutor,
  createRustExecutor,
  initLogging,
  getVersion,
  benchmarkExecution,
  SecurityLevel,
};
