#!/usr/bin/env powershell
# Configure Ollama for CPU-only execution to avoid GPU conflicts with LM Studio

Write-Host "🔧 Configuring Ollama for CPU-only execution..." -ForegroundColor Cyan

# Stop Ollama service if running
Write-Host "Stopping Ollama service..." -ForegroundColor Yellow
try {
    Stop-Process -Name "ollama" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
} catch {
    Write-Host "No running Ollama processes found" -ForegroundColor Gray
}

# Set environment variables for CPU-only execution
Write-Host "Setting CPU-only environment variables..." -ForegroundColor Yellow
$env:OLLAMA_NUM_GPU = "0"
$env:OLLAMA_CPU_TARGET = "cpu"
$env:CUDA_VISIBLE_DEVICES = ""

# Start Ollama with CPU-only configuration
Write-Host "Starting Ollama in CPU-only mode..." -ForegroundColor Yellow
Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Hidden

# Wait for Ollama to start
Start-Sleep -Seconds 5

# Test Ollama availability
Write-Host "Testing Ollama availability..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method GET -TimeoutSec 10
    Write-Host "✅ Ollama is running and accessible" -ForegroundColor Green
    
    # List available models
    Write-Host "Available models:" -ForegroundColor Cyan
    if ($response.models) {
        foreach ($model in $response.models) {
            Write-Host "  - $($model.name)" -ForegroundColor White
        }
    } else {
        Write-Host "  No models installed" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "❌ Failed to connect to Ollama: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Pull a small CPU-optimized model if none exist
try {
    $models = (Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -Method GET).models
    if (-not $models -or $models.Count -eq 0) {
        Write-Host "Installing CPU-optimized model..." -ForegroundColor Yellow
        Start-Process -FilePath "ollama" -ArgumentList "pull", "gemma:2b" -Wait -NoNewWindow
        Write-Host "✅ Installed gemma:2b for CPU execution" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not install model automatically. Please run: ollama pull gemma:2b" -ForegroundColor Yellow
}

Write-Host "" 
Write-Host "🎉 Ollama configuration completed!" -ForegroundColor Green
Write-Host "Ollama is now configured for CPU-only execution to avoid conflicts with LM Studio GPU usage." -ForegroundColor White
Write-Host "" 
Write-Host "Environment Variables Set:" -ForegroundColor Cyan
Write-Host "  OLLAMA_NUM_GPU=0" -ForegroundColor Gray
Write-Host "  OLLAMA_CPU_TARGET=cpu" -ForegroundColor Gray
Write-Host "  CUDA_VISIBLE_DEVICES=" -ForegroundColor Gray
Write-Host ""
Write-Host "To revert to GPU mode, restart PowerShell and run 'ollama serve' normally." -ForegroundColor Yellow