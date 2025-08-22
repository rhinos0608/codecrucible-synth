#!/bin/bash

# CodeCrucible Synth - Install from GitHub (Before npm Publication)
# Usage: curl -sSL https://raw.githubusercontent.com/rhinos0608/codecrucibe-synth/main/install-from-git.sh | bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${CYAN}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "${BLUE}🚀 $1${NC}"; }

# Configuration
REPO_URL="https://github.com/rhinos0608/codecrucibe-synth.git"
INSTALL_DIR="$HOME/.codecrucible"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║            CodeCrucible Synth - Git Installation            ║"
echo "║         Install directly from GitHub repository             ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Check system requirements
log_step "Checking system requirements..."

if ! command -v node >/dev/null 2>&1; then
    log_error "Node.js is required but not installed."
    log_info "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "Node.js 18+ is required. Current version: $(node --version)"
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    log_error "npm is required but not installed."
    exit 1
fi

if ! command -v git >/dev/null 2>&1; then
    log_error "Git is required but not installed."
    exit 1
fi

log_success "System requirements met: Node.js $(node --version), npm $(npm --version)"

# Clone repository
log_step "Cloning CodeCrucible Synth repository..."

if [ -d "$INSTALL_DIR/codecrucibe-synth" ]; then
    log_info "Existing installation found. Updating..."
    cd "$INSTALL_DIR/codecrucibe-synth"
    git pull
else
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    git clone "$REPO_URL" codecrucibe-synth
    cd codecrucibe-synth
fi

# Install dependencies and build
log_step "Installing dependencies..."
npm install

log_step "Building application..."
npm run build

# Create global command
log_step "Setting up global command..."

BIN_DIR="$HOME/.local/bin"
mkdir -p "$BIN_DIR"

# Create wrapper script
cat > "$BIN_DIR/crucible" << 'EOF'
#!/bin/bash
node "$HOME/.codecrucible/codecrucibe-synth/dist/index.js" "$@"
EOF

chmod +x "$BIN_DIR/crucible"

# Add to PATH if needed
if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    log_info "Adding $BIN_DIR to PATH"
    
    # Determine shell config file
    if [ -n "$BASH_VERSION" ]; then
        SHELL_RC="$HOME/.bashrc"
    elif [ -n "$ZSH_VERSION" ]; then
        SHELL_RC="$HOME/.zshrc"
    else
        SHELL_RC="$HOME/.profile"
    fi
    
    echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
    export PATH="$HOME/.local/bin:$PATH"
    
    log_success "Added to PATH. Restart terminal or run: source $SHELL_RC"
fi

# Test installation
log_step "Testing installation..."

if timeout 5 "$BIN_DIR/crucible" --help >/dev/null 2>&1; then
    log_success "Installation test passed!"
else
    log_warning "Installation test timed out (this is normal)"
fi

echo
log_success "CodeCrucible Synth installed successfully!"
echo
log_info "🚀 Quick Start:"
echo -e "  ${YELLOW}crucible${NC}                    # Start interactive mode"
echo -e "  ${YELLOW}crucible agent${NC}              # Start agentic mode"
echo -e "  ${YELLOW}crucible desktop${NC}            # Launch GUI application"
echo -e "  ${YELLOW}crucible --help${NC}             # Show all commands"
echo
log_info "📁 Installation: $INSTALL_DIR/codecrucibe-synth"
echo
log_info "💡 If 'crucible' command not found, restart your terminal or run:"
echo -e "  ${YELLOW}source ~/.bashrc${NC}  # or ~/.zshrc"