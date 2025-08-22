@echo off
REM CodeCrucible Full Test and Audit Script for Windows

setlocal enabledelayedexpansion

echo ====================================================
echo   CodeCrucible Synth - Full Test and Audit
echo ====================================================
echo.

REM Set variables
set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..
set TEST_LOG=%PROJECT_ROOT%\test-results\full-test-%date:~10,4%%date:~4,2%%date:~7,2%-%time:~0,2%%time:~3,2%.log

REM Create test results directory
if not exist "%PROJECT_ROOT%\test-results" mkdir "%PROJECT_ROOT%\test-results"

echo 📋 Starting comprehensive test and audit... > "%TEST_LOG%"
echo Test started at: %date% %time% >> "%TEST_LOG%"
echo. >> "%TEST_LOG%"

REM Step 1: Check dependencies
echo 🔍 Step 1: Checking dependencies...
echo 🔍 Step 1: Checking dependencies... >> "%TEST_LOG%"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Node.js not found
    echo ❌ Node.js not found >> "%TEST_LOG%"
    pause
    exit /b 1
)
echo ✅ Node.js found >> "%TEST_LOG%"

where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ npm not found
    echo ❌ npm not found >> "%TEST_LOG%"
    pause
    exit /b 1
)
echo ✅ npm found >> "%TEST_LOG%"

REM Step 2: Install dependencies
echo 📦 Step 2: Installing dependencies...
echo 📦 Step 2: Installing dependencies... >> "%TEST_LOG%"
cd /d "%PROJECT_ROOT%"
npm install >> "%TEST_LOG%" 2>&1
if %errorlevel% neq 0 (
    echo ❌ npm install failed
    echo ❌ npm install failed >> "%TEST_LOG%"
    pause
    exit /b 1
)
echo ✅ Dependencies installed >> "%TEST_LOG%"

REM Step 3: Run build
echo 🔨 Step 3: Building application...
echo 🔨 Step 3: Building application... >> "%TEST_LOG%"
npm run build >> "%TEST_LOG%" 2>&1
if %errorlevel% neq 0 (
    echo ❌ Build failed
    echo ❌ Build failed >> "%TEST_LOG%"
    pause
    exit /b 1
)
echo ✅ Build successful >> "%TEST_LOG%"

REM Step 4: Run backend audit
echo 🔍 Step 4: Running backend audit...
echo 🔍 Step 4: Running backend audit... >> "%TEST_LOG%"
node scripts/audit-backend.js >> "%TEST_LOG%" 2>&1
set AUDIT_RESULT=%errorlevel%
if %AUDIT_RESULT% equ 0 (
    echo ✅ Backend audit passed >> "%TEST_LOG%"
) else (
    echo ⚠️  Backend audit found issues (exit code: %AUDIT_RESULT%) >> "%TEST_LOG%"
)

REM Step 5: Test basic application startup
echo 🚀 Step 5: Testing application startup...
echo 🚀 Step 5: Testing application startup... >> "%TEST_LOG%"
timeout 3 node dist/index.js --version >> "%TEST_LOG%" 2>&1
if %errorlevel% equ 0 (
    echo ✅ Application starts successfully >> "%TEST_LOG%"
) else (
    echo ❌ Application startup failed >> "%TEST_LOG%"
)

REM Step 6: Test help command
echo 📖 Step 6: Testing help system...
echo 📖 Step 6: Testing help system... >> "%TEST_LOG%"
node dist/index.js --help >> "%TEST_LOG%" 2>&1
if %errorlevel% equ 0 (
    echo ✅ Help system working >> "%TEST_LOG%"
) else (
    echo ❌ Help system failed >> "%TEST_LOG%"
)

REM Step 7: Test configuration
echo ⚙️  Step 7: Testing configuration system...
echo ⚙️  Step 7: Testing configuration system... >> "%TEST_LOG%"
node dist/index.js config --list >> "%TEST_LOG%" 2>&1
if %errorlevel% equ 0 (
    echo ✅ Configuration system working >> "%TEST_LOG%"
) else (
    echo ❌ Configuration system failed >> "%TEST_LOG%"
)

REM Step 8: Test model management (without requiring Ollama)
echo 🤖 Step 8: Testing model management...
echo 🤖 Step 8: Testing model management... >> "%TEST_LOG%"
node dist/index.js model --status >> "%TEST_LOG%" 2>&1
echo ℹ️  Model status check completed (Ollama may not be installed) >> "%TEST_LOG%"

REM Step 9: Test voice system
echo 🎭 Step 9: Testing voice system...
echo 🎭 Step 9: Testing voice system... >> "%TEST_LOG%"
node dist/index.js voices --list >> "%TEST_LOG%" 2>&1
if %errorlevel% equ 0 (
    echo ✅ Voice system working >> "%TEST_LOG%"
) else (
    echo ❌ Voice system failed >> "%TEST_LOG%"
)

REM Step 10: Run unit tests (if available)
echo 🧪 Step 10: Running unit tests...
echo 🧪 Step 10: Running unit tests... >> "%TEST_LOG%"
npm test >> "%TEST_LOG%" 2>&1
set TEST_RESULT=%errorlevel%
if %TEST_RESULT% equ 0 (
    echo ✅ Unit tests passed >> "%TEST_LOG%"
) else (
    echo ⚠️  Unit tests failed or had issues (exit code: %TEST_RESULT%) >> "%TEST_LOG%"
)

REM Step 11: Check for Ollama and test if available
echo 🔗 Step 11: Checking Ollama integration...
echo 🔗 Step 11: Checking Ollama integration... >> "%TEST_LOG%"
curl -s http://localhost:11434 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Ollama is running >> "%TEST_LOG%"
    
    REM Test model status with actual Ollama
    node dist/index.js model --status >> "%TEST_LOG%" 2>&1
    echo ✅ Ollama integration tested >> "%TEST_LOG%"
    
    REM Test a simple voice query (with timeout)
    echo Testing simple query...
    timeout 30 node dist/index.js voice explorer "Say hello in one word" >> "%TEST_LOG%" 2>&1
    if %errorlevel% equ 0 (
        echo ✅ Voice query test passed >> "%TEST_LOG%"
    ) else (
        echo ⚠️  Voice query test timed out or failed >> "%TEST_LOG%"
    )
) else (
    echo ⚠️  Ollama not running (this is OK for local development) >> "%TEST_LOG%"
    echo ℹ️  Run 'ollama serve' to enable AI functionality >> "%TEST_LOG%"
)

REM Generate summary
echo. >> "%TEST_LOG%"
echo ====================================================>> "%TEST_LOG%"
echo   TEST SUMMARY>> "%TEST_LOG%"
echo ====================================================>> "%TEST_LOG%"
echo Test completed at: %date% %time% >> "%TEST_LOG%"

REM Display results
echo.
echo ====================================================
echo   TEST COMPLETED
echo ====================================================
echo.
echo 📊 Test results saved to: %TEST_LOG%
echo.
echo 📋 Summary:
type "%TEST_LOG%" | findstr "✅ ❌ ⚠️"
echo.
echo 💡 Tips:
echo   - If Ollama tests failed, install Ollama from https://ollama.ai
echo   - Run: ollama pull gpt-oss:20b (or similar model)
echo   - Start: ollama serve
echo   - Then rerun this test
echo.
echo ====================================================

pause