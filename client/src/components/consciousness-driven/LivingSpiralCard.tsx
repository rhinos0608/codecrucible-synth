/**
 * Living Spiral Card Component - Consciousness-Driven Interface Pattern
 * Implements CodingPhilosophy.md Living Spiral Methodology in UI
 * Following FRONTEND.md consciousness principles for evolving patterns
 */

import { useState, useEffect, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Living Spiral Phases in UI Component Lifecycle
type SpiralPhase = 'collapse' | 'council' | 'synthesis' | 'rebirth';

interface LivingSpiralMetrics {
  interactionCount: number;
  lastInteraction: Date;
  userSatisfaction: number; // 0-1 scale
  adaptationLevel: number;  // How much the component has evolved
}

interface LivingSpiralCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  
  // Consciousness-driven properties
  consciousnessLevel?: number; // 1-10 scale
  voicePersonality?: 'explorer' | 'maintainer' | 'analyzer' | 'developer' | 'implementor';
  spiralPhase?: SpiralPhase;
  
  // Living pattern evolution
  onInteraction?: (metrics: LivingSpiralMetrics) => void;
  onPhaseTransition?: (fromPhase: SpiralPhase, toPhase: SpiralPhase) => void;
}

/**
 * Living Spiral Card - Evolves Through User Interaction
 * 
 * Consciousness Principles Applied:
 * - Alexander's Wholeness: Self-contained with clear boundaries
 * - Jung's Descent: Acknowledges complexity through spiral phases
 * - Campbell's Journey: Transformative interaction patterns
 * - Bateson's Learning: Adapts based on user interaction patterns
 */
export function LivingSpiralCard({
  title,
  description,
  children,
  className,
  consciousnessLevel = 5,
  voicePersonality = 'explorer',
  spiralPhase = 'collapse',
  onInteraction,
  onPhaseTransition,
  ...props
}: LivingSpiralCardProps) {
  const [currentPhase, setCurrentPhase] = useState<SpiralPhase>(spiralPhase);
  const [metrics, setMetrics] = useState<LivingSpiralMetrics>({
    interactionCount: 0,
    lastInteraction: new Date(),
    userSatisfaction: 0.5,
    adaptationLevel: 0
  });
  const [isHovered, setIsHovered] = useState(false);

  // Voice personality color schemes following consciousness principles
  const voiceColorSchemes = {
    explorer: {
      primary: 'from-blue-500 to-indigo-600',
      secondary: 'border-blue-200 dark:border-blue-800',
      accent: 'text-blue-700 dark:text-blue-300'
    },
    maintainer: {
      primary: 'from-green-500 to-emerald-600',
      secondary: 'border-green-200 dark:border-green-800',
      accent: 'text-green-700 dark:text-green-300'
    },
    analyzer: {
      primary: 'from-purple-500 to-violet-600',
      secondary: 'border-purple-200 dark:border-purple-800',
      accent: 'text-purple-700 dark:text-purple-300'
    },
    developer: {
      primary: 'from-orange-500 to-red-600',
      secondary: 'border-orange-200 dark:border-orange-800',
      accent: 'text-orange-700 dark:text-orange-300'
    },
    implementor: {
      primary: 'from-teal-500 to-cyan-600',
      secondary: 'border-teal-200 dark:border-teal-800',
      accent: 'text-teal-700 dark:text-teal-300'
    }
  };

  const colors = voiceColorSchemes[voicePersonality];

  // Spiral phase transitions following Living Spiral Methodology
  const phaseSequence: SpiralPhase[] = ['collapse', 'council', 'synthesis', 'rebirth'];
  
  const advancePhase = () => {
    const currentIndex = phaseSequence.indexOf(currentPhase);
    const nextIndex = (currentIndex + 1) % phaseSequence.length;
    const nextPhase = phaseSequence[nextIndex];
    
    onPhaseTransition?.(currentPhase, nextPhase);
    setCurrentPhase(nextPhase);
  };

  // Handle user interactions with consciousness tracking
  const handleInteraction = () => {
    const newMetrics: LivingSpiralMetrics = {
      interactionCount: metrics.interactionCount + 1,
      lastInteraction: new Date(),
      userSatisfaction: Math.min(1, metrics.userSatisfaction + 0.1),
      adaptationLevel: Math.min(1, metrics.adaptationLevel + 0.05)
    };
    
    setMetrics(newMetrics);
    onInteraction?.(newMetrics);

    // Advance spiral phase based on interaction frequency
    if (newMetrics.interactionCount % 3 === 0) {
      advancePhase();
    }
  };

  // Phase-specific visual states
  const phaseStyles = {
    collapse: 'scale-95 opacity-90',
    council: 'scale-100 opacity-100 shadow-lg',
    synthesis: 'scale-105 opacity-100 shadow-xl',
    rebirth: 'scale-100 opacity-100 shadow-2xl'
  };

  const phaseDescriptions = {
    collapse: 'Acknowledging complexity',
    council: 'Multi-voice dialogue',
    synthesis: 'Integrating perspectives', 
    rebirth: 'Emerging solution'
  };

  return (
    <motion.div
      className={cn("transition-all duration-300", className)}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={handleInteraction}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card 
        className={cn(
          "cursor-pointer transition-all duration-500",
          colors.secondary,
          phaseStyles[currentPhase],
          isHovered && "transform"
        )}
        {...props}
      >
        {/* Consciousness-level indicator */}
        <div className={cn(
          "absolute top-2 right-2 w-2 h-2 rounded-full bg-gradient-to-r opacity-60",
          colors.primary
        )} 
        title={`Consciousness Level: ${consciousnessLevel}/10`} 
        />

        {/* Living spiral phase indicator */}
        <div className="absolute top-2 left-2 flex items-center gap-1">
          {phaseSequence.map((phase, index) => (
            <div
              key={phase}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                phase === currentPhase 
                  ? cn("bg-gradient-to-r", colors.primary)
                  : "bg-gray-300 dark:bg-gray-600"
              )}
              title={phase === currentPhase ? phaseDescriptions[phase] : phase}
            />
          ))}
        </div>

        <CardHeader className="pb-3">
          <CardTitle className={cn("text-lg font-semibold", colors.accent)}>
            {title}
          </CardTitle>
          {description && (
            <CardDescription className="text-sm">
              {description}
            </CardDescription>
          )}
          
          {/* Current phase indicator */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPhase}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="text-xs text-gray-500 dark:text-gray-400 mt-1"
            >
              Phase: {phaseDescriptions[currentPhase]}
            </motion.div>
          </AnimatePresence>
        </CardHeader>

        <CardContent>
          {children}
          
          {/* Living pattern metrics */}
          {metrics.interactionCount > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <span>Interactions: {metrics.interactionCount}</span>
                <span>Adaptation: {Math.round(metrics.adaptationLevel * 100)}%</span>
              </div>
              
              {/* Consciousness evolution indicator */}
              <div className="mt-2">
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
                  <motion.div
                    className={cn("h-1 rounded-full bg-gradient-to-r", colors.primary)}
                    initial={{ width: 0 }}
                    animate={{ width: `${metrics.userSatisfaction * 100}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <span className="text-xs text-gray-400 mt-1">
                  QWAN Evolution: {Math.round(metrics.userSatisfaction * 100)}%
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}