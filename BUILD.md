# Build Instructions

## Native Module Setup

**IMPORTANT**: Native binaries (*.node, target/) are NO longer committed to git to avoid cross-platform compatibility issues.

### Prerequisites

1. **Node.js 18+**
2. **Rust toolchain**: Install via [rustup.rs](https://rustup.rs/)
3. **Platform-specific build tools**:
   - **Windows**: Visual Studio Build Tools or Visual Studio Community  
   - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
   - **Linux**: `build-essential` package

### Build Process

```bash
# 1. Install dependencies
npm install

# 2. Build Rust native module (required for first build)
npm run build:rust

# 3. Build TypeScript and copy assets
npm run build

# 4. Run tests to verify build
npm test

# 5. Create global CLI link
npm run install-global
```

### Development Mode

```bash
# For development with auto-rebuild
npm run dev
```

### Platform-Specific Notes

**Windows:**
```bash
# If build fails, try specifying target
cd rust-executor && napi build --platform --release --target x86_64-pc-windows-msvc
```

**macOS (Apple Silicon):**
```bash
# For M1/M2 Macs
cd rust-executor && napi build --platform --release --target aarch64-apple-darwin
```

**Linux:**
```bash
# Standard build
cd rust-executor && napi build --platform --release --target x86_64-unknown-linux-gnu
```

### Build Troubleshooting

1. **"Rust compiler not found"**: Install Rust via `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. **"MSVC not found"** (Windows): Install Visual Studio Build Tools  
3. **"xcrun not found"** (macOS): Run `xcode-select --install`
4. **Permission denied**: Run with elevated permissions if needed

### CI/CD Integration

The project includes automated build processes in `.github/workflows/`. The CI:
1. Builds for multiple platforms (Windows, macOS, Linux)  
2. Tests on each platform
3. Publishes platform-specific artifacts

### Production Deployment

For production, use prebuilt binaries from GitHub Releases or build from source using the above process.

**Never commit native binaries to git** - they are platform-specific and cause deployment issues.