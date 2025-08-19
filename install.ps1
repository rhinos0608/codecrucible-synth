# CodeCrucible Synth - Windows PowerShell Installer
# Handles Ollama installation, model pulling, and system setup for Windows

param(
    [string]$InstallDir = "$env:USERPROFILE\.codecrucible",
    [string]$Model = "qwen2.5:7b",
    [switch]$Force
)

# Configuration
$RepoUrl = "https://github.com/rhinos0608/codecrucibe-synth"
$ConfigFile = "$InstallDir\config.yaml"
$BackupModels = @("gemma2:9b", "llama3.2:8b", "codellama:7b")

# Helper functions
function Write-ColoredOutput {
    param([string]$Message, [string]$Color = "White")
    Write-Host $Message -ForegroundColor $Color
}

function Write-Step { Write-ColoredOutput "🚀 $args" "Cyan" }
function Write-Success { Write-ColoredOutput "✅ $args" "Green" }
function Write-Warning { Write-ColoredOutput "⚠️  $args" "Yellow" }
function Write-Error { Write-ColoredOutput "❌ $args" "Red" }
function Write-Info { Write-ColoredOutput "ℹ️  $args" "Blue" }

function Test-Command {
    param([string]$Command)
    try {
        if (Get-Command $Command -ErrorAction SilentlyContinue) {
            return $true
        }
    } catch {
        return $false
    }
    return $false
}

function Test-NodeVersion {
    try {
        $version = node --version
        $majorVersion = [int]($version -replace 'v(\d+)\..*', '$1')
        return $majorVersion -ge 18
    } catch {
        return $false
    }
}

function Test-OllamaRunning {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 5 -ErrorAction SilentlyContinue
        return $true
    } catch {
        return $false
    }
}

function Install-Ollama {
    Write-Step "Checking for Ollama..."
    
    if (Test-Command "ollama") {
        $version = ollama --version
        Write-Success "Ollama already installed: $version"
        return
    }
    
    Write-Info "Ollama not found. Installing..."
    
    # Download and install Ollama for Windows
    $ollamaUrl = "https://ollama.com/download/windows"
    Write-Info "Please download and install Ollama from: $ollamaUrl"
    Write-Info "Opening download page in browser..."
    
    Start-Process $ollamaUrl
    
    Write-Warning "Please install Ollama and restart this script."
    Read-Host "Press Enter after installing Ollama"
    
    if (-not (Test-Command "ollama")) {
        Write-Error "Ollama installation not detected. Please ensure Ollama is installed and in PATH."
        exit 1
    }
    
    Write-Success "Ollama installation verified!"
}

function Start-OllamaService {
    Write-Step "Starting Ollama service..."
    
    if (Test-OllamaRunning) {
        Write-Success "Ollama service is already running"
        return
    }
    
    Write-Info "Starting Ollama service..."
    
    # Start Ollama service in background
    $job = Start-Job -ScriptBlock { ollama serve }
    
    # Wait for service to start (max 30 seconds)
    $timeout = 30
    for ($i = 0; $i -lt $timeout; $i++) {
        if (Test-OllamaRunning) {
            Write-Success "Ollama service started successfully"
            return
        }
        Start-Sleep 1
    }
    
    Write-Error "Failed to start Ollama service"
    exit 1
}

function Install-Models {
    Write-Step "Pulling AI models..."
    
    # Try to pull the default model
    Write-Info "Pulling primary model: $Model"
    try {
        ollama pull $Model
        Write-Success "Successfully pulled $Model"
        return $Model
    } catch {
        Write-Warning "Failed to pull $Model. Trying backup models..."
    }
    
    # Try backup models
    foreach ($backupModel in $BackupModels) {
        Write-Info "Trying backup model: $backupModel"
        try {
            ollama pull $backupModel
            Write-Success "Successfully pulled $backupModel"
            return $backupModel
        } catch {
            Write-Warning "Failed to pull $backupModel"
        }
    }
    
    Write-Error "Failed to pull any models. Please check your internet connection."
    exit 1
}

function Install-CodeCrucible {
    Write-Step "Installing CodeCrucible Synth..."
    
    # Create installation directory
    if (-not (Test-Path $InstallDir)) {
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }
    
    Set-Location $InstallDir
    
    # Clone or update repository
    $repoDir = "$InstallDir\codecrucibe-synth"
    if (Test-Path $repoDir) {
        Write-Info "Updating existing installation..."
        Set-Location $repoDir
        git pull
    } else {
        Write-Info "Cloning repository..."
        git clone $RepoUrl codecrucibe-synth
        Set-Location codecrucibe-synth
    }
    
    # Install dependencies
    Write-Info "Installing dependencies..."
    npm install
    
    # Build the project
    Write-Info "Building project..."
    npm run build
    
    Write-Success "CodeCrucible Synth installed successfully!"
}

function New-Configuration {
    param([string]$ModelName)
    
    Write-Step "Creating configuration..."
    
    $configContent = @"
# CodeCrucible Synth Configuration
model:
  endpoint: "http://localhost:11434"
  name: "$ModelName"
  timeout: 30000
  maxTokens: 4096
  temperature: 0.7

voices:
  enabled: true
  defaultMode: "competitive"
  
mcp:
  servers:
    filesystem:
      enabled: true
    git:
      enabled: true
    terminal:
      enabled: true

features:
  fileWatching: true
  autoSetup: true
  gpu: true

cli:
  colors: true
  verbose: false
"@
    
    $configContent | Out-File -FilePath $ConfigFile -Encoding UTF8
    Write-Success "Configuration created at $ConfigFile"
}

function Add-ToPath {
    Write-Step "Setting up PATH and aliases..."
    
    $cruciblePath = "$InstallDir\codecrucibe-synth\dist\index.js"
    $binDir = "$InstallDir\bin"
    
    # Create bin directory
    if (-not (Test-Path $binDir)) {
        New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    }
    
    # Create batch file wrapper
    $batchContent = @"
@echo off
node "$cruciblePath" %*
"@
    $batchContent | Out-File -FilePath "$binDir\crucible.bat" -Encoding ASCII
    
    # Add to user PATH if not already present
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($userPath -notlike "*$binDir*") {
        $newPath = "$userPath;$binDir"
        [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
        Write-Success "Added $binDir to PATH"
        Write-Info "Restart your PowerShell/Command Prompt to use 'crucible' command"
    } else {
        Write-Info "PATH already contains $binDir"
    }
    
    # Update current session PATH
    $env:PATH += ";$binDir"
}

function Test-Installation {
    Write-Step "Testing installation..."
    
    # Test Ollama connectivity
    if (-not (Test-OllamaRunning)) {
        Write-Error "Cannot connect to Ollama service"
        return $false
    }
    
    # Test if models are available
    try {
        $models = ollama list
        if ($models -notmatch $Model) {
            Write-Error "Model $Model not found"
            return $false
        }
    } catch {
        Write-Error "Failed to list Ollama models"
        return $false
    }
    
    # Test CodeCrucible
    Set-Location "$InstallDir\codecrucibe-synth"
    try {
        $process = Start-Process -FilePath "node" -ArgumentList "dist/index.js", "--help" -Wait -PassThru -WindowStyle Hidden
        if ($process.ExitCode -ne 0) {
            Write-Error "CodeCrucible failed to start"
            return $false
        }
    } catch {
        Write-Error "Failed to test CodeCrucible"
        return $false
    }
    
    Write-Success "Installation test passed!"
    return $true
}

function Show-SuccessMessage {
    Write-Host ""
    Write-ColoredOutput "🎉 CodeCrucible Synth installed successfully!" "Green"
    Write-Host ""
    Write-ColoredOutput "📋 Quick Start:" "Cyan"
    Write-Host "  crucible                    # Start interactive mode" -ForegroundColor Yellow
    Write-Host "  crucible --help             # Show all commands" -ForegroundColor Yellow
    Write-Host "  crucible agent              # Start agentic mode" -ForegroundColor Yellow
    Write-Host "  crucible desktop            # Launch GUI app" -ForegroundColor Yellow
    Write-Host ""
    Write-ColoredOutput "📁 Configuration: $ConfigFile" "Cyan"
    Write-ColoredOutput "📦 Installation: $InstallDir\codecrucibe-synth" "Cyan"
    Write-Host ""
    Write-ColoredOutput "💡 If 'crucible' command not found, restart your terminal" "Blue"
    Write-Host ""
}

# Main installation flow
function Main {
    Write-Host ""
    Write-ColoredOutput "╔══════════════════════════════════════════════════════════════╗" "Blue"
    Write-ColoredOutput "║               CodeCrucible Synth Installer                  ║" "Blue"
    Write-ColoredOutput "║          Autonomous AI Coding Assistant for Local Models    ║" "Blue"
    Write-ColoredOutput "╚══════════════════════════════════════════════════════════════╝" "Blue"
    Write-Host ""
    
    # Check system requirements
    Write-Step "Checking system requirements..."
    
    if (-not (Test-Command "node") -or -not (Test-NodeVersion)) {
        Write-Error "Node.js 18+ is required but not installed."
        Write-Info "Please install Node.js from https://nodejs.org/"
        exit 1
    }
    
    if (-not (Test-Command "npm")) {
        Write-Error "npm is required but not installed."
        exit 1
    }
    
    if (-not (Test-Command "git")) {
        Write-Error "Git is required but not installed."
        Write-Info "Please install Git from https://git-scm.com/"
        exit 1
    }
    
    $nodeVersion = node --version
    $npmVersion = npm --version
    Write-Success "System requirements met: Node.js $nodeVersion, npm $npmVersion"
    
    try {
        Install-Ollama
        Start-OllamaService
        $installedModel = Install-Models
        Install-CodeCrucible
        New-Configuration -ModelName $installedModel
        Add-ToPath
        
        if (Test-Installation) {
            Show-SuccessMessage
        } else {
            Write-Error "Installation test failed. Please check the logs above."
            exit 1
        }
    } catch {
        Write-Error "Installation failed: $($_.Exception.Message)"
        exit 1
    }
}

# Run main function
Main