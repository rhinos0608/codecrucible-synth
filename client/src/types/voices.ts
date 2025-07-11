export interface CodePerspective {
  id: string;
  name: string;
  function: string;
  fragment: string;
  icon: string;
  color: string;
}

export interface DevelopmentRole {
  id: string;
  name: string;
  domain: string;
  description: string;
  icon: string;
  color: string;
}

// Code Analysis Engines - Core programming perspectives
export const CODE_PERSPECTIVES: CodePerspective[] = [
  {
    id: "seeker",
    name: "Explorer",
    function: "Investigates edge cases, alternative algorithms",
    fragment: "What if we refactored this with a completely different data structure? Let me explore the algorithmic space.",
    icon: "search",
    color: "seeker"
  },
  {
    id: "steward",
    name: "Maintainer", 
    function: "Focuses on code sustainability and technical debt",
    fragment: "This implementation must be maintainable, testable, and follow SOLID principles.",
    icon: "shield",
    color: "steward"
  },
  {
    id: "witness",
    name: "Analyzer",
    function: "Identifies patterns, performance bottlenecks, code smells", 
    fragment: "I'm detecting anti-patterns here. Let me provide performance and architectural analysis.",
    icon: "eye",
    color: "witness"
  },
  {
    id: "nurturer",
    name: "Developer",
    function: "Prioritizes developer experience and API usability",
    fragment: "How can we make this API more intuitive and developer-friendly?",
    icon: "heart",
    color: "nurturer"
  },
  {
    id: "decider",
    name: "Implementor",
    function: "Makes technical decisions, ships production code",
    fragment: "Here's the implementation strategy. Let's commit this solution and deploy.",
    icon: "target",
    color: "decider"
  }
];

// Code Specialization Engines - Technical specialists
export const DEVELOPMENT_ROLES: DevelopmentRole[] = [
  {
    id: "guardian",
    name: "Security Engineer",
    domain: "Security & Reliability",
    description: "Vulnerability analysis, input validation, and secure coding practices",
    icon: "shield-check", 
    color: "guardian"
  },
  {
    id: "architect",
    name: "Systems Architect",
    domain: "System Design",
    description: "Scalable architecture, design patterns, and microservices",
    icon: "building", 
    color: "architect"
  },
  {
    id: "designer",
    name: "UI/UX Engineer", 
    domain: "Frontend Engineering",
    description: "Component design, responsive layouts, and accessibility standards",
    icon: "palette",
    color: "designer"
  },
  {
    id: "optimizer",
    name: "Performance Engineer",
    domain: "Optimization",
    description: "Algorithm optimization, caching strategies, and performance monitoring",
    icon: "zap",
    color: "optimizer"
  }
];

export const QUICK_PROMPTS = [
  "Create a React component for a modern dashboard with real-time updates",
  "Build a TypeScript utility for handling async operations with proper error boundaries", 
  "Design a responsive layout system with Tailwind CSS and dark mode support",
  "Implement a state management solution with React Query and Zustand",
  "Build a REST API with Express.js, authentication, and database integration",
  "Create a GraphQL schema with resolvers and type-safe queries",
  "Design a microservices architecture with Docker and Kubernetes",
  "Implement a CI/CD pipeline with automated testing and deployment"
];

export type MergeStrategy = "consensus" | "competitive" | "collaborative";
export type AnalysisDepth = 1 | 2 | 3;

// Code generation configuration
export interface CodeGenerationConfig {
  codeStyle: "functional" | "object-oriented" | "hybrid";
  testCoverage: boolean;
  documentation: boolean;
  errorHandling: "basic" | "comprehensive" | "enterprise";
  optimizationLevel: "minimal" | "balanced" | "aggressive";
}

export interface PerspectiveState {
  selectedPerspectives: string[];
  selectedRoles: string[];
  prompt: string;
  analysisDepth: AnalysisDepth;
  mergeStrategy: MergeStrategy;
  qualityFiltering: boolean;
}
