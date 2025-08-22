@echo off
REM CodeCrucible Model Setup Script for Windows
REM Automatically downloads and configures required AI models

setlocal enabledelayedexpansion

echo ====================================================
echo   CodeCrucible Synth - Model Setup Automation
echo ====================================================
echo.

REM Check if Ollama is installed
where ollama >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Ollama not found. Installing Ollama...
    echo.
    echo Downloading Ollama installer...
    powershell -Command "Invoke-WebRequest -Uri 'https://ollama.com/download/windows' -OutFile 'ollama-setup.exe'"
    
    echo Installing Ollama...
    start /wait ollama-setup.exe
    del ollama-setup.exe
    
    echo Ollama installed. Please restart this script.
    pause
    exit /b 1
)

echo ✅ Ollama detected
echo.

REM Start Ollama service if not running
echo 🚀 Starting Ollama service...
start /B ollama serve

REM Wait for service to be ready
echo ⏳ Waiting for Ollama service to start...
timeout /t 5 /nobreak >nul

:wait_loop
curl -s http://localhost:11434 >nul 2>&1
if %errorlevel% neq 0 (
    echo    Still waiting for Ollama service...
    timeout /t 2 /nobreak >nul
    goto wait_loop
)

echo ✅ Ollama service is running
echo.

REM Define models to install (in order of preference)
set models=gpt-oss:20b llama3.1:70b qwen2.5:72b codellama:34b mistral:7b

echo 📦 Installing AI models for CodeCrucible...
echo.

for %%m in (%models%) do (
    echo Checking model: %%m
    ollama list | findstr "%%m" >nul 2>&1
    if %errorlevel% neq 0 (
        echo ⚡ Pulling model: %%m
        ollama pull %%m
        if %errorlevel% equ 0 (
            echo ✅ Successfully installed: %%m
            goto model_success
        ) else (
            echo ⚠️  Failed to install: %%m - trying next model
        )
    ) else (
        echo ✅ Model already installed: %%m
        goto model_success
    )
)

echo ❌ No models could be installed. Please check your internet connection.
pause
exit /b 1

:model_success
echo.
echo 🎉 Model setup complete!
echo.

REM Test the connection
echo 🧪 Testing model connection...
curl -X POST http://localhost:11434/api/chat ^
    -H "Content-Type: application/json" ^
    -d "{\"model\": \"mistral:7b\", \"messages\": [{\"role\": \"user\", \"content\": \"Hello, can you respond with 'Model test successful'?\"}], \"stream\": false}" 2>nul | findstr "Model test successful" >nul

if %errorlevel% equ 0 (
    echo ✅ Model connection test passed!
) else (
    echo ⚠️  Model connection test failed, but models are installed
)

echo.
echo ====================================================
echo   Setup Complete! You can now run CodeCrucible:
echo   npm run dev
echo   or
echo   npm run start
echo ====================================================
echo.

pause