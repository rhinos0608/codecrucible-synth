/**
 * QWAN Button Component - Apple-Standard Quality Through Consciousness
 * Implements Alexander's Pattern Language and Living Spiral Methodology
 * Following FRONTEND.md consciousness principles for timeless UI patterns
 */

import { forwardRef, ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// QWAN Assessment Interface for UI Components
interface QWANAssessment {
  wholeness: boolean;    // Complete and self-contained
  freedom: boolean;      // Natural interaction without friction
  exactness: boolean;    // Elegantly solves real user needs
  egolessness: boolean;  // Serves user goals, not designer ego
  eternity: boolean;     // Timeless patterns that age gracefully
}

// Button variants following consciousness-driven design principles
const buttonVariants = cva(
  // Base QWAN pattern: Clear affordance and natural feedback
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        // Primary: Clear action hierarchy (Exactness)
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow hover:shadow-md",
        
        // Consciousness-driven: Living spiral energy visualization
        consciousness: "bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 text-white hover:from-purple-700 hover:via-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl",
        
        // Council: Multi-voice collaboration indicator
        council: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-lg hover:shadow-xl",
        
        // Destructive: Clear warning without aggression (Egolessness)
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow hover:shadow-md",
        
        // Outline: Subtle presence, serves content (Egolessness)
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        
        // Secondary: Supporting actions (Freedom)
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        
        // Ghost: Minimal interference (Egolessness + Freedom)
        ghost: "hover:bg-accent hover:text-accent-foreground",
        
        // Link: Natural text flow (Freedom)
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        // Timeless sizing ratios (Eternity)
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  qwan?: Partial<QWANAssessment>; // Optional QWAN assessment override
}

/**
 * Consciousness-Driven Button Component
 * 
 * QWAN Principles Applied:
 * - Wholeness: Complete interaction affordance with clear boundaries
 * - Freedom: Natural click/tap/keyboard interaction without friction
 * - Exactness: Variants solve specific user needs elegantly
 * - Egolessness: Serves user goals, accessible to all users
 * - Eternity: Timeless interaction patterns that age gracefully
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, qwan, ...props }, ref) => {
    // Default QWAN assessment for this component
    const componentQWAN: QWANAssessment = {
      wholeness: true,   // Complete button affordance
      freedom: true,     // Natural interaction patterns
      exactness: true,   // Clear action communication
      egolessness: true, // Serves user needs
      eternity: true,    // Timeless button patterns
      ...qwan // Allow override for specific use cases
    };

    // Living pattern: Component evolves based on consciousness principles
    const consciousnessClass = variant === 'consciousness' 
      ? 'bg-consciousness-gradient hover:bg-consciousness-gradient-hover' 
      : '';

    return (
      <button
        className={cn(
          buttonVariants({ variant, size }),
          consciousnessClass,
          className
        )}
        ref={ref}
        data-qwan-wholeness={componentQWAN.wholeness}
        data-qwan-freedom={componentQWAN.freedom}
        data-qwan-exactness={componentQWAN.exactness}
        data-qwan-egolessness={componentQWAN.egolessness}
        data-qwan-eternity={componentQWAN.eternity}
        {...props}
      />
    );
  }
);

Button.displayName = "QWANButton";

export { Button, buttonVariants };