import { z } from "zod";
import type { PromptAnalysis, VoiceRecommendation, VoiceCombination } from "@shared/intelligence-schemas";

export class VoiceRecommendationEngine {
  private domainKeywords = {
    react: ["react", "component", "jsx", "tsx", "hook", "state", "props", "render"],
    typescript: ["typescript", "type", "interface", "generic", "enum", "namespace"],
    api: ["api", "endpoint", "rest", "graphql", "http", "request", "response"],
    security: ["auth", "login", "password", "token", "jwt", "oauth", "secure", "validation"],
    performance: ["optimize", "cache", "speed", "performance", "async", "lazy", "memory"],
    ui: ["ui", "ux", "design", "layout", "responsive", "css", "style", "animation"],
    database: ["database", "sql", "query", "model", "schema", "migration", "orm"],
    testing: ["test", "unit", "integration", "mock", "jest", "cypress", "e2e"],
    deployment: ["deploy", "docker", "ci", "cd", "build", "production", "staging"]
  };

  private voiceStrengths = {
    // Code Analysis Engines (perspectives)
    seeker: ["exploration", "alternatives", "edge-cases", "innovation", "research"],
    steward: ["sustainability", "maintenance", "best-practices", "stability", "documentation"],
    witness: ["analysis", "patterns", "performance", "monitoring", "debugging"],
    nurturer: ["developer-experience", "usability", "learning", "accessibility", "team"],
    decider: ["implementation", "decisions", "deadlines", "production", "shipping"],
    
    // Code Specialization Engines (roles)
    guardian: ["security", "validation", "authentication", "authorization", "privacy"],
    architect: ["system-design", "scalability", "patterns", "architecture", "microservices"],
    designer: ["ui", "ux", "components", "responsive", "accessibility", "user-interface"],
    optimizer: ["performance", "optimization", "caching", "algorithms", "efficiency"]
  };

  analyzePrompt(prompt: string): PromptAnalysis {
    const lowerPrompt = prompt.toLowerCase();
    const words = lowerPrompt.split(/\s+/);
    
    // Detect domains
    const domains: string[] = [];
    for (const [domain, keywords] of Object.entries(this.domainKeywords)) {
      if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
        domains.push(domain);
      }
    }

    // Determine complexity based on prompt length and technical indicators
    let complexity: 1 | 2 | 3 = 1;
    if (words.length > 20 || domains.length > 3) complexity = 3;
    else if (words.length > 10 || domains.length > 1) complexity = 2;

    // Extract requirements
    const requirements: string[] = [];
    if (lowerPrompt.includes("secure") || lowerPrompt.includes("auth")) requirements.push("security");
    if (lowerPrompt.includes("fast") || lowerPrompt.includes("performance")) requirements.push("performance");
    if (lowerPrompt.includes("ui") || lowerPrompt.includes("user")) requirements.push("ux");
    if (lowerPrompt.includes("scale") || lowerPrompt.includes("enterprise")) requirements.push("scalability");
    if (lowerPrompt.includes("test") || lowerPrompt.includes("quality")) requirements.push("testing");

    return {
      domain: domains,
      complexity,
      requirements,
      keywords: this.extractTechnicalKeywords(lowerPrompt),
      projectType: this.detectProjectType(lowerPrompt)
    };
  }

  recommendVoices(analysis: PromptAnalysis): VoiceRecommendation {
    const perspectives = this.selectPerspectives(analysis);
    const roles = this.selectRoles(analysis);
    
    const suggested: VoiceCombination = {
      perspectives,
      roles,
      confidence: this.calculateConfidence(analysis, perspectives, roles),
      reasoning: this.generateReasoning(analysis, perspectives, roles)
    };

    const alternatives = this.generateAlternatives(analysis, suggested);

    return {
      suggested,
      alternatives,
      analysisConfidence: this.calculateAnalysisConfidence(analysis)
    };
  }

  private selectPerspectives(analysis: PromptAnalysis): string[] {
    const scores: Record<string, number> = {
      seeker: 0,
      steward: 0,
      witness: 0,
      nurturer: 0,
      decider: 0
    };

    // Score based on domains
    if (analysis.domain.includes("react") || analysis.domain.includes("ui")) {
      scores.nurturer += 2; // Developer experience focus
    }
    
    if (analysis.domain.includes("security")) {
      scores.steward += 3; // Best practices and safety
      scores.witness += 1; // Analysis
    }

    if (analysis.domain.includes("performance")) {
      scores.witness += 2; // Pattern analysis
      scores.decider += 1; // Implementation focus
    }

    if (analysis.domain.includes("api")) {
      scores.steward += 1; // Best practices
    }

    // Score based on complexity
    if (analysis.complexity === 3) {
      scores.seeker += 2; // Need exploration for complex problems
    } else if (analysis.complexity === 1) {
      scores.decider += 2; // Simple implementation
      scores.nurturer += 1;
    }

    // Score based on requirements
    if (analysis.requirements.includes("security")) scores.steward += 3;
    if (analysis.requirements.includes("performance")) scores.witness += 2;
    if (analysis.requirements.includes("ux")) scores.nurturer += 2;
    if (analysis.requirements.includes("scalability")) scores.seeker += 2;

    // Select top 2-3 perspectives
    const sortedPerspectives = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, analysis.complexity === 3 ? 3 : 2)
      .map(([name]) => name);

    return sortedPerspectives;
  }

  private selectRoles(analysis: PromptAnalysis): string[] {
    const scores: Record<string, number> = {
      guardian: 0,
      architect: 0,
      designer: 0,
      optimizer: 0
    };

    // Score based on domains and requirements
    if (analysis.domain.includes("security") || analysis.requirements.includes("security")) {
      scores.guardian += 3;
    }

    if (analysis.domain.includes("ui") || analysis.requirements.includes("ux")) {
      scores.designer += 3;
    }

    if (analysis.domain.includes("api") || analysis.requirements.includes("scalability")) {
      scores.architect += 3;
    }

    if (analysis.domain.includes("performance") || analysis.requirements.includes("performance")) {
      scores.optimizer += 3;
    }

    // For complex projects, add architect
    if (analysis.complexity === 3) {
      scores.architect += 2;
    }

    // Select top 1-2 roles
    const sortedRoles = Object.entries(scores)
      .sort(([,a], [,b]) => b - a)
      .slice(0, analysis.complexity >= 2 ? 2 : 1)
      .map(([name]) => name);

    return sortedRoles;
  }

  private calculateConfidence(analysis: PromptAnalysis, perspectives: string[], roles: string[]): number {
    let confidence = 0.7; // Base confidence

    // Higher confidence for clear domain matches
    if (analysis.domain.length > 0) confidence += 0.1;
    if (analysis.requirements.length > 0) confidence += 0.1;
    
    // Lower confidence for very complex or very simple prompts
    if (analysis.complexity === 3) confidence -= 0.1;
    if (analysis.complexity === 1 && analysis.domain.length === 0) confidence -= 0.2;

    return Math.min(0.95, Math.max(0.3, confidence));
  }

  private generateReasoning(analysis: PromptAnalysis, perspectives: string[], roles: string[]): string {
    const reasons: string[] = [];

    // Explain perspective choices using server-side IDs but client-friendly names
    if (perspectives.includes("steward")) {
      reasons.push("Maintainer for code sustainability and best practices");
    }
    if (perspectives.includes("seeker")) {
      reasons.push("Explorer to investigate alternative approaches");
    }
    if (perspectives.includes("witness")) {
      reasons.push("Analyzer for pattern recognition and performance analysis");
    }
    if (perspectives.includes("nurturer")) {
      reasons.push("Developer for optimal developer experience");
    }
    if (perspectives.includes("decider")) {
      reasons.push("Implementor for practical implementation focus");
    }

    // Explain role choices using current naming scheme
    if (roles.includes("guardian")) {
      reasons.push("Security Engineer for security and validation");
    }
    if (roles.includes("architect")) {
      reasons.push("Systems Architect for scalable system design");
    }
    if (roles.includes("designer")) {
      reasons.push("UI/UX Engineer for user interface excellence");
    }
    if (roles.includes("optimizer")) {
      reasons.push("Performance Engineer for performance optimization");
    }

    return reasons.length > 0 
      ? `Recommended based on: ${reasons.join(", ")}`
      : "General-purpose recommendation for your coding task";
  }

  private generateAlternatives(analysis: PromptAnalysis, suggested: VoiceCombination): VoiceCombination[] {
    const alternatives: VoiceCombination[] = [];

    // Conservative alternative (focus on stability)
    if (!suggested.perspectives.includes("steward")) {
      alternatives.push({
        perspectives: ["steward", "decider"],
        roles: ["guardian"],
        confidence: 0.7,
        reasoning: "Conservative approach focusing on stability and security"
      });
    }

    // Innovative alternative (focus on exploration)
    if (!suggested.perspectives.includes("seeker")) {
      alternatives.push({
        perspectives: ["seeker", "nurturer"],
        roles: ["architect"],
        confidence: 0.6,
        reasoning: "Innovative approach exploring new possibilities"
      });
    }

    return alternatives.slice(0, 2); // Limit to 2 alternatives
  }

  private extractTechnicalKeywords(prompt: string): string[] {
    const allKeywords = Object.values(this.domainKeywords).flat();
    return allKeywords.filter(keyword => prompt.includes(keyword));
  }

  private detectProjectType(prompt: string): string | undefined {
    if (prompt.includes("component")) return "component";
    if (prompt.includes("api") || prompt.includes("endpoint")) return "api";
    if (prompt.includes("database") || prompt.includes("model")) return "database";
    if (prompt.includes("test")) return "testing";
    if (prompt.includes("deploy")) return "deployment";
    return undefined;
  }

  private calculateAnalysisConfidence(analysis: PromptAnalysis): number {
    let confidence = 0.5;
    
    if (analysis.domain.length > 0) confidence += 0.2;
    if (analysis.requirements.length > 0) confidence += 0.2;
    if (analysis.keywords.length > 2) confidence += 0.1;
    
    return Math.min(0.9, confidence);
  }
}