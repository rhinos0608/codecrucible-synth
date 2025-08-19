# CodeCrucible Synth - Install from GitHub (Before npm Publication)
# Usage: iwr -useb https://raw.githubusercontent.com/rhinos0608/codecrucibe-synth/main/install-from-git.ps1 | iex

$ErrorActionPreference = "Stop"

# Configuration
$RepoUrl = "https://github.com/rhinos0608/codecrucibe-synth.git"
$InstallDir = "$env:USERPROFILE\.codecrucible"

function Write-Info { Write-Host "ℹ️  $args" -ForegroundColor Blue }
function Write-Success { Write-Host "✅ $args" -ForegroundColor Green }
function Write-Warning { Write-Host "⚠️  $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "❌ $args" -ForegroundColor Red }
function Write-Step { Write-Host "🚀 $args" -ForegroundColor Cyan }

Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║            CodeCrucible Synth - Git Installation            ║" -ForegroundColor Blue
Write-Host "║         Install directly from GitHub repository             ║" -ForegroundColor Blue
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# Check system requirements
Write-Step "Checking system requirements..."

try {
    $nodeVersion = node --version
    $majorVersion = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($majorVersion -lt 18) {
        Write-Error "Node.js 18+ is required. Current version: $nodeVersion"
        exit 1
    }
} catch {
    Write-Error "Node.js is required but not installed."
    Write-Info "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
}

try {
    $npmVersion = npm --version
} catch {
    Write-Error "npm is required but not installed."
    exit 1
}

try {
    git --version | Out-Null
} catch {
    Write-Error "Git is required but not installed."
    Write-Info "Please install Git from https://git-scm.com/"
    exit 1
}

Write-Success "System requirements met: Node.js $nodeVersion, npm $npmVersion"

# Clone repository
Write-Step "Cloning CodeCrucible Synth repository..."

$repoDir = "$InstallDir\codecrucibe-synth"

if (Test-Path $repoDir) {
    Write-Info "Existing installation found. Updating..."
    Set-Location $repoDir
    git pull
} else {
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    Set-Location $InstallDir
    git clone $RepoUrl codecrucibe-synth
    Set-Location codecrucibe-synth
}

# Install dependencies and build
Write-Step "Installing dependencies..."
npm install

Write-Step "Building application..."
npm run build

# Create global command
Write-Step "Setting up global command..."

$binDir = "$env:USERPROFILE\.local\bin"
if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir -Force | Out-Null
}

# Create wrapper batch file
$batchContent = @"
@echo off
node "$env:USERPROFILE\.codecrucible\codecrucibe-synth\dist\index.js" %*
"@

$batchPath = "$binDir\crucible.bat"
$batchContent | Out-File -FilePath $batchPath -Encoding ASCII

# Add to PATH if needed
$userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notlike "*$binDir*") {
    Write-Info "Adding $binDir to PATH"
    $newPath = "$userPath;$binDir"
    [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
    $env:PATH += ";$binDir"
    Write-Success "Added to PATH. Restart terminal to use 'crucible' command"
} else {
    Write-Info "PATH already contains $binDir"
}

# Test installation
Write-Step "Testing installation..."

try {
    $process = Start-Process -FilePath "crucible" -ArgumentList "--help" -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput "$env:TEMP\crucible-test.txt"
    if ($process.ExitCode -eq 0) {
        Write-Success "Installation test passed!"
    } else {
        Write-Warning "Installation test completed with warnings"
    }
} catch {
    Write-Warning "Installation test failed (this may be normal on first run)"
}

Write-Host ""
Write-Success "CodeCrucible Synth installed successfully!"
Write-Host ""
Write-Info "🚀 Quick Start:"
Write-Host "  crucible                    # Start interactive mode" -ForegroundColor Yellow
Write-Host "  crucible agent              # Start agentic mode" -ForegroundColor Yellow
Write-Host "  crucible desktop            # Launch GUI application" -ForegroundColor Yellow
Write-Host "  crucible --help             # Show all commands" -ForegroundColor Yellow
Write-Host ""
Write-Info "📁 Installation: $InstallDir\codecrucibe-synth"
Write-Host ""
Write-Info "💡 If 'crucible' command not found, restart your terminal"