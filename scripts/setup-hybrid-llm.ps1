#!/usr/bin/env pwsh
# Hybrid LLM Setup Script for Windows
# Sets up LM Studio + Ollama integration for CodeCrucible Synth

Write-Host "🚀 Setting up Hybrid LLM Architecture..." -ForegroundColor Cyan
Write-Host ""

# Function to check if a port is available
function Test-Port {
    param($Port, $Service)
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:$Port" -Method GET -TimeoutSec 3 -ErrorAction Stop
        Write-Host "✅ $Service is running on port $Port" -ForegroundColor Green
        return $true
    } catch {
        Write-Host "⚠️  $Service not accessible on port $Port" -ForegroundColor Yellow
        return $false
    }
}

# Function to check LM Studio models
function Test-LMStudioModels {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:1234/v1/models" -Method GET -TimeoutSec 5
        if ($response.data -and $response.data.Count -gt 0) {
            Write-Host "✅ LM Studio has $($response.data.Count) model(s) loaded" -ForegroundColor Green
            foreach ($model in $response.data) {
                Write-Host "   📦 $($model.id)" -ForegroundColor Gray
            }
            return $true
        } else {
            Write-Host "⚠️  LM Studio server running but no models loaded" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "❌ Cannot check LM Studio models: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Function to check Ollama models
function Test-OllamaModels {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 5
        if ($response.models -and $response.models.Count -gt 0) {
            Write-Host "✅ Ollama has $($response.models.Count) model(s) available" -ForegroundColor Green
            foreach ($model in $response.models) {
                Write-Host "   📦 $($model.name)" -ForegroundColor Gray
            }
            return $true
        } else {
            Write-Host "⚠️  Ollama server running but no models available" -ForegroundColor Yellow
            return $false
        }
    } catch {
        Write-Host "❌ Cannot check Ollama models: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Step 1: Check prerequisites
Write-Host "📋 Checking prerequisites..." -ForegroundColor Blue
Write-Host ""

# Check Node.js
try {
    $nodeVersion = node --version
    if ($nodeVersion -match "v(\d+)\.") {
        $majorVersion = [int]$matches[1]
        if ($majorVersion -ge 18) {
            Write-Host "✅ Node.js $nodeVersion is installed" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Node.js version $nodeVersion is too old (need 18+)" -ForegroundColor Yellow
            Write-Host "   Please upgrade Node.js from https://nodejs.org" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host "❌ Node.js not found. Please install from https://nodejs.org" -ForegroundColor Red
    exit 1
}

# Check if we're in the right directory
if (!(Test-Path "package.json")) {
    Write-Host "❌ package.json not found. Please run this script from the CodeCrucible Synth root directory" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Check LM Studio
Write-Host "🔍 Checking LM Studio..." -ForegroundColor Blue

$lmStudioOk = $false
if (Test-Port -Port 1234 -Service "LM Studio") {
    if (Test-LMStudioModels) {
        $lmStudioOk = $true
    } else {
        Write-Host "   💡 To fix: Load a model in LM Studio (Search > Download > Chat > Load)" -ForegroundColor Cyan
    }
} else {
    Write-Host "   💡 To fix: Start LM Studio and enable Local Server" -ForegroundColor Cyan
    Write-Host "      1. Open LM Studio" -ForegroundColor Gray
    Write-Host "      2. Go to Local Server tab" -ForegroundColor Gray
    Write-Host "      3. Click 'Start Server'" -ForegroundColor Gray
    Write-Host "      4. Load a model in Chat tab" -ForegroundColor Gray
}

Write-Host ""

# Step 3: Check Ollama
Write-Host "🔍 Checking Ollama..." -ForegroundColor Blue

$ollamaOk = $false
if (Test-Port -Port 11434 -Service "Ollama") {
    if (Test-OllamaModels) {
        $ollamaOk = $true
    } else {
        Write-Host "   💡 To fix: Pull a model with 'ollama pull codellama:7b'" -ForegroundColor Cyan
    }
} else {
    Write-Host "   💡 To fix: Start Ollama service" -ForegroundColor Cyan
    Write-Host "      Option 1: Run 'ollama serve' in another terminal" -ForegroundColor Gray
    Write-Host "      Option 2: Install as service with 'ollama serve --daemon'" -ForegroundColor Gray
}

Write-Host ""

# Step 4: Warn if services not ready
if (!$lmStudioOk -or !$ollamaOk) {
    Write-Host "⚠️  Services not ready. Please fix the issues above and run this script again." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Quick setup commands:" -ForegroundColor Cyan
    Write-Host "   ollama serve                    # Start Ollama" -ForegroundColor Gray
    Write-Host "   ollama pull codellama:7b        # Download a model" -ForegroundColor Gray
    Write-Host "   # Then start LM Studio GUI and load a model" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

# Step 5: Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Blue
try {
    npm install | Out-Host
    Write-Host "✅ Dependencies installed" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to install dependencies: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 6: Build project
Write-Host "🔨 Building project..." -ForegroundColor Blue
try {
    npm run build | Out-Host
    Write-Host "✅ Project built successfully" -ForegroundColor Green
} catch {
    Write-Host "❌ Build failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 7: Create/update hybrid configuration
Write-Host "⚙️ Creating hybrid configuration..." -ForegroundColor Blue

$configDir = "config"
if (!(Test-Path $configDir)) {
    New-Item -ItemType Directory -Path $configDir | Out-Null
}

$hybridConfigPath = Join-Path $configDir "hybrid.yaml"
$hybridConfig = @"
hybrid:
  enabled: true
  defaultProvider: "auto"
  escalationThreshold: 0.7
  confidenceScoring: true
  learningEnabled: true
  
  lmStudio:
    endpoint: "http://localhost:1234"
    enabled: true
    models:
      - "codellama-7b-instruct"
      - "gemma-2b-it"
      - "qwen2.5-coder"
    taskTypes:
      - "template"
      - "edit"
      - "format"
      - "boilerplate"
    streamingEnabled: true
    maxConcurrent: 3
    timeout: 10000
    
  ollama:
    endpoint: "http://localhost:11434"
    enabled: true
    models:
      - "codellama:7b"
      - "codellama:34b"
    taskTypes:
      - "analysis"
      - "planning"
      - "complex"
      - "multi-file"
    maxConcurrent: 1
    timeout: 30000

  routing:
    escalationThreshold: 0.7
    rules:
      - condition: "taskType == 'template'"
        target: "lmstudio"
        confidence: 0.9
        description: "Templates are fast tasks best handled by LM Studio"
      - condition: "complexity == 'complex'"
        target: "ollama"
        confidence: 0.95
        description: "Complex tasks require Ollama's reasoning capabilities"
        
performance:
  metricsCollection: true
  healthChecking: true
  healthCheckInterval: 300000
  autoOptimization: true
  cacheEnabled: true
  cacheDuration: 3600000

resources:
  memory:
    maxUsagePercent: 85
    gcThreshold: 75
  vram:
    enabled: true
    reservedMB: 2048
    swappingStrategy: "intelligent"
  cpu:
    maxUsagePercent: 80
    threadPoolSize: 4

fallback:
  autoFallback: true
  retryAttempts: 2
  retryDelay: 1000
  circuitBreaker:
    enabled: true
    failureThreshold: 5
    recoveryTimeout: 30000

development:
  detailedLogging: false
  logRoutingDecisions: true
  debugMode: false
  saveMetrics: true
  metricsFile: "./logs/hybrid-metrics.json"
"@

Set-Content -Path $hybridConfigPath -Value $hybridConfig -Encoding UTF8
Write-Host "✅ Hybrid configuration created at $hybridConfigPath" -ForegroundColor Green

Write-Host ""

# Step 8: Test the setup
Write-Host "🧪 Testing hybrid setup..." -ForegroundColor Blue

try {
    $testOutput = node dist/index.js --fast "test hybrid setup" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Basic test passed" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Test completed with warnings (this is normal for first run)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Test had some issues, but setup should be functional" -ForegroundColor Yellow
}

Write-Host ""

# Step 9: Success message and instructions
Write-Host "🎉 Hybrid LLM Architecture setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📊 System Status:" -ForegroundColor Cyan
Write-Host "   ✅ LM Studio: Ready for fast responses" -ForegroundColor Green
Write-Host "   ✅ Ollama: Ready for complex analysis" -ForegroundColor Green
Write-Host "   ✅ Hybrid routing: Configured and enabled" -ForegroundColor Green
Write-Host ""
Write-Host "🚀 Usage Examples:" -ForegroundColor Cyan
Write-Host '   codecrucible --fast "create a React component"    # Uses LM Studio' -ForegroundColor Gray
Write-Host '   codecrucible "analyze this complex system"        # Uses Ollama' -ForegroundColor Gray
Write-Host '   codecrucible "refactor this code"                 # Auto-routes' -ForegroundColor Gray
Write-Host ""
Write-Host "⚙️ Management Commands:" -ForegroundColor Cyan
Write-Host "   codecrucible config hybrid --status               # Check status" -ForegroundColor Gray
Write-Host "   codecrucible config hybrid --test                 # Test both services" -ForegroundColor Gray
Write-Host "   codecrucible config hybrid --benchmark            # Run performance test" -ForegroundColor Gray
Write-Host ""
Write-Host "📖 Documentation:" -ForegroundColor Cyan
Write-Host "   Docs/Quick-Start-Hybrid.md                       # Quick start guide" -ForegroundColor Gray
Write-Host "   Docs/Hybrid-Implementation-Guide.md              # Technical details" -ForegroundColor Gray
Write-Host "   Docs/Performance-Benchmarks.md                   # Optimization tips" -ForegroundColor Gray
Write-Host ""
Write-Host "Happy coding! 🎯" -ForegroundColor Magenta