import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { useConfirmationDialog } from '@/components/ConfirmationDialog';

interface NavigationGuardOptions {
  shouldBlock: boolean;
  message?: string;
  onBlock?: () => void;
  onConfirm?: () => void;
  context?: {
    feature?: string;
    progress?: string;
    timeInvested?: string;
    consequences?: string[];
  };
  type?: 'warning' | 'danger' | 'info' | 'critical';
}

/**
 * Enhanced navigation guard hook following AI_INSTRUCTIONS.md patterns
 * Prevents accidental navigation during critical operations with consciousness-aware confirmations
 */
export const useNavigationGuard = ({
  shouldBlock,
  message = 'Are you sure you want to leave? Your progress will be lost.',
  onBlock,
  onConfirm,
  context,
  type = 'warning'
}: NavigationGuardOptions) => {
  const [location, setLocation] = useLocation();
  const isBlockingRef = useRef(false);
  const pendingNavigationRef = useRef<string | null>(null);
  const { showConfirmation, confirmationDialog } = useConfirmationDialog();

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
        
        // Show enhanced confirmation dialog
        showConfirmation(
          {
            title: 'Confirm Navigation',
            description: message,
            type,
            context,
            confirmText: 'Leave Anyway',
            cancelText: 'Stay Here',
            isDestructive: type === 'danger' || type === 'critical'
          },
          () => {
            isBlockingRef.current = true;
            onConfirm?.();
            // Allow navigation after confirmation
            setTimeout(() => window.history.back(), 100);
          }
        );
        
        // Prevent immediate navigation
        window.history.pushState(null, '', window.location.pathname);
        onBlock?.();
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

  // Enhanced navigation function with consciousness-aware confirmation
  const navigateWithConfirmation = (newLocation: string) => {
    if (shouldBlock) {
      showConfirmation(
        {
          title: 'Confirm Navigation',
          description: message,
          type,
          context,
          confirmText: 'Continue',
          cancelText: 'Stay Here',
          isDestructive: type === 'danger' || type === 'critical'
        },
        () => {
          onConfirm?.();
          setLocation(newLocation);
        }
      );
    } else {
      setLocation(newLocation);
    }
  };

  return {
    navigateWithConfirmation,
    isBlocking: shouldBlock,
    confirmationDialog
  };
};