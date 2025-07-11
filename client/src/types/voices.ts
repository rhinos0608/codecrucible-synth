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

// Transisthesis Archetypes - Core philosophical perspectives
export const CODE_PERSPECTIVES: CodePerspective[] = [
  {
    id: "seeker",
    name: "Seeker",
    function: "Questions assumptions, explores alternatives",
    fragment: "What if we approached this completely differently? Let me explore the unknowns.",
    icon: "search",
    color: "seeker"
  },
  {
    id: "steward",
    name: "Steward", 
    function: "Focuses on sustainability and care",
    fragment: "This solution must be maintainable and responsible for the long term.",
    icon: "shield",
    color: "steward"
  },
  {
    id: "witness",
    name: "Witness",
    function: "Observes patterns, provides context", 
    fragment: "I see patterns emerging here. Let me provide the broader context.",
    icon: "eye",
    color: "witness"
  },
  {
    id: "nurturer",
    name: "Nurturer",
    function: "Supports growth and learning",
    fragment: "How can we make this more intuitive and supportive for users?",
    icon: "heart",
    color: "nurturer"
  },
  {
    id: "decider",
    name: "Decider",
    function: "Makes decisive choices, drives action",
    fragment: "Here's the decision. Let's implement this approach and move forward.",
    icon: "target",
    color: "decider"
  }
];

// Enhanced Coding Voices - Technical specialists
export const DEVELOPMENT_ROLES: DevelopmentRole[] = [
  {
    id: "guardian",
    name: "Guardian",
    domain: "Security & Reliability",
    description: "Security, error prevention, and defensive coding",
    icon: "shield-check", 
    color: "guardian"
  },
  {
    id: "architect",
    name: "Architect",
    domain: "System Design",
    description: "Scalable systems, design patterns, and technical architecture",
    icon: "building", 
    color: "architect"
  },
  {
    id: "designer",
    name: "Designer", 
    domain: "User Experience",
    description: "Interface design, user experience, and accessibility",
    icon: "palette",
    color: "designer"
  },
  {
    id: "optimizer",
    name: "Optimizer",
    domain: "Performance",
    description: "Speed, efficiency, and performance optimization",
    icon: "zap",
    color: "optimizer"
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
