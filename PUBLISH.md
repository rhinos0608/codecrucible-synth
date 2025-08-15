# 📦 Publishing CodeCrucible Synth to npm

## Step 1: Login to npm

```bash
npm login
```
Enter your npm credentials when prompted.

## Step 2: Verify Package

```bash
npm run build
npm pack --dry-run
```

This shows what will be included in the package.

## Step 3: Publish

```bash
npm publish --access public
```

## Step 4: Verify Publication

```bash
npm view codecrucible-synth
```

## Step 5: Test Installation

### Global Installation
```bash
npm install -g codecrucible-synth
crucible --help
```

### npx Testing
```bash
npx codecrucible-synth --help
```

## 🚀 One-Liner Installation Commands (After Publishing)

### npm (Recommended)
```bash
npm install -g codecrucible-synth
crucible
```

### npx (No Installation)
```bash
npx codecrucible-synth
```

### curl + bash (Unix/macOS)
```bash
curl -sSL https://raw.githubusercontent.com/rhinos0608/codecrucibe-synth/main/install.sh | bash
```

### PowerShell (Windows)
```powershell
iwr -useb https://raw.githubusercontent.com/rhinos0608/codecrucibe-synth/main/install.ps1 | iex
```

## 🔧 Package Configuration

The package is configured with:
- Multiple bin commands: `crucible`, `cc`, `codecrucible`
- Auto-setup with progressive model pulling
- Cross-platform binary support
- Real-time file watching
- Autonomous error recovery

## 📋 Post-Publication Checklist

- [ ] Test `npm install -g codecrucible-synth`
- [ ] Test `npx codecrucible-synth`
- [ ] Verify all CLI commands work
- [ ] Test auto-setup functionality
- [ ] Create GitHub release
- [ ] Update documentation

## 🐛 Troubleshooting

If publishing fails:
1. Check if package name is available: `npm view codecrucible-synth`
2. Verify you're logged in: `npm whoami`
3. Check package.json for valid configuration
4. Ensure build is complete: `npm run build`