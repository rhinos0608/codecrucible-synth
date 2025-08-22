# System Prompt Routing Fix Implementation Guide
## Critical Issue Resolution for CodeCrucible Synth v4.0.3

### 🚨 CRITICAL ROOT CAUSE IDENTIFIED

The CodeCrucible Synth system is **not applying system prompts** to AI model requests, causing complete failure of autonomous capabilities, tool usage, and context awareness.

---

## 📋 Problem Analysis

### **User-Reported Issues:**
1. ✅ **System not responding to user prompts autonomously**
2. ✅ **Tool orchestration failures ("batch execution failed: 2 failures")**  
3. ✅ **Context awareness loss** - gives generic responses instead of project-specific answers
4. ✅ **Hardcoded analyses** - system analyzing wrong projects instead of current one
5. ✅ **Memory emergency infinite loops** - secondary issue affecting performance

### **Root Cause Discovery:**
**The CLI is calling `modelClient.generateText()` with only user prompts - NO SYSTEM PROMPT INJECTION**

**Evidence:**
- **File:** `src/core/cli.ts:533`
- **Code:** `const response = await this.context.modelClient.generateText(prompt, { timeout: 30000 });`
- **Issue:** Only passes user prompt, no system prompt with tool instructions
- **Result:** AI model receives no context about being CodeCrucible Synth or instructions to use tools

---

## 🔍 Technical Details

### **What Should Happen:**
1. User asks: "what is this app for?"
2. CLI builds system prompt using `EnterpriseSystemPromptBuilder`
3. System prompt tells AI: "You are CodeCrucible Synth, use your tools to analyze files"
4. AI receives: `[SYSTEM_PROMPT] + user_prompt`
5. AI uses tools to read files, provides project-specific answer

### **What Actually Happens:**
1. User asks: "what is this app for?"
2. CLI calls `generateText("what is this app for?")` - **NO SYSTEM PROMPT**
3. AI receives only: `"what is this app for?"`
4. AI responds: "I don't have enough information" - **CORRECT RESPONSE FOR RAW PROMPT**

### **System Prompt Builder (UNUSED):**
- **File:** `src/core/enterprise-system-prompt-builder.ts`
- **Status:** ✅ **Fully implemented and comprehensive**
- **Contains:** Tool usage instructions, autonomous behavior guidelines, context awareness
- **Issue:** **NEVER CALLED BY CLI**

---

## 🛠️ Implementation Plan

### **Phase 1: Critical Fix (30 minutes)**

#### **1.1 Modify CLI to Use System Prompts**
**File:** `src/core/cli.ts`

**Current Code (Line 533):**
```typescript
const response = await this.context.modelClient.generateText(prompt, { timeout: 30000 });
```

**Fixed Code:**
```typescript
// Import EnterpriseSystemPromptBuilder
import { EnterpriseSystemPromptBuilder } from './enterprise-system-prompt-builder.js';

// Build system prompt with context
const runtimeContext = {
  workingDirectory: this.workingDirectory,
  isGitRepo: true, // detect from git status
  platform: process.platform,
  currentBranch: 'main', // get from git
  modelId: 'CodeCrucible Synth v4.0.3',
  knowledgeCutoff: 'January 2025'
};

const systemPrompt = EnterpriseSystemPromptBuilder.buildSystemPrompt(
  runtimeContext,
  { 
    conciseness: 'ultra',
    securityLevel: 'enterprise'
  }
);

// Combine system prompt + user prompt
const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;
const response = await this.context.modelClient.generateText(fullPrompt, { timeout: 30000 });
```

#### **1.2 Test Basic Functionality**
```bash
# Test 1: Context awareness
cc "what is this app for?"
# Expected: Should know it's CodeCrucible Synth and use tools to analyze

# Test 2: Tool usage  
cc "analyze the Docs folder of this project"
# Expected: Should use file reading tools autonomously

# Test 3: Project awareness
cc "what files are in src/core?"
# Expected: Should use directory listing tools
```

### **Phase 2: Enhanced Integration (1 hour)**

#### **2.1 Dynamic Context Detection**
**Add git detection and dynamic context:**
```typescript
private async buildRuntimeContext(): Promise<RuntimeContext> {
  const { execSync } = await import('child_process');
  
  try {
    const currentBranch = execSync('git branch --show-current', { cwd: this.workingDirectory })
      .toString().trim();
    const isGitRepo = true;
  } catch {
    const isGitRepo = false;
    const currentBranch = 'unknown';
  }
  
  return {
    workingDirectory: this.workingDirectory,
    isGitRepo,
    platform: process.platform,
    currentBranch,
    modelId: 'CodeCrucible Synth v4.0.3',
    knowledgeCutoff: 'January 2025'
  };
}
```

#### **2.2 Tool Orchestration Integration**
**Ensure tool orchestration receives system prompts:**
```typescript
// In executePromptProcessing method
if (this.toolOrchestrator.shouldUseTools(prompt)) {
  const systemPrompt = await this.buildSystemPrompt();
  const toolResponse = await this.toolOrchestrator.processWithTools(prompt, systemPrompt);
  return toolResponse;
}
```

### **Phase 3: Verification & Testing (30 minutes)**

#### **3.1 Comprehensive Testing**
```bash
# Test suite for system prompt integration
npm test -- --testNamePattern="system-prompt"

# Manual verification tests
cc status                    # Should work normally
cc "what is this app?"      # Should know it's CodeCrucible Synth
cc "list files in src/"     # Should use tools autonomously
cc analyze-dir              # Should perform accurate analysis
```

#### **3.2 Performance Validation**
- Response time: Should be <30s (currently failing due to missing context)
- Tool usage: Should automatically use tools for file operations
- Context awareness: Should provide project-specific answers

---

## 📊 Expected Impact

### **Before Fix:**
- ❌ Generic responses: "I don't have enough information"
- ❌ No tool usage despite having comprehensive tool system
- ❌ No context awareness
- ❌ Tool orchestration failures
- ❌ Memory emergency loops (system confusion)

### **After Fix:**
- ✅ Project-specific responses with context
- ✅ Autonomous tool usage for file operations
- ✅ Accurate project analysis
- ✅ Working tool orchestration
- ✅ Stable performance without emergency loops

---

## 🔧 Implementation Code

### **Complete CLI Fix (src/core/cli.ts)**

**Add imports at top:**
```typescript
import { EnterpriseSystemPromptBuilder, RuntimeContext } from './enterprise-system-prompt-builder.js';
import { execSync } from 'child_process';
```

**Add method to CLI class:**
```typescript
private async buildRuntimeContext(): Promise<RuntimeContext> {
  let isGitRepo = false;
  let currentBranch = 'unknown';
  
  try {
    execSync('git status', { cwd: this.workingDirectory, stdio: 'ignore' });
    isGitRepo = true;
    currentBranch = execSync('git branch --show-current', { 
      cwd: this.workingDirectory 
    }).toString().trim();
  } catch {
    // Not a git repo or git not available
  }
  
  return {
    workingDirectory: this.workingDirectory,
    isGitRepo,
    platform: process.platform,
    currentBranch,
    modelId: 'CodeCrucible Synth v4.0.3',
    knowledgeCutoff: 'January 2025'
  };
}

private async buildSystemPrompt(): Promise<string> {
  const context = await this.buildRuntimeContext();
  return EnterpriseSystemPromptBuilder.buildSystemPrompt(context, {
    conciseness: 'ultra',
    securityLevel: 'enterprise'
  });
}
```

**Replace line 533 in executePromptProcessing:**
```typescript
// OLD:
const response = await this.context.modelClient.generateText(prompt, { timeout: 30000 });

// NEW:
const systemPrompt = await this.buildSystemPrompt();
const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;
const response = await this.context.modelClient.generateText(fullPrompt, { timeout: 30000 });
```

---

## ✅ Success Criteria

### **Phase 1 Complete When:**
1. ✅ CLI injects system prompts into all model calls
2. ✅ AI responds with project awareness: "This is CodeCrucible Synth..."
3. ✅ Basic tool usage working for file operations

### **Phase 2 Complete When:**
1. ✅ Dynamic git context detection working
2. ✅ Tool orchestration receiving system prompts
3. ✅ Comprehensive project analysis working

### **Phase 3 Complete When:**
1. ✅ All manual test cases passing
2. ✅ No more "I don't have enough information" responses
3. ✅ System autonomously using tools for appropriate requests
4. ✅ Memory emergency loops resolved

---

## 🚀 Additional Improvements

### **Future Enhancements:**
1. **Voice-Specific System Prompts** - Use different prompts for different AI voices
2. **Context Caching** - Cache system prompts to improve performance  
3. **Dynamic Tool Selection** - Inject available tools list into system prompt
4. **Project Intelligence Integration** - Include project analysis in system prompt

### **Monitoring:**
1. Add logging for system prompt injection
2. Track tool usage success rates
3. Monitor response quality improvements
4. Performance metrics for system prompt generation

---

## 📝 Related Issues

### **This Fix Resolves:**
1. ✅ **System prompt routing failures** (PRIMARY ISSUE)
2. ✅ **Tool orchestration failures** - tools will receive context
3. ✅ **Context awareness loss** - AI will know its identity and purpose
4. ✅ **Generic response problem** - AI will have project context

### **Still Need Separate Fixes:**
1. 🔄 **Memory emergency infinite loops** - performance monitoring issue
2. 🔄 **Model selection fallback failures** - model routing logic
3. 🔄 **Version display bug** - hardcoded versions in dist/

---

## 🎯 Priority Order

### **CRITICAL (Fix Immediately):**
1. **System prompt injection in CLI** - Restores all autonomous capabilities
2. **Tool orchestration system prompt** - Enables file operations

### **HIGH (Fix Within 24 Hours):**
1. **Dynamic context detection** - Improves accuracy
2. **Comprehensive testing** - Ensures stability

### **MEDIUM (Fix Within Week):**
1. **Memory emergency loop** - Performance optimization
2. **Model selection improvements** - Reliability enhancement

---

**Implementation Time:** ~2 hours total  
**Expected Result:** Full restoration of autonomous capabilities and context awareness  
**Risk Level:** Low - Well-defined changes to existing working components

---

*Created: August 22, 2025*  
*Issue Discovery: System prompt routing analysis*  
*Priority: CRITICAL - Blocks all autonomous functionality*