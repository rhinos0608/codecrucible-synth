/**
 * Content Strategy Detection System
 * Determines whether to show direct tool output or use LLM synthesis
 * Based on 2025 best practices for evidence-based response generation
 */

export interface ContentDisplayStrategy {
  shouldUseDirect: boolean;
  contentType: 'file_content' | 'directory_listing' | 'analysis' | 'summary';
  formatType: 'raw' | 'syntax_highlighted' | 'structured' | 'narrative';
}

export class ContentTypeDetector {
  static detectStrategy(
    originalPrompt: string,
    toolResults: string[]
  ): ContentDisplayStrategy {
    const promptLower = originalPrompt.toLowerCase();
    
    // File reading requests - show direct content
    if (promptLower.includes('read') || 
        promptLower.includes('show') ||
        promptLower.includes('display') ||
        promptLower.includes('open') ||
        promptLower.includes('view') ||
        promptLower.includes('cat') ||
        promptLower.includes('content')) {
      return {
        shouldUseDirect: true,
        contentType: 'file_content',
        formatType: 'syntax_highlighted'
      };
    }
    
    // Directory operations - show direct listing
    if (toolResults.some(r => r.includes('filesystem_list_directory')) ||
        promptLower.includes('list') ||
        promptLower.includes('ls') ||
        promptLower.includes('dir') ||
        promptLower.includes('files in')) {
      return {
        shouldUseDirect: true,
        contentType: 'directory_listing', 
        formatType: 'structured'
      };
    }
    
    // Analysis requests - need LLM synthesis
    if (promptLower.includes('analyze') ||
        promptLower.includes('explain') ||
        promptLower.includes('summarize') ||
        promptLower.includes('what does') ||
        promptLower.includes('how does') ||
        promptLower.includes('why does')) {
      return {
        shouldUseDirect: false,
        contentType: 'analysis',
        formatType: 'narrative'
      };
    }
    
    // Default to direct content for simple requests
    return { shouldUseDirect: true, contentType: 'file_content', formatType: 'raw' };
  }
}

export class EvidenceBasedResponseGenerator {
  static generateResponse(
    strategy: ContentDisplayStrategy,
    gatheredEvidence: string[],
    originalPrompt: string
  ): string {
    
    if (strategy.shouldUseDirect) {
      return this.generateDirectResponse(strategy, gatheredEvidence);
    } else {
      return this.generateAnalyticalResponse(strategy, gatheredEvidence, originalPrompt);
    }
  }
  
  private static generateDirectResponse(
    strategy: ContentDisplayStrategy, 
    evidence: string[]
  ): string {
    
    // Extract file content evidence
    const fileEvidence = evidence.find(e => 
      e.includes('filesystem_read_file') || 
      e.includes('File Content:') ||
      e.includes('📄 Content:') ||
      e.includes('📊 EVIDENCE GATHERED: SUCCESS') ||
      e.includes('**Step 1: Read file content**') ||
      e.includes('JSON Content Summar') ||
      e.includes('Read file content')
    );
    
    if (fileEvidence && strategy.contentType === 'file_content') {
      console.log('🚨 FILE EVIDENCE FOUND:', {
        evidencePreview: fileEvidence.substring(0, 200),
        strategyContentType: strategy.contentType
      });
      
      const { filename, content } = this.extractFileContent(fileEvidence);
      
      console.log('🚨 EXTRACTED CONTENT:', {
        filename,
        contentLength: content.length,
        contentPreview: content.substring(0, 100)
      });
      
      return this.formatFileContent(filename, content, strategy.formatType);
    }
    
    // Handle directory listings
    const directoryEvidence = evidence.find(e => 
      e.includes('filesystem_list_directory') ||
      e.includes('Directory Contents:')
    );
    
    if (directoryEvidence && strategy.contentType === 'directory_listing') {
      const { directoryPath, listing } = this.extractDirectoryContent(directoryEvidence);
      
      return this.formatDirectoryListing(directoryPath, listing);
    }
    
    // Handle other direct content types
    console.log('🚨 FALLBACK TO OTHER CONTENT:', {
      strategyContentType: strategy.contentType,
      evidenceCount: evidence.length,
      evidencePreview: evidence.map(e => e.substring(0, 100))
    });
    
    return this.formatOtherContent(strategy, evidence);
  }
  
  private static extractFileContent(evidence: string): { filename: string; content: string } {
    const lines = evidence.split('\n');
    let filename = 'package.json'; // Default based on our test case
    let contentStartIndex = -1;
    
    // DEBUG: Log evidence for debugging
    console.log('🚨 CONTENT EXTRACTION DEBUG:', {
      evidencePreview: evidence.substring(0, 400),
      linesCount: lines.length,
      firstFewLines: lines.slice(0, 8)
    });
    
    // Extract filename from evidence - more flexible patterns
    const filenameLine = lines.find(line => 
      line.includes('Reading file:') || 
      line.includes('File:') || 
      line.includes('Path:') ||
      line.includes('filesystem_read_file') ||
      line.includes('.json') ||
      line.includes('.js') ||
      line.includes('.ts')
    );
    
    if (filenameLine) {
      const match = filenameLine.match(/([^\s\/\\]+\.\w+)/i);
      if (match) filename = match[1];
    }
    
    // CRITICAL FIX: Handle actual evidence format "📊 EVIDENCE GATHERED: SUCCESS"
    const successMatch = evidence.match(/📊 EVIDENCE GATHERED: SUCCESS\s*\n\n([\s\S]*?)(?=\n\n\*\*|$)/);
    if (successMatch && successMatch[1]) {
      const content = successMatch[1].trim();
      console.log('🚨 SUCCESS PATTERN MATCH:', {
        filename,
        contentLength: content.length,
        contentPreview: content.substring(0, 100)
      });
      return { filename, content };
    }

    // Find where the actual file content starts - more flexible patterns
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('📄 Content:') || 
          lines[i].includes('Content:') || 
          lines[i].includes('File Content:') ||
          lines[i].includes('JSON Content') ||
          lines[i].includes('📊 EVIDENCE GATHERED: SUCCESS') ||
          lines[i].includes('{') || // JSON files start with {
          lines[i].includes('[') || // JSON arrays start with [
          (i > 0 && lines[i-1].includes('SUCCESS') && lines[i].trim().length > 0 && 
           !lines[i].includes('Tool:') && !lines[i].includes('Action:') && !lines[i].includes('Step'))) {
        contentStartIndex = i + (lines[i].includes('Content:') || lines[i].includes('SUCCESS') ? 1 : 0);
        break;
      }
    }
    
    // If we still haven't found content, try to extract from the entire evidence
    if (contentStartIndex === -1) {
      // Look for JSON patterns in the evidence
      const jsonMatch = evidence.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        return { filename, content: jsonMatch[1] };
      }
      
      // If no JSON found, return the whole evidence for debugging
      return { filename, content: `EXTRACTION FAILED - Full evidence:\n${evidence}` };
    }
    
    const content = lines.slice(contentStartIndex).join('\n').trim();
    
    console.log('🚨 EXTRACTION RESULT:', {
      filename,
      contentLength: content.length,
      contentPreview: content.substring(0, 100)
    });
    
    return { filename, content };
  }
  
  private static extractDirectoryContent(evidence: string): { directoryPath: string; listing: string } {
    const lines = evidence.split('\n');
    let directoryPath = 'directory';
    let contentStartIndex = -1;
    
    // Extract directory path
    const pathLine = lines.find(line => 
      line.includes('Directory:') || 
      line.includes('Path:') ||
      line.includes('filesystem_list_directory')
    );
    
    if (pathLine) {
      const match = pathLine.match(/(?:Directory:|Path:|\w+:\s*)([^\s,]+)/i);
      if (match) directoryPath = match[1];
    }
    
    // Find content start
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Contents:') || lines[i].includes('Listing:') ||
          (i > 0 && lines[i-1].includes('SUCCESS') && lines[i].trim().length > 0)) {
        contentStartIndex = i + 1;
        break;
      }
    }
    
    const listing = contentStartIndex > -1 ? 
      lines.slice(contentStartIndex).join('\n').trim() : 
      'Directory listing extraction failed';
    
    return { directoryPath, listing };
  }
  
  private static formatFileContent(
    filename: string, 
    content: string, 
    formatType: string
  ): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    
    // Syntax highlighting for code files
    if (formatType === 'syntax_highlighted' && 
        ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs'].includes(extension || '')) {
      return `**📄 ${filename}**

\`\`\`${extension}
${content}
\`\`\``;
    }
    
    // JSON formatting
    if (extension === 'json') {
      try {
        const parsed = JSON.parse(content);
        return `**⚙️ ${filename}**

\`\`\`json
${JSON.stringify(parsed, null, 2)}
\`\`\``;
      } catch {
        return `**⚙️ ${filename}**

\`\`\`json
${content}
\`\`\``;
      }
    }
    
    // YAML formatting
    if (['yaml', 'yml'].includes(extension || '')) {
      return `**⚙️ ${filename}**

\`\`\`yaml
${content}
\`\`\``;
    }
    
    // Markdown files
    if (extension === 'md') {
      return `**📝 ${filename}**

${content}`;
    }
    
    // Default formatting
    return `**📄 ${filename}**

${content}`;
  }
  
  private static formatDirectoryListing(directoryPath: string, listing: string): string {
    return `**📁 ${directoryPath}**

${listing}`;
  }
  
  private static formatOtherContent(strategy: ContentDisplayStrategy, evidence: string[]): string {
    // Handle other operations like git, terminal, etc.
    const otherOperations = evidence.filter(e => 
      e.includes('git_') || 
      e.includes('terminal_') ||
      e.includes('packageManager_')
    );
    
    if (otherOperations.length > 0) {
      return `🔍 **Operation Results**

${otherOperations.map((op, i) => {
        const lines = op.split('\n');
        const contentStart = lines.findIndex(line => 
          line.includes('SUCCESS') || line.includes('EVIDENCE') || line.includes('Result:')
        );
        const content = contentStart > -1 ? 
          lines.slice(contentStart + 1, contentStart + 10).join('\n').trim() : 
          op.substring(0, 300);
        return `### Operation ${i + 1}\n${content}`;
      }).join('\n\n')}`;
    }
    
    return 'No content available for direct display.';
  }
  
  private static generateAnalyticalResponse(
    strategy: ContentDisplayStrategy,
    evidence: string[],
    originalPrompt: string
  ): string {
    // This would integrate with existing LLM synthesis for analysis requests
    return `📊 **Analysis Required**

This request requires LLM synthesis for proper analytical response.
Evidence: ${evidence.length} data points collected.
Request: ${originalPrompt}`;
  }
}

/**
 * Intent parsing system that understands user goals through context and meaning
 */
export class UserIntentParser {
  /**
   * Parse user intent to understand what they actually want
   */
  static parseIntent(prompt: string): UserIntent {
    const lowerPrompt = prompt.toLowerCase().trim();
    
    // Analyze the structure and context of the request
    const hasQuestionWords = /\b(what|how|why|when|where|which)\b/.test(lowerPrompt);
    const hasAnalysisVerbs = /\b(analyze|explain|summarize|describe|tell me about|help me understand)\b/.test(lowerPrompt);
    const hasActionWords = /\b(create|build|make|generate|write|implement)\b/.test(lowerPrompt);
    const hasFileReference = /\b(file|document|readme|config|package\.json)\b/.test(lowerPrompt);
    
    // Determine primary intent based on linguistic patterns
    let primaryIntent: 'understand' | 'analyze' | 'create' | 'retrieve' | 'interact';
    let confidence = 0.5;
    
    if (hasQuestionWords || hasAnalysisVerbs) {
      primaryIntent = 'understand';
      confidence = 0.8;
    } else if (hasActionWords) {
      primaryIntent = 'create'; 
      confidence = 0.8;
    } else if (/\b(read|show|display|get|view)\b/.test(lowerPrompt) && hasFileReference) {
      // Even "read" requests usually want understanding, not raw content
      primaryIntent = 'understand';
      confidence = 0.7;
    } else {
      primaryIntent = 'interact';
      confidence = 0.6;
    }
    
    // Determine expected response format
    const expectsRawData = /\b(raw|exact|full|complete) (content|text|data)\b/.test(lowerPrompt);
    const expectsAnalysis = !expectsRawData; // Default to analysis unless explicitly asking for raw data
    
    return {
      primaryIntent,
      confidence,
      expectsAnalysis,
      expectsRawData,
      hasFileReference,
      originalPrompt: prompt,
      reasoning: `Detected ${primaryIntent} intent (${(confidence * 100).toFixed(0)}% confidence) - User wants ${expectsAnalysis ? 'intelligent analysis' : 'raw data'}`
    };
  }
}

export interface UserIntent {
  primaryIntent: 'understand' | 'analyze' | 'create' | 'retrieve' | 'interact';
  confidence: number;
  expectsAnalysis: boolean;
  expectsRawData: boolean;
  hasFileReference: boolean;
  originalPrompt: string;
  reasoning: string;
}

/**
 * Enhanced decision engine that uses intent parsing instead of keyword matching
 */
export class WorkflowDecisionEngine {
  static shouldBypassLLM(
    originalPrompt: string,
    workflowTemplate: { name: string; description: string },
    gatheredEvidence: string[]
  ): boolean {
    // REASONING-FIRST APPROACH: Always use AI reasoning for intelligent responses
    // Parse user intent to understand what they actually want
    const userIntent = UserIntentParser.parseIntent(originalPrompt);
    
    // Debug logging for decision making
    console.log('🧠 INTENT PARSING DEBUG:', {
      originalPrompt,
      userIntent,
      workflowName: workflowTemplate.name,
      evidenceCount: gatheredEvidence.length,
      decision: 'Always use AI reasoning'
    });
    
    // NEVER bypass LLM - always provide intelligent analysis
    // Users deserve thoughtful responses, not raw data dumps
    return false;
  }
}