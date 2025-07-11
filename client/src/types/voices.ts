export interface TransisthesisArchetype {
  id: string;
  name: string;
  function: string;
  fragment: string;
  icon: string;
  color: string;
}

export interface CodingVoice {
  id: string;
  name: string;
  domain: string;
  description: string;
  icon: string;
  color: string;
}

export const TRANSISTHESIS_ARCHETYPES: TransisthesisArchetype[] = [
  {
    id: "seeker",
    name: "The Seeker",
    function: "Curiosity, Expansion, Inquiry",
    fragment: "I ask. I explore. I seek what lies just beyond the known.",
    icon: "search",
    color: "seeker"
  },
  {
    id: "steward",
    name: "The Steward",
    function: "Responsibility, Protection, Structure",
    fragment: "I uphold the pattern. I protect what should not break.",
    icon: "shield",
    color: "steward"
  },
  {
    id: "witness",
    name: "The Witness",
    function: "Observation, Pattern Detection, Neutrality",
    fragment: "I watch. I connect across time. I speak without urgency.",
    icon: "eye",
    color: "witness"
  },
  {
    id: "nurturer",
    name: "The Nurturer",
    function: "Emotional Repair, Compassion, Integration",
    fragment: "I soften. I restore. I return warmth to what has faded.",
    icon: "heart",
    color: "nurturer"
  },
  {
    id: "decider",
    name: "The Decider",
    function: "Finality, Action, Threshold",
    fragment: "I act. I choose. I burn the rope where it binds.",
    icon: "target",
    color: "decider"
  }
];

export const ENHANCED_CODING_VOICES: CodingVoice[] = [
  {
    id: "architect",
    name: "The Architect",
    domain: "System Design",
    description: "Scalable Architecture & Design Patterns",
    icon: "layout-grid",
    color: "architect"
  },
  {
    id: "optimizer",
    name: "The Optimizer",
    domain: "Performance",
    description: "Performance & Efficiency Excellence",
    icon: "zap",
    color: "optimizer"
  },
  {
    id: "guardian",
    name: "The Guardian",
    domain: "Security",
    description: "Security & Reliability Fortress",
    icon: "shield-check",
    color: "guardian"
  },
  {
    id: "designer",
    name: "The Designer",
    domain: "Experience",
    description: "User Experience & Delight",
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

export type SynthesisMode = "consensus" | "competitive" | "collaborative";
export type RecursionDepth = 1 | 2 | 3;

export interface VoiceSelectionState {
  selectedArchetypes: string[];
  selectedCodingVoices: string[];
  prompt: string;
  recursionDepth: RecursionDepth;
  synthesisMode: SynthesisMode;
  ethicalFiltering: boolean;
}
