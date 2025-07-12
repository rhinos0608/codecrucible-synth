import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

interface NavigationGuardOptions {
  shouldBlock: boolean;
  message?: string;
  onBlock?: () => void;
  onConfirm?: () => void;
}

/**
 * Navigation guard hook following AI_INSTRUCTIONS.md patterns
 * Prevents accidental navigation during critical operations like code generation
 */
export const useNavigationGuard = ({
  shouldBlock,
  message = 'Are you sure you want to leave? Your code generation progress will be lost.',
  onBlock,
  onConfirm
}: NavigationGuardOptions) => {
  const [location, setLocation] = useLocation();
  const isBlockingRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (shouldBlock) {
        event.preventDefault();
        event.returnValue = message;
        onBlock?.();
        return message;
      }
    };

    const handlePopState = (event: PopStateEvent) => {
      if (shouldBlock && !isBlockingRef.current) {
        event.preventDefault();
        
        // Show confirmation dialog
        const confirmed = window.confirm(message);
        
        if (confirmed) {
          isBlockingRef.current = true;
          onConfirm?.();
          // Allow navigation after confirmation
          window.history.back();
        } else {
          // Prevent navigation
          window.history.pushState(null, '', window.location.pathname);
          onBlock?.();
        }
      }
    };

    if (shouldBlock) {
      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [shouldBlock, message, onBlock, onConfirm]);

  // Custom navigation function with confirmation
  const navigateWithConfirmation = (newLocation: string) => {
    if (shouldBlock) {
      const confirmed = window.confirm(message);
      
      if (confirmed) {
        onConfirm?.();
        setLocation(newLocation);
      } else {
        onBlock?.();
      }
    } else {
      setLocation(newLocation);
    }
  };

  return {
    navigateWithConfirmation,
    isBlocking: shouldBlock
  };
};