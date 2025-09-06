# Dependency Optimization Recommendations

## Summary
Current package.json has **100+ dependencies** which is excessive for a CLI tool. This analysis identifies opportunities to reduce bundle size, improve security, and simplify maintenance.

## Immediate Removals (Unused Dependencies)

### Markdown Parsers - **REMOVE ALL** ❌
```bash
npm uninstall marked markdown-it marked-terminal
```
- **Impact**: -3 dependencies, ~500KB bundle size reduction
- **Risk**: None - no imports found in src/

## Consolidations (Duplicate Functionality)

### HTTP Clients - **Standardize on node-fetch** ⚠️
```bash
npm uninstall axios
```
- **Current**: Both `axios` and `node-fetch` used in different files
- **Recommendation**: Standardize on `node-fetch` (native, modern)
- **Required**: Update 4 files to use consistent HTTP client
- **Impact**: -1 dependency, ~100KB bundle reduction

### Glob Libraries - **Standardize on fast-glob** ⚠️
```bash
npm uninstall glob  # Keep fast-glob
```
- **Current**: Both `glob` and `fast-glob` available
- **Impact**: -1 dependency, ~50KB reduction

### Prompt Libraries - **Choose One** ⚠️
```bash
# Keep inquirer OR enquirer, not both
npm uninstall enquirer  # OR npm uninstall inquirer
```
- **Analysis needed**: Determine which is actively used
- **Impact**: -1 dependency, ~200KB reduction

## Optional Optimizations (Heavy Dependencies)

### Desktop/Electron Packaging - **Consider Removal** 🤔
```bash
npm uninstall electron electron-builder @vercel/ncc
```
- **Question**: Is desktop app packaging needed?
- **Impact**: -3 dependencies, ~300MB reduction
- **Risk**: Removes desktop build capability

### Enterprise Monitoring - **Consider Removal** 🤔
```bash
npm uninstall @opentelemetry/api @opentelemetry/exporter-jaeger @opentelemetry/exporter-prometheus @opentelemetry/sdk-node
```
- **Question**: Is enterprise monitoring needed for CLI?
- **Impact**: -4 dependencies, ~5MB reduction
- **Risk**: Removes observability/monitoring

### Database Minimization - **Evaluate Usage** 🤔
Current: PostgreSQL + SQLite + Redis + LanceDB + Knex
- **Recommendation**: Keep only actively used database clients
- **Analysis needed**: Check actual usage patterns
- **Potential Impact**: -2-4 dependencies, ~10MB reduction

## Cloud Provider Optimization - **Module-based Loading** 🤔
Current: All AWS/Azure SDKs loaded upfront
- **Keep if needed**: AWS/Azure providers are used
- **Optimization**: Consider lazy loading cloud providers
- **Impact**: Reduces startup time, keeps functionality

## Recommended Action Plan

### Phase 1: Safe Removals (No Risk)
```bash
npm uninstall marked markdown-it marked-terminal
```

### Phase 2: Consolidations (Low Risk, requires updates)
```bash
npm uninstall axios  # Update HTTP client usage to node-fetch
npm uninstall glob   # Ensure fast-glob covers all use cases
```

### Phase 3: Heavy Dependency Evaluation (Medium Risk)
1. **Determine**: Is desktop packaging needed?
2. **Evaluate**: Is enterprise monitoring essential?
3. **Audit**: Which database clients are actively used?

### Phase 4: Implementation
1. Update imports in affected files
2. Test functionality
3. Update documentation

## Expected Results
- **Bundle Size**: 50-300MB reduction (depending on heavy deps)
- **Install Time**: 20-40% faster npm install
- **Security**: Fewer dependencies = smaller attack surface
- **Maintenance**: Fewer packages to update/maintain

## Risk Assessment
- ✅ **Low Risk**: Unused dependency removal
- ⚠️ **Medium Risk**: Consolidation (requires code updates)  
- 🔴 **High Risk**: Feature removal (desktop/monitoring)

## Next Steps
1. Review this analysis with team
2. Make decisions on heavy dependencies
3. Implement Phase 1 removals immediately
4. Plan Phase 2 consolidations
5. Execute with proper testing