#!/bin/bash

# CodeCrucible Application Startup Script for Unix/Linux/macOS

set -e

echo "===================================================="
echo "  CodeCrucible Synth - Application Launcher"
echo "===================================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js from https://nodejs.org${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js detected${NC}"
echo

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Installing dependencies...${NC}"
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to install dependencies${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Dependencies ready${NC}"
echo

# Check if Ollama is running
echo -e "${BLUE}🔍 Checking Ollama service...${NC}"
if ! curl -s http://localhost:11434 > /dev/null; then
    echo -e "${YELLOW}⚠️  Ollama not running. Starting Ollama...${NC}"
    ollama serve &
    OLLAMA_PID=$!
    
    echo -e "${YELLOW}⏳ Waiting for Ollama to start...${NC}"
    sleep 5
    
    while ! curl -s http://localhost:11434 > /dev/null; do
        echo "   Still waiting..."
        sleep 2
    done
fi

echo -e "${GREEN}✅ Ollama service ready${NC}"
echo

# Build the application
echo -e "${BLUE}🔨 Building application...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build complete${NC}"
echo

# Check if any models are available
echo -e "${BLUE}🤖 Checking available models...${NC}"
MODEL_CHECK=$(ollama list | grep -E "(mistral|llama|qwen|gpt-oss|codellama)" || true)

if [ -z "$MODEL_CHECK" ]; then
    echo -e "${YELLOW}❌ No compatible models found. Running model setup...${NC}"
    chmod +x scripts/setup-models.sh
    ./scripts/setup-models.sh
fi

echo -e "${GREEN}✅ Models available${NC}"
echo

# Start the application
echo -e "${BLUE}🚀 Starting CodeCrucible Synth...${NC}"
echo
echo "===================================================="
echo "  Application starting..."
echo "  Available commands:"
echo "  - cc --help          : Show help"
echo "  - cc --interactive   : Interactive mode"  
echo "  - cc agent          : Agentic mode"
echo "  - cc desktop        : Desktop GUI"
echo "===================================================="
echo

# Start in development mode for better error reporting
npm run start

echo
echo "Application ended."