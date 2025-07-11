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

export const CODE_PERSPECTIVES: CodePerspective[] = [
  {
    id: "explorer",
    name: "Explorer",
    function: "Innovation, Research, Discovery",
    fragment: "Let's try something new. What if we approach this differently?",
    icon: "search",
    color: "seeker"
  },
  {
    id: "maintainer",
    name: "Maintainer", 
    function: "Stability, Best Practices, Quality",
    fragment: "This needs to be sustainable and follow established patterns.",
    icon: "shield",
    color: "steward"
  },
  {
    id: "reviewer",
    name: "Reviewer",
    function: "Analysis, Pattern Recognition, Assessment", 
    fragment: "I see patterns here. Let me analyze the trade-offs.",
    icon: "eye",
    color: "witness"
  },
  {
    id: "mentor",
    name: "Mentor",
    function: "User Experience, Collaboration, Integration",
    fragment: "How can we make this more intuitive and accessible?",
    icon: "heart",
    color: "nurturer"
  },
  {
    id: "lead",
    name: "Tech Lead",
    function: "Decision Making, Implementation, Delivery",
    fragment: "Here's what we're building. Let's ship it.",
    icon: "target",
    color: "decider"
  }
];

export const DEVELOPMENT_ROLES: DevelopmentRole[] = [
  {
    id: "architect",
    name: "System Architect",
    domain: "Architecture",
    description: "Scalable systems and design patterns",
    icon: "layout-grid", 
    color: "architect"
  },
  {
    id: "optimizer",
    name: "Performance Engineer", 
    domain: "Performance",
    description: "Speed, efficiency, and optimization",
    icon: "zap",
    color: "optimizer"
  },
  {
    id: "security",
    name: "Security Engineer",
    domain: "Security",
    description: "Safety, validation, and reliability",
    icon: "shield-check",
    color: "guardian"
  },
  {
    id: "frontend",
    name: "Frontend Developer",
    domain: "User Interface",
    description: "UI/UX and user experience",
    icon: "palette",
    color: "designer"
  }
];

export const QUICK_PROMPTS = [
  "Create a React component for a modern dashboard with real-time updates",
  "Build a TypeScript utility for handling async operations with proper error boundaries",
  "Design a responsive layout system with Tailwind CSS and dark mode support",
  "Implement a state management solution with React Query and Zustand"
];

export type MergeStrategy = "consensus" | "competitive" | "collaborative";
export type AnalysisDepth = 1 | 2 | 3;

export interface PerspectiveState {
  selectedPerspectives: string[];
  selectedRoles: string[];
  prompt: string;
  analysisDepth: AnalysisDepth;
  mergeStrategy: MergeStrategy;
  qualityFiltering: boolean;
}
