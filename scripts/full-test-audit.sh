#!/bin/bash

# CodeCrucible Full Test and Audit Script for Unix/Linux/macOS

set -e

echo "===================================================="
echo "  CodeCrucible Synth - Full Test and Audit"
echo "===================================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Set variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEST_LOG="$PROJECT_ROOT/test-results/full-test-$(date +%Y%m%d-%H%M).log"

# Create test results directory
mkdir -p "$PROJECT_ROOT/test-results"

echo "📋 Starting comprehensive test and audit..." | tee "$TEST_LOG"
echo "Test started at: $(date)" | tee -a "$TEST_LOG"
echo | tee -a "$TEST_LOG"

# Step 1: Check dependencies
echo -e "${BLUE}🔍 Step 1: Checking dependencies...${NC}" | tee -a "$TEST_LOG"

if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found${NC}" | tee -a "$TEST_LOG"
    exit 1
fi
echo "✅ Node.js found" | tee -a "$TEST_LOG"

if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found${NC}" | tee -a "$TEST_LOG"
    exit 1
fi
echo "✅ npm found" | tee -a "$TEST_LOG"

# Step 2: Install dependencies
echo -e "${BLUE}📦 Step 2: Installing dependencies...${NC}" | tee -a "$TEST_LOG"
cd "$PROJECT_ROOT"
npm install >> "$TEST_LOG" 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed" | tee -a "$TEST_LOG"
else
    echo -e "${RED}❌ npm install failed${NC}" | tee -a "$TEST_LOG"
    exit 1
fi

# Step 3: Run build
echo -e "${BLUE}🔨 Step 3: Building application...${NC}" | tee -a "$TEST_LOG"
npm run build >> "$TEST_LOG" 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Build successful" | tee -a "$TEST_LOG"
else
    echo -e "${RED}❌ Build failed${NC}" | tee -a "$TEST_LOG"
    exit 1
fi

# Step 4: Run backend audit
echo -e "${BLUE}🔍 Step 4: Running backend audit...${NC}" | tee -a "$TEST_LOG"
node scripts/audit-backend.js >> "$TEST_LOG" 2>&1
AUDIT_RESULT=$?
if [ $AUDIT_RESULT -eq 0 ]; then
    echo "✅ Backend audit passed" | tee -a "$TEST_LOG"
else
    echo -e "${YELLOW}⚠️  Backend audit found issues (exit code: $AUDIT_RESULT)${NC}" | tee -a "$TEST_LOG"
fi

# Step 5: Test basic application startup
echo -e "${BLUE}🚀 Step 5: Testing application startup...${NC}" | tee -a "$TEST_LOG"
timeout 3 node dist/index.js --version >> "$TEST_LOG" 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Application starts successfully" | tee -a "$TEST_LOG"
else
    echo -e "${RED}❌ Application startup failed${NC}" | tee -a "$TEST_LOG"
fi

# Step 6: Test help command
echo -e "${BLUE}📖 Step 6: Testing help system...${NC}" | tee -a "$TEST_LOG"
node dist/index.js --help >> "$TEST_LOG" 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Help system working" | tee -a "$TEST_LOG"
else
    echo -e "${RED}❌ Help system failed${NC}" | tee -a "$TEST_LOG"
fi

# Step 7: Test configuration
echo -e "${BLUE}⚙️  Step 7: Testing configuration system...${NC}" | tee -a "$TEST_LOG"
node dist/index.js config --list >> "$TEST_LOG" 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Configuration system working" | tee -a "$TEST_LOG"
else
    echo -e "${RED}❌ Configuration system failed${NC}" | tee -a "$TEST_LOG"
fi

# Step 8: Test model management (without requiring Ollama)
echo -e "${BLUE}🤖 Step 8: Testing model management...${NC}" | tee -a "$TEST_LOG"
node dist/index.js model --status >> "$TEST_LOG" 2>&1
echo "ℹ️  Model status check completed (Ollama may not be installed)" | tee -a "$TEST_LOG"

# Step 9: Test voice system
echo -e "${BLUE}🎭 Step 9: Testing voice system...${NC}" | tee -a "$TEST_LOG"
node dist/index.js voices --list >> "$TEST_LOG" 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Voice system working" | tee -a "$TEST_LOG"
else
    echo -e "${RED}❌ Voice system failed${NC}" | tee -a "$TEST_LOG"
fi

# Step 10: Run unit tests (if available)
echo -e "${BLUE}🧪 Step 10: Running unit tests...${NC}" | tee -a "$TEST_LOG"
npm test >> "$TEST_LOG" 2>&1
TEST_RESULT=$?
if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ Unit tests passed" | tee -a "$TEST_LOG"
else
    echo -e "${YELLOW}⚠️  Unit tests failed or had issues (exit code: $TEST_RESULT)${NC}" | tee -a "$TEST_LOG"
fi

# Step 11: Check for Ollama and test if available
echo -e "${BLUE}🔗 Step 11: Checking Ollama integration...${NC}" | tee -a "$TEST_LOG"
if curl -s http://localhost:11434 > /dev/null; then
    echo "✅ Ollama is running" | tee -a "$TEST_LOG"
    
    # Test model status with actual Ollama
    node dist/index.js model --status >> "$TEST_LOG" 2>&1
    echo "✅ Ollama integration tested" | tee -a "$TEST_LOG"
    
    # Test a simple voice query (with timeout)
    echo "Testing simple query..."
    timeout 30 node dist/index.js voice explorer "Say hello in one word" >> "$TEST_LOG" 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Voice query test passed" | tee -a "$TEST_LOG"
    else
        echo -e "${YELLOW}⚠️  Voice query test timed out or failed${NC}" | tee -a "$TEST_LOG"
    fi
else
    echo -e "${YELLOW}⚠️  Ollama not running (this is OK for local development)${NC}" | tee -a "$TEST_LOG"
    echo "ℹ️  Run 'ollama serve' to enable AI functionality" | tee -a "$TEST_LOG"
fi

# Generate summary
echo | tee -a "$TEST_LOG"
echo "====================================================" | tee -a "$TEST_LOG"
echo "  TEST SUMMARY" | tee -a "$TEST_LOG"
echo "====================================================" | tee -a "$TEST_LOG"
echo "Test completed at: $(date)" | tee -a "$TEST_LOG"

# Display results
echo
echo "===================================================="
echo "  TEST COMPLETED"
echo "===================================================="
echo
echo -e "${BLUE}📊 Test results saved to: $TEST_LOG${NC}"
echo
echo "📋 Summary:"
grep -E "✅|❌|⚠️" "$TEST_LOG"
echo
echo "💡 Tips:"
echo "  - If Ollama tests failed, install Ollama from https://ollama.ai"
echo "  - Run: ollama pull gpt-oss:20b (or similar model)"
echo "  - Start: ollama serve"
echo "  - Then rerun this test"
echo
echo "===================================================="