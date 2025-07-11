import { useState, useMemo } from "react";
import type { PromptAnalysis, VoiceRecommendation } from "@shared/intelligence-schemas";

// Client-side voice recommendation engine (simplified version)
export function useVoiceRecommendations() {
  const [recommendations, setRecommendations] = useState<VoiceRecommendation | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const voiceEngine = useMemo(() => {
    return {
      analyzePrompt: (prompt: string): PromptAnalysis => {
        const lowerPrompt = prompt.toLowerCase();
        const words = lowerPrompt.split(/\s+/);
        
        // Detect domains
        const domains: string[] = [];
        const domainKeywords = {
          react: ["react", "component", "jsx", "tsx", "hook", "state", "props"],
          typescript: ["typescript", "type", "interface", "generic", "enum"],
          api: ["api", "endpoint", "rest", "graphql", "http", "request"],
          security: ["auth", "login", "password", "token", "jwt", "secure"],
          performance: ["optimize", "cache", "speed", "performance", "async"],
          ui: ["ui", "ux", "design", "layout", "responsive", "css", "style"],
          database: ["database", "sql", "query", "model", "schema", "orm"],
        };

        for (const [domain, keywords] of Object.entries(domainKeywords)) {
          if (keywords.some(keyword => lowerPrompt.includes(keyword))) {
            domains.push(domain);
          }
        }

        // Determine complexity
        let complexity: 1 | 2 | 3 = 1;
        if (words.length > 20 || domains.length > 3) complexity = 3;
        else if (words.length > 10 || domains.length > 1) complexity = 2;

        // Extract requirements
        const requirements: string[] = [];
        if (lowerPrompt.includes("secure") || lowerPrompt.includes("auth")) requirements.push("security");
        if (lowerPrompt.includes("fast") || lowerPrompt.includes("performance")) requirements.push("performance");
        if (lowerPrompt.includes("ui") || lowerPrompt.includes("user")) requirements.push("ux");
        if (lowerPrompt.includes("scale")) requirements.push("scalability");

        return {
          domain: domains,
          complexity,
          requirements,
          keywords: domains,
          projectType: lowerPrompt.includes("component") ? "component" : undefined
        };
      },

      recommendVoices: (analysis: PromptAnalysis): VoiceRecommendation => {
        const perspectives = selectPerspectives(analysis);
        const roles = selectRoles(analysis);
        
        return {
          suggested: {
            perspectives,
            roles,
            confidence: 0.8,
            reasoning: generateReasoning(analysis, perspectives, roles)
          },
          alternatives: [
            {
              perspectives: ["steward", "decider"],
              roles: ["guardian"],
              confidence: 0.7,
              reasoning: "Conservative approach focusing on stability"
            }
          ],
          analysisConfidence: 0.8
        };
      }
    };
  }, []);

  const analyzePrompt = async (prompt: string) => {
    if (!prompt.trim()) {
      setRecommendations(null);
      return;
    }

    setIsAnalyzing(true);
    
    try {
      // Simulate API delay for better UX
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const analysis = voiceEngine.analyzePrompt(prompt);
      const recommendation = voiceEngine.recommendVoices(analysis);
      
      setRecommendations(recommendation);
    } catch (error) {
      console.error("Error analyzing prompt:", error);
      setRecommendations(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return {
    recommendations,
    isAnalyzing,
    analyzePrompt,
    clearRecommendations: () => setRecommendations(null)
  };
}

// Helper functions
function selectPerspectives(analysis: PromptAnalysis): string[] {
  const perspectives: string[] = [];

  // Logic for perspective selection based on analysis
  if (analysis.domain.includes("security") || analysis.requirements.includes("security")) {
    perspectives.push("steward"); // Maintainer for security focus
  }
  
  if (analysis.domain.includes("ui") || analysis.requirements.includes("ux")) {
    perspectives.push("nurturer"); // Developer for UX focus
  }
  
  if (analysis.complexity === 3) {
    perspectives.push("seeker"); // Explorer for complex problems
  }
  
  if (analysis.domain.includes("performance") || analysis.requirements.includes("performance")) {
    perspectives.push("witness"); // Analyzer for performance
  }

  // Default fallback
  if (perspectives.length === 0) {
    perspectives.push("decider"); // Implementor as default
  }

  return perspectives.slice(0, 2); // Limit to 2 perspectives
}

function selectRoles(analysis: PromptAnalysis): string[] {
  const roles: string[] = [];

  if (analysis.domain.includes("security") || analysis.requirements.includes("security")) {
    roles.push("guardian"); // Security Engineer
  }
  
  if (analysis.domain.includes("ui") || analysis.requirements.includes("ux")) {
    roles.push("designer"); // UI/UX Engineer
  }
  
  if (analysis.domain.includes("api") || analysis.requirements.includes("scalability")) {
    roles.push("architect"); // Systems Architect
  }
  
  if (analysis.domain.includes("performance") || analysis.requirements.includes("performance")) {
    roles.push("optimizer"); // Performance Engineer
  }

  // Default fallback
  if (roles.length === 0) {
    roles.push("architect"); // Systems Architect as default
  }

  return roles.slice(0, 1); // Limit to 1 role for simplicity
}

function generateReasoning(analysis: PromptAnalysis, perspectives: string[], roles: string[]): string {
  const reasons: string[] = [];

  // Reference the right sidebar elements
  if (analysis.domain.includes("security")) {
    reasons.push("selecting Security Engineer from Code Specialization Engines");
  }
  if (analysis.domain.includes("ui")) {
    reasons.push("selecting UI/UX Engineer from Code Specialization Engines");
  }
  if (analysis.domain.includes("api")) {
    reasons.push("selecting Systems Architect from Code Specialization Engines");
  }
  if (analysis.domain.includes("performance")) {
    reasons.push("selecting Performance Engineer from Code Specialization Engines");
  }
  if (analysis.complexity === 3) {
    reasons.push("selecting Explorer from Code Analysis Engines for complex exploration");
  }
  if (analysis.domain.includes("react")) {
    reasons.push("selecting Developer from Code Analysis Engines for React expertise");
  }

  return reasons.length > 0 
    ? `Recommended based on your prompt analysis: ${reasons.join(", ")}`
    : "General recommendation from Code Analysis and Specialization Engines";
}