#!/bin/bash

# CodeCrucible Synth - One-Liner Installer Script
# Usage: curl -sSL https://raw.githubusercontent.com/rhinos0608/codecrucibe-synth/main/install.sh | bash
# Handles Ollama installation, progressive model pulling, and autonomous setup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
REPO_URL="https://github.com/rhinos0608/codecrucibe-synth"
INSTALL_DIR="$HOME/.codecrucible"
CONFIG_FILE="$INSTALL_DIR/config.yaml"
DEFAULT_MODEL="qwen2.5:7b"
BACKUP_MODELS=("gemma2:9b" "llama3.2:8b" "codellama:7b")

# Logging functions
log_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${BLUE}🚀 $1${NC}"; }

# Helper functions
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

get_os() {
    case "$(uname -s)" in
        Darwin*) echo "macos" ;;
        Linux*) echo "linux" ;;
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *) echo "unknown" ;;
    esac
}

get_arch() {
    case "$(uname -m)" in
        x86_64|amd64) echo "x64" ;;
        arm64|aarch64) echo "arm64" ;;
        *) echo "unknown" ;;
    esac
}

check_system_requirements() {
    log_step "Checking system requirements..."
    
    # Check Node.js
    if ! command_exists node; then
        log_error "Node.js is required but not installed."
        log_info "Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    # Check Node.js version
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 18+ is required. Current version: $(node --version)"
        exit 1
    fi
    
    # Check npm
    if ! command_exists npm; then
        log_error "npm is required but not installed."
        exit 1
    fi
    
    log_success "System requirements met: Node.js $(node --version), npm $(npm --version)"
}

install_ollama() {
    log_step "Checking for Ollama..."
    
    if command_exists ollama; then
        log_success "Ollama already installed: $(ollama --version)"
        return 0
    fi
    
    log_info "Ollama not found. Installing..."
    
    OS=$(get_os)
    case $OS in
        "linux"|"macos")
            log_info "Installing Ollama for $OS..."
            curl -fsSL https://ollama.com/install.sh | sh
            ;;
        "windows")
            log_warning "Please install Ollama manually from https://ollama.com/download/windows"
            log_info "After installation, restart this script."
            exit 1
            ;;
        *)
            log_error "Unsupported operating system: $OS"
            log_info "Please install Ollama manually from https://ollama.com/"
            exit 1
            ;;
    esac
    
    # Verify installation
    if command_exists ollama; then
        log_success "Ollama installed successfully!"
    else
        log_error "Ollama installation failed."
        exit 1
    fi
}

start_ollama_service() {
    log_step "Starting Ollama service..."
    
    # Check if Ollama is already running
    if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
        log_success "Ollama service is already running"
        return 0
    fi
    
    log_info "Starting Ollama in background..."
    nohup ollama serve >/dev/null 2>&1 &
    
    # Wait for service to start
    for i in {1..30}; do
        if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
            log_success "Ollama service started successfully"
            return 0
        fi
        sleep 1
    done
    
    log_error "Failed to start Ollama service"
    exit 1
}

pull_models() {
    log_step "Pulling AI models with progressive timeout handling..."
    
    # Progressive model tiers with different timeouts
    local model_tiers=(
        "qwen2.5:7b,gemma2:9b:600:high-capability"
        "llama3.2:8b,codellama:7b:450:medium-capability" 
        "gemma:2b,phi3:mini,qwen2.5:3b:180:fast-lightweight"
        "phi:latest,tinyllama:latest:120:emergency-fallback"
    )
    
    # Check if any models already exist
    local existing_models=$(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}' | grep -v "^$" || true)
    if [ -n "$existing_models" ]; then
        log_success "Found existing models: $existing_models"
        DEFAULT_MODEL=$(echo "$existing_models" | head -n1)
        return 0
    fi
    
    for tier in "${model_tiers[@]}"; do
        local models=$(echo "$tier" | cut -d: -f1,2 | tr ',' ' ')
        local timeout=$(echo "$tier" | cut -d: -f3)
        local description=$(echo "$tier" | cut -d: -f4)
        
        log_info "Attempting $description models (${timeout}s timeout)..."
        
        for model in $models; do
            log_info "Pulling $model..."
            
            if timeout "${timeout}s" ollama pull "$model" 2>/dev/null; then
                log_success "Successfully pulled $model"
                DEFAULT_MODEL="$model"
                return 0
            else
                log_warning "Failed to pull $model (timeout or error)"
                
                # If network issue detected, try smaller models immediately
                if [ "$description" = "high-capability" ]; then
                    log_info "Network timeout detected, switching to faster models..."
                    break
                fi
            fi
        done
    done
    
    log_error "Failed to pull any models. Please check your internet connection."
    log_info "You can manually install models later with: ollama pull <model-name>"
    
    # Continue without models for basic functionality
    log_warning "Continuing installation without models..."
    DEFAULT_MODEL="none"
}

install_codecrucible() {
    log_step "Installing CodeCrucible Synth..."
    
    # Create installation directory
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Clone or update repository
    if [ -d "codecrucibe-synth" ]; then
        log_info "Updating existing installation..."
        cd codecrucibe-synth
        git pull
    else
        log_info "Cloning repository..."
        git clone "$REPO_URL" codecrucibe-synth
        cd codecrucibe-synth
    fi
    
    # Install dependencies
    log_info "Installing dependencies..."
    npm install
    
    # Build the project
    log_info "Building project..."
    npm run build
    
    log_success "CodeCrucible Synth installed successfully!"
}

create_configuration() {
    log_step "Creating configuration..."
    
    cat > "$CONFIG_FILE" << EOF
# CodeCrucible Synth Configuration
model:
  endpoint: "http://localhost:11434"
  name: "$DEFAULT_MODEL"
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
EOF
    
    log_success "Configuration created at $CONFIG_FILE"
}

setup_aliases() {
    log_step "Setting up command aliases..."
    
    SHELL_RC=""
    if [ -n "$BASH_VERSION" ]; then
        SHELL_RC="$HOME/.bashrc"
    elif [ -n "$ZSH_VERSION" ]; then
        SHELL_RC="$HOME/.zshrc"
    elif [ -f "$HOME/.profile" ]; then
        SHELL_RC="$HOME/.profile"
    fi
    
    if [ -n "$SHELL_RC" ]; then
        ALIAS_LINE="alias crucible='node $INSTALL_DIR/codecrucibe-synth/dist/index.js'"
        
        # Check if alias already exists
        if ! grep -q "alias crucible=" "$SHELL_RC" 2>/dev/null; then
            echo "" >> "$SHELL_RC"
            echo "# CodeCrucible Synth" >> "$SHELL_RC"
            echo "$ALIAS_LINE" >> "$SHELL_RC"
            log_success "Alias added to $SHELL_RC"
        else
            log_info "Alias already exists in $SHELL_RC"
        fi
        
        # Also create a direct executable link
        mkdir -p "$HOME/.local/bin"
        cat > "$HOME/.local/bin/crucible" << EOF
#!/bin/bash
node "$INSTALL_DIR/codecrucibe-synth/dist/index.js" "\$@"
EOF
        chmod +x "$HOME/.local/bin/crucible"
        
        log_info "Executable created at $HOME/.local/bin/crucible"
        log_info "Make sure $HOME/.local/bin is in your PATH"
    else
        log_warning "Could not determine shell configuration file"
        log_info "Please manually add: alias crucible='node $INSTALL_DIR/codecrucibe-synth/dist/index.js'"
    fi
}

test_installation() {
    log_step "Testing installation..."
    
    # Test Ollama connectivity
    if ! curl -s http://localhost:11434/api/tags >/dev/null; then
        log_error "Cannot connect to Ollama service"
        return 1
    fi
    
    # Test if models are available
    if ! ollama list | grep -q "$DEFAULT_MODEL"; then
        log_error "Model $DEFAULT_MODEL not found"
        return 1
    fi
    
    # Test CodeCrucible
    cd "$INSTALL_DIR/codecrucibe-synth"
    if ! timeout 10 node dist/index.js --help >/dev/null 2>&1; then
        log_error "CodeCrucible failed to start"
        return 1
    fi
    
    log_success "Installation test passed!"
}

print_success_message() {
    echo
    echo -e "${GREEN}🎉 CodeCrucible Synth installed successfully!${NC}"
    echo
    echo -e "${CYAN}📋 Quick Start:${NC}"
    echo -e "  ${YELLOW}crucible${NC}                    # Start interactive mode"
    echo -e "  ${YELLOW}crucible --help${NC}             # Show all commands"
    echo -e "  ${YELLOW}crucible agent${NC}              # Start agentic mode"
    echo -e "  ${YELLOW}crucible desktop${NC}            # Launch GUI app"
    echo
    echo -e "${CYAN}📁 Configuration:${NC} $CONFIG_FILE"
    echo -e "${CYAN}📦 Installation:${NC} $INSTALL_DIR/codecrucibe-synth"
    echo
    echo -e "${BLUE}💡 If 'crucible' command not found, restart your terminal or run:${NC}"
    echo -e "  ${YELLOW}source ~/.bashrc${NC}  # or ~/.zshrc"
    echo
}

# Main installation flow
main() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║               CodeCrucible Synth Installer                  ║"
    echo "║          Autonomous AI Coding Assistant for Local Models    ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    check_system_requirements
    install_ollama
    start_ollama_service
    pull_models
    install_codecrucible
    create_configuration
    setup_aliases
    test_installation
    print_success_message
}

# Handle interrupts gracefully
trap 'echo -e "\n${RED}Installation interrupted.${NC}"; exit 1' INT TERM

# Check if running with bash
if [ -z "$BASH_VERSION" ]; then
    log_warning "This script is designed for bash. Some features may not work correctly."
fi

# Run main function
main "$@"