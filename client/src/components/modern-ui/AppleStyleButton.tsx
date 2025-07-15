import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Apple-style button variants following FRONTEND.md consciousness principles
const buttonVariants = cva(
  // Base styles with Apple-quality micro-interactions
  "inline-flex items-center justify-center font-medium transition-all duration-200 ease-out " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 " +
  "disabled:opacity-50 disabled:pointer-events-none " +
  "active:scale-[0.98] hover:shadow-sm apple-button",
  {
    variants: {
      variant: {
        // Primary with Apple-style gradients and depth
        primary: 
          "bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-sm " +
          "hover:from-blue-400 hover:to-blue-500 hover:shadow-md " +
          "focus-visible:ring-blue-500 " +
          "active:from-blue-600 active:to-blue-700",
          
        // Secondary with Apple-style subtle styling  
        secondary:
          "bg-gray-100 text-gray-900 border border-gray-200 " +
          "hover:bg-gray-50 hover:border-gray-300 " +
          "focus-visible:ring-gray-500 " +
          "dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 " +
          "dark:hover:bg-gray-700",
          
        // Ghost with minimal styling
        ghost:
          "text-gray-700 hover:bg-gray-100 hover:text-gray-900 " +
          "focus-visible:ring-gray-500 " +
          "dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-gray-100",
          
        // Destructive with Apple-style red
        destructive:
          "bg-gradient-to-b from-red-500 to-red-600 text-white " +
          "hover:from-red-400 hover:to-red-500 hover:shadow-md " +
          "focus-visible:ring-red-500",
          
        // Consciousness variant with gradient personality
        consciousness:
          "bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 text-white " +
          "hover:shadow-lg hover:shadow-purple-500/25 " +
          "focus-visible:ring-purple-500 " +
          "relative overflow-hidden consciousness-button",
      },
      size: {
        sm: "h-8 px-3 text-xs rounded-md",
        default: "h-10 px-4 py-2 text-sm rounded-lg", 
        lg: "h-12 px-6 text-base rounded-lg",
        icon: "h-10 w-10 rounded-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

const AppleStyleButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, icon, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {children}
          </>
        ) : (
          <>
            {icon && <span className="mr-2">{icon}</span>}
            {children}
            {variant === "consciousness" && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 shimmer-effect" />
            )}
          </>
        )}
      </Comp>
    );
  }
);

AppleStyleButton.displayName = "AppleStyleButton";

export { AppleStyleButton, buttonVariants };
export type { ButtonProps };