@echo off
REM CodeCrucible Application Startup Script for Windows

setlocal enabledelayedexpansion

echo ====================================================
echo   CodeCrucible Synth - Application Launcher
echo ====================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js not found. Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Node.js detected
echo.

REM Check if npm dependencies are installed
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if %errorlevel% neq 0 (
        echo ❌ Failed to install dependencies
        pause
        exit /b 1
    )
)

echo ✅ Dependencies ready
echo.

REM Check if Ollama is running
echo 🔍 Checking Ollama service...
curl -s http://localhost:11434 >nul 2>&1
if %errorlevel% neq 0 (
    echo ⚠️  Ollama not running. Starting Ollama...
    start /B ollama serve
    
    echo ⏳ Waiting for Ollama to start...
    timeout /t 5 /nobreak >nul
    
    :wait_ollama
    curl -s http://localhost:11434 >nul 2>&1
    if %errorlevel% neq 0 (
        echo    Still waiting...
        timeout /t 2 /nobreak >nul
        goto wait_ollama
    )
)

echo ✅ Ollama service ready
echo.

REM Build the application
echo 🔨 Building application...
npm run build
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo ✅ Build complete
echo.

REM Check if any models are available
echo 🤖 Checking available models...
set MODEL_CHECK=false
for /f "tokens=*" %%i in ('ollama list') do (
    echo %%i | findstr /C:"mistral" /C:"llama" /C:"qwen" /C:"gpt-oss" /C:"codellama" >nul 2>&1
    if !errorlevel! equ 0 set MODEL_CHECK=true
)

if "!MODEL_CHECK!"=="false" (
    echo ❌ No compatible models found. Running model setup...
    call scripts\setup-models.bat
)

echo ✅ Models available
echo.

REM Start the application
echo 🚀 Starting CodeCrucible Synth...
echo.
echo ====================================================
echo   Application starting...
echo   Available commands:
echo   - cc --help          : Show help
echo   - cc --interactive   : Interactive mode  
echo   - cc agent          : Agentic mode
echo   - cc desktop        : Desktop GUI
echo ====================================================
echo.

REM Start in development mode for better error reporting
npm run start

echo.
echo Application ended.
pause