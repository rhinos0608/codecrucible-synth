#!/bin/bash

# CodeCrucible Model Setup Script for Unix/Linux/macOS
# Automatically downloads and configures required AI models

set -e

echo "===================================================="
echo "  CodeCrucible Synth - Model Setup Automation"
echo "===================================================="
echo

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}❌ Ollama not found. Installing Ollama...${NC}"
    echo
    
    # Detect OS and install accordingly
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "📥 Downloading Ollama for macOS..."
        curl -fsSL https://ollama.com/install.sh | sh
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "📥 Installing Ollama for Linux..."
        curl -fsSL https://ollama.com/install.sh | sh
    else
        echo -e "${RED}❌ Unsupported OS. Please install Ollama manually from https://ollama.com${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Ollama installed successfully${NC}"
    echo
fi

echo -e "${GREEN}✅ Ollama detected${NC}"
echo

# Start Ollama service if not running
echo -e "${BLUE}🚀 Starting Ollama service...${NC}"
ollama serve &
OLLAMA_PID=$!

# Wait for service to be ready
echo -e "${YELLOW}⏳ Waiting for Ollama service to start...${NC}"
sleep 5

# Check if service is running
while ! curl -s http://localhost:11434 > /dev/null; do
    echo "   Still waiting for Ollama service..."
    sleep 2
done

echo -e "${GREEN}✅ Ollama service is running${NC}"
echo

# Define models to install (in order of preference)
MODELS=(
    "gpt-oss:20b"
    "llama3.1:70b" 
    "qwen2.5:72b"
    "codellama:34b"
    "mistral:7b"
)

echo -e "${BLUE}📦 Installing AI models for CodeCrucible...${NC}"
echo

MODEL_INSTALLED=false

for model in "${MODELS[@]}"; do
    echo "Checking model: $model"
    
    if ollama list | grep -q "$model"; then
        echo -e "${GREEN}✅ Model already installed: $model${NC}"
        MODEL_INSTALLED=true
        break
    else
        echo -e "${YELLOW}⚡ Pulling model: $model${NC}"
        if ollama pull "$model"; then
            echo -e "${GREEN}✅ Successfully installed: $model${NC}"
            MODEL_INSTALLED=true
            break
        else
            echo -e "${YELLOW}⚠️  Failed to install: $model - trying next model${NC}"
        fi
    fi
done

if [ "$MODEL_INSTALLED" = false ]; then
    echo -e "${RED}❌ No models could be installed. Please check your internet connection.${NC}"
    exit 1
fi

echo
echo -e "${GREEN}🎉 Model setup complete!${NC}"
echo

# Test the connection
echo -e "${BLUE}🧪 Testing model connection...${NC}"
TEST_RESPONSE=$(curl -s -X POST http://localhost:11434/api/chat \
    -H "Content-Type: application/json" \
    -d '{"model": "mistral:7b", "messages": [{"role": "user", "content": "Hello, can you respond with '\''Model test successful'\''?"}], "stream": false}' 2>/dev/null)

if echo "$TEST_RESPONSE" | grep -q "Model test successful"; then
    echo -e "${GREEN}✅ Model connection test passed!${NC}"
else
    echo -e "${YELLOW}⚠️  Model connection test failed, but models are installed${NC}"
fi

echo
echo "===================================================="
echo "  Setup Complete! You can now run CodeCrucible:"
echo "  npm run dev"
echo "  or"
echo "  npm run start"
echo "===================================================="
echo