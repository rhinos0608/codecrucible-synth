#!/usr/bin/env node

/**
 * Cross-platform binary builder for CodeCrucible Synth
 * Creates standalone executables for Windows, macOS, and Linux
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { mkdir, copyFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';

const execAsync = promisify(exec);

const BUILD_CONFIG = {
    targets: [
        { platform: 'win32', arch: 'x64', output: 'crucible-win.exe' },
        { platform: 'linux', arch: 'x64', output: 'crucible-linux' },
        { platform: 'darwin', arch: 'x64', output: 'crucible-macos' },
        { platform: 'darwin', arch: 'arm64', output: 'crucible-macos-arm64' }
    ],
    buildDir: 'build/standalone',
    sourceFile: 'dist/index.js',
    pkgConfig: {
        scripts: 'dist/**/*.js',
        assets: [
            'config/**/*',
            'node_modules/better-sqlite3/build/**/*'
        ],
        nodeVersion: '18'
    }
};

async function log(message, color = 'white') {
    console.log(chalk[color](message));
}

async function logStep(message) {
    console.log(chalk.blue(`🚀 ${message}`));
}

async function logSuccess(message) {
    console.log(chalk.green(`✅ ${message}`));
}

async function logError(message) {
    console.log(chalk.red(`❌ ${message}`));
}

async function ensureBuildDirectory() {
    logStep('Preparing build directory...');
    
    if (!existsSync(BUILD_CONFIG.buildDir)) {
        await mkdir(BUILD_CONFIG.buildDir, { recursive: true });
    }
    
    logSuccess('Build directory ready');
}

async function buildProject() {
    logStep('Building TypeScript project...');
    
    try {
        await execAsync('npm run build');
        logSuccess('TypeScript build completed');
    } catch (error) {
        logError('TypeScript build failed');
        throw error;
    }
}

async function createPkgConfig() {
    logStep('Creating pkg configuration...');
    
    const pkgConfig = {
        name: 'codecrucible-synth',
        version: '2.0.0',
        bin: BUILD_CONFIG.sourceFile,
        pkg: {
            scripts: BUILD_CONFIG.pkgConfig.scripts,
            assets: BUILD_CONFIG.pkgConfig.assets,
            outputPath: BUILD_CONFIG.buildDir
        }
    };
    
    await writeFile('pkg.json', JSON.stringify(pkgConfig, null, 2));
    logSuccess('pkg configuration created');
}

async function buildBinary(target) {
    const { platform, arch, output } = target;
    const targetString = `node${BUILD_CONFIG.pkgConfig.nodeVersion}-${platform}-${arch}`;
    const outputPath = join(BUILD_CONFIG.buildDir, output);
    
    logStep(`Building ${output} for ${platform}-${arch}...`);
    
    try {
        const command = `npx pkg ${BUILD_CONFIG.sourceFile} --targets ${targetString} --output ${outputPath}`;
        await execAsync(command);
        logSuccess(`Built ${output}`);
        
        // Make executable on Unix systems
        if (platform !== 'win32') {
            await execAsync(`chmod +x ${outputPath}`);
        }
        
        return { success: true, output: outputPath };
    } catch (error) {
        logError(`Failed to build ${output}: ${error.message}`);
        return { success: false, error: error.message };
    }
}

async function createInstallScripts() {
    logStep('Creating install scripts for binaries...');
    
    // Create download script for Unix systems
    const unixInstallScript = `#!/bin/bash

# CodeCrucible Synth - Binary Installer
set -e

# Configuration
REPO="rhinos0608/codecrucibe-synth"
INSTALL_DIR="$HOME/.local/bin"
BINARY_NAME="crucible"

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

log_info() { echo -e "\${BLUE}ℹ️  $1\${NC}"; }
log_success() { echo -e "\${GREEN}✅ $1\${NC}"; }
log_error() { echo -e "\${RED}❌ $1\${NC}"; }

# Detect OS and architecture
OS="unknown"
ARCH="unknown"

case "$(uname -s)" in
    Darwin*) OS="macos" ;;
    Linux*) OS="linux" ;;
    *) log_error "Unsupported OS: $(uname -s)"; exit 1 ;;
esac

case "$(uname -m)" in
    x86_64|amd64) ARCH="x64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *) log_error "Unsupported architecture: $(uname -m)"; exit 1 ;;
esac

# Determine binary name
if [ "$OS" = "macos" ] && [ "$ARCH" = "arm64" ]; then
    BINARY_FILE="crucible-macos-arm64"
else
    BINARY_FILE="crucible-$OS"
fi

DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/$BINARY_FILE"

log_info "Detected: $OS-$ARCH"
log_info "Downloading: $BINARY_FILE"

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download binary
if command -v curl >/dev/null 2>&1; then
    curl -L "$DOWNLOAD_URL" -o "$INSTALL_DIR/$BINARY_NAME"
elif command -v wget >/dev/null 2>&1; then
    wget "$DOWNLOAD_URL" -O "$INSTALL_DIR/$BINARY_NAME"
else
    log_error "curl or wget is required"
    exit 1
fi

# Make executable
chmod +x "$INSTALL_DIR/$BINARY_NAME"

# Check if install dir is in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    log_info "Adding $INSTALL_DIR to PATH"
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
    export PATH="$HOME/.local/bin:$PATH"
fi

log_success "CodeCrucible Synth installed successfully!"
log_info "Run 'crucible' to get started"
`;

    // Create PowerShell download script for Windows
    const windowsInstallScript = `# CodeCrucible Synth - Windows Binary Installer

$ErrorActionPreference = "Stop"

# Configuration
$Repo = "rhinos0608/codecrucibe-synth"
$InstallDir = "$env:USERPROFILE\\.local\\bin"
$BinaryName = "crucible.exe"
$BinaryFile = "crucible-win.exe"
$DownloadUrl = "https://github.com/$Repo/releases/latest/download/$BinaryFile"

function Write-Info { Write-Host "ℹ️  $args" -ForegroundColor Blue }
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Error { Write-Host "❌ $args" -ForegroundColor Red }

Write-Info "Downloading CodeCrucible Synth..."

# Create install directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

# Download binary
$BinaryPath = "$InstallDir\\$BinaryName"
try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $BinaryPath
} catch {
    Write-Error "Failed to download: $($_.Exception.Message)"
    exit 1
}

# Add to PATH if not already present
$UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($UserPath -notlike "*$InstallDir*") {
    $NewPath = "$UserPath;$InstallDir"
    [Environment]::SetEnvironmentVariable("PATH", $NewPath, "User")
    Write-Success "Added $InstallDir to PATH"
    Write-Info "Restart your terminal to use 'crucible' command"
} else {
    Write-Info "PATH already contains $InstallDir"
}

Write-Success "CodeCrucible Synth installed successfully!"
Write-Info "Run 'crucible' to get started"
`;

    // Write install scripts
    await writeFile(join(BUILD_CONFIG.buildDir, 'install.sh'), unixInstallScript);
    await writeFile(join(BUILD_CONFIG.buildDir, 'install.ps1'), windowsInstallScript);
    
    // Make Unix script executable
    await execAsync(`chmod +x ${join(BUILD_CONFIG.buildDir, 'install.sh')}`);
    
    logSuccess('Install scripts created');
}

async function createReleaseInfo() {
    logStep('Creating release information...');
    
    const releaseInfo = {
        name: 'CodeCrucible Synth',
        version: '2.0.0',
        description: 'Autonomous AI coding assistant for local models',
        platforms: BUILD_CONFIG.targets.map(t => `${t.platform}-${t.arch}`),
        installation: {
            npm: 'npm install -g codecrucible-synth',
            script: 'curl -sSL https://raw.githubusercontent.com/rhinos0608/codecrucibe-synth/main/install.sh | bash',
            binary: {
                linux: 'curl -LO https://github.com/rhinos0608/codecrucibe-synth/releases/latest/download/crucible-linux && chmod +x crucible-linux',
                macos: 'curl -LO https://github.com/rhinos0608/codecrucibe-synth/releases/latest/download/crucible-macos && chmod +x crucible-macos',
                windows: 'Invoke-WebRequest -Uri "https://github.com/rhinos0608/codecrucibe-synth/releases/latest/download/crucible-win.exe" -OutFile "crucible.exe"'
            }
        },
        features: [
            'Autonomous AI coding assistant',
            'Local model support (Ollama)',
            'Real-time file watching',
            'GPU acceleration',
            'Multi-voice AI synthesis',
            'Cross-platform binaries'
        ]
    };
    
    await writeFile(
        join(BUILD_CONFIG.buildDir, 'release-info.json'),
        JSON.stringify(releaseInfo, null, 2)
    );
    
    logSuccess('Release information created');
}

async function main() {
    console.log(chalk.blue('╔══════════════════════════════════════════════════════════════╗'));
    console.log(chalk.blue('║            CodeCrucible Synth - Binary Builder              ║'));
    console.log(chalk.blue('╚══════════════════════════════════════════════════════════════╝'));
    console.log();
    
    try {
        await ensureBuildDirectory();
        await buildProject();
        await createPkgConfig();
        
        const results = [];
        
        // Build all targets
        for (const target of BUILD_CONFIG.targets) {
            const result = await buildBinary(target);
            results.push({ target, ...result });
        }
        
        await createInstallScripts();
        await createReleaseInfo();
        
        // Summary
        console.log();
        log('📊 Build Summary:', 'cyan');
        
        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);
        
        if (successful.length > 0) {
            logSuccess(`Successfully built ${successful.length} binaries:`);
            successful.forEach(r => {
                console.log(chalk.gray(`   • ${r.target.output}`));
            });
        }
        
        if (failed.length > 0) {
            logError(`Failed to build ${failed.length} binaries:`);
            failed.forEach(r => {
                console.log(chalk.gray(`   • ${r.target.output}: ${r.error}`));
            });
        }
        
        console.log();
        logSuccess(`Binaries available in: ${BUILD_CONFIG.buildDir}`);
        log('Ready for release! 🚀', 'green');
        
    } catch (error) {
        logError(`Build failed: ${error.message}`);
        process.exit(1);
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(console.error);
}

export { main as buildBinaries };