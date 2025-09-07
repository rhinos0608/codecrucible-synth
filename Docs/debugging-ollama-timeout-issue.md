# Debugging Report: Ollama Timeout Issue - 2025 Analysis

## Problem Description
The CodeCrucible Synth system was hanging indefinitely when executing any AI-related commands, including:
- `node dist/index.js "analyze this codebase"`
- `node dist/index.js models`

Commands would timeout after 2+ minutes without producing any meaningful output.

## 2025 Research Findings (MCP Context7 & Exa Sources)

### Current Industry Standards (2025)
**Source**: Multiple 2025 research articles via Exa AI

> **"In 2025, handling async operations without cancellation is a red flag."** - JavaScript's AbortController in 2025: Cancel Anything, Everywhere (Medium, Jun 2025)

**Key 2025 Patterns**:
1. **AbortSignal.timeout()** - New simplified pattern: `AbortSignal.timeout(5000)`
2. **AbortSignal.any()** - Combine multiple abort conditions
3. **Universal cancellation** - All async operations should support cancellation
4. **Graceful degradation** - Proper fallback when timeouts occur

### Ollama-Specific Issues Documented in 2025
**Source**: GitHub Issues Analysis via Exa AI

1. **Issue #4491** (GitHub): Ollama API session timeout (5 minutes) for large model pulls
2. **Issue #5733** (RooCodeInc): Timeout configuration too aggressive for embedding operations
3. **Common pattern**: Retry logic with exponential backoff for unstable connections

### Official Ollama-JS Library Analysis
**Source**: Context7 Documentation (/ollama/ollama-js)

**Key Findings**:
- Library provides `abort()` method that "throws AbortError exception for all asynchronous threads"
- Uses `keep_alive` parameter to control model loading duration
- **No built-in timeout handling** - relies on underlying fetch implementation
- Supports streaming with AsyncGenerator pattern for long-running operations

## Root Cause Analysis

### Investigation Steps
1. **Analyzed error logs**: Found hanging occurring during AI model interactions
2. **Traced execution path**: Error occurred in `ModelClient.generate()` at line 150  
3. **Examined provider code**: Identified issue in Ollama provider's `getAvailableModels()` method
4. **Researched 2025 best practices**: Confirmed pattern violates current standards

### Root Cause Found
**File**: `src/providers/hybrid/ollama-provider.ts`  
**Line**: 856  
**Issue**: Missing timeout in `getAvailableModels()` method - **Anti-pattern in 2025**

```typescript
// PROBLEMATIC CODE (line 856) - 2025 ANTI-PATTERN:
const response = await fetch(`${this.endpoint}/api/tags`);
```

**Why this is critical in 2025**:
- Violates "no async without cancellation" principle
- No graceful degradation pathway
- Causes resource leaks and poor UX
- Missing configurable timeout patterns

### 2025-Compliant Patterns Comparison

**Current Working Code** (isAvailable method):
```typescript
// ACCEPTABLE 2025 PATTERN:
const controller = new AbortController();
const timeoutId = setTimeout(() => { controller.abort(); }, timeout);
const response = await fetch(endpoint, { signal: controller.signal });
clearTimeout(timeoutId);
```

**2025 PREFERRED PATTERN** (newer AbortSignal.timeout):
```typescript
// OPTIMAL 2025 PATTERN:
const response = await fetch(endpoint, { 
  signal: AbortSignal.timeout(10000) 
});
```

## Extended Investigation: Tool Pipeline Analysis

### Additional Research via MCP Tools (Context7 & Exa)

**Critical Discovery**: The timeout issue extends beyond Ollama to the entire **MCP tool execution pipeline**.

**Source**: Axios vs. Fetch (2025 update) - LogRocket, Apr 2025

> **2025 Industry Shift**: "Many overestimate the need for [axios]. The Fetch API is perfectly capable... and has the added advantage of being readily available"

**Pipeline Issues Found**:

1. **MCP Tools (`src/infrastructure/tools/mcp-tools.ts`)**:
   - **Line 52-60**: Using axios with basic timeout (old 2024 pattern)
   - **Lines 180, 278-299, 458-492**: External API calls without AbortSignal
   - **Multiple Promise.allSettled**: Could hang indefinitely on API failures

2. **Rust Bridge Manager** (`src/infrastructure/execution/rust-executor/rust-bridge-manager.ts`):
   - **Lines 62-67**: Using Promise.race timeout pattern (not 2025 compliant)
   - **Line 178**: Module import without timeout handling
   - **Line 125**: Minimal health check (only basic arithmetic test)

**2025 Compliance Issues**:
- ❌ **Axios usage**: Should be replaced with fetch + AbortSignal.timeout()
- ❌ **Promise.race patterns**: Should use AbortSignal.any() for multiple conditions  
- ❌ **External API calls**: Missing universal cancellation support
- ❌ **No graceful degradation**: Tools crash instead of providing fallbacks

### Root Cause Summary
**Primary**: Ollama provider timeout (FIXED)
**Secondary**: MCP tool pipeline using 2024 patterns throughout
**Tertiary**: Rust bridge using outdated timeout mechanisms

## Solution Implemented

### Phase 1: Ollama Provider Fix (COMPLETED)
Added proper timeout handling to `getAvailableModels()` method:

```typescript
public async getAvailableModels(): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => { controller.abort(); }, this.parseEnvInt('OLLAMA_MODELS_TIMEOUT', 10000, 1000, 30000));

    const response = await fetch(`${this.endpoint}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    // ... rest of method unchanged
  } catch (error) {
    // ... error handling unchanged
  }
}
```

### Changes Made
1. **Added AbortController**: Enables request cancellation
2. **Added timeout mechanism**: 10-second default timeout (configurable via `OLLAMA_MODELS_TIMEOUT` env var)
3. **Added abort signal**: Passes controller signal to fetch request
4. **Added cleanup**: Properly clears timeout on success

## Technical Details

### Environment Variables
- `OLLAMA_MODELS_TIMEOUT`: Timeout for model discovery (default: 10000ms)
- Range: 1000ms to 30000ms (1-30 seconds)

### Error Handling
- Request timeout triggers abort signal
- Catch block logs error and returns empty array (graceful degradation)
- No breaking changes to existing API

### Performance Impact
- **Before**: Infinite hanging, unusable system
- **After**: Fast failure with graceful degradation (10-second max delay)

## Prevention Measures

### Code Review Checklist
- ✅ All fetch requests must have timeout handling
- ✅ Use AbortController for cancellable requests
- ✅ Implement graceful degradation for network failures
- ✅ Add configurable timeouts via environment variables

### Similar Issues to Watch
Search for other fetch requests without timeouts:
```bash
grep -r "await fetch(" --include="*.ts" src/ | grep -v "signal:"
```

## Testing Results
After implementing the fix:
- Commands execute successfully without hanging
- Proper error handling when Ollama is unavailable
- System remains responsive even with network issues

## Date
2025-09-07

## Severity
**Critical** - System completely unusable before fix

## Status  
**Resolved** - Fixed in commit following this investigation