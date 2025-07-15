import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Button, ButtonProps } from "@/components/ui/button";

interface AppleStyleButtonProps extends ButtonProps {
  variant?: 'primary' | 'secondary' | 'consciousness';
  icon?: React.ReactNode;
}

export const AppleStyleButton = forwardRef<HTMLButtonElement, AppleStyleButtonProps>(
  ({ className, variant = 'primary', icon, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          // Base Apple-style design
          "relative overflow-hidden transition-all duration-200 font-medium",
          "active:scale-[0.98] hover:shadow-lg",
          
          // Variant-specific styling following FRONTEND.md consciousness principles
          variant === 'primary' && 
            "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white",
          variant === 'secondary' && 
            "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100",
          variant === 'consciousness' && 
            "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white hover:shadow-purple-500/25",
          
          // QWAN principles: Wholeness, Freedom, Exactness, Egolessness, Eternity
          "rounded-lg px-6 py-3 text-sm", // Timeless proportions
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500", // Accessibility
          "disabled:opacity-50 disabled:cursor-not-allowed", // Clear states
          
          className
        )}
        {...props}
      >
        <span className="flex items-center justify-center gap-2">
          {icon && icon}
          {children}
        </span>
      </Button>
    );
  }
);

AppleStyleButton.displayName = "AppleStyleButton";

// Export button variants for external use following CodingPhilosophy.md patterns
export const buttonVariants = {
  primary: 'primary',
  secondary: 'secondary', 
  consciousness: 'consciousness'
} as const;

export type { AppleStyleButtonProps as ButtonProps };