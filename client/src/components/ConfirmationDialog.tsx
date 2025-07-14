import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Brain, Clock, Shield } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  type?: 'warning' | 'danger' | 'info' | 'critical';
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  context?: {
    feature?: string;
    progress?: string;
    timeInvested?: string;
    consequences?: string[];
  };
}

/**
 * Enhanced confirmation dialog following AI_INSTRUCTIONS.md and CodingPhilosophy.md patterns
 * Provides consciousness-aware confirmation with context about user actions
 */
export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  type = 'warning',
  confirmText = 'Continue',
  cancelText = 'Cancel',
  isDestructive = false,
  context
}: ConfirmationDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
      onClose();
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'danger':
      case 'critical':
        return <AlertTriangle className="w-6 h-6 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case 'info':
        return <Brain className="w-6 h-6 text-blue-500" />;
      default:
        return <Shield className="w-6 h-6 text-gray-500" />;
    }
  };

  const getTypeColors = () => {
    switch (type) {
      case 'danger':
      case 'critical':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950';
      case 'warning':
        return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950';
      case 'info':
        return 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950';
      default:
        return 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {getTypeIcon()}
            {title}
            {type === 'critical' && (
              <Badge variant="destructive" className="text-xs">
                CRITICAL
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-left">
            {description}
          </DialogDescription>
        </DialogHeader>

        {/* Context Information - Following CodingPhilosophy.md consciousness principles */}
        {context && (
          <div className={`p-4 rounded-lg border ${getTypeColors()}`}>
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2 text-[#484a52]">
              <Brain className="w-4 h-4" />
              Impact Assessment
            </h4>
            <div className="space-y-2 text-sm">
              {context.feature && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Feature:</span>
                  <span className="font-medium">{context.feature}</span>
                </div>
              )}
              {context.progress && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Progress:</span>
                  <span className="font-medium">{context.progress}</span>
                </div>
              )}
              {context.timeInvested && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-400">Time Invested:</span>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span className="font-medium">{context.timeInvested}</span>
                  </div>
                </div>
              )}
              {context.consequences && context.consequences.length > 0 && (
                <div>
                  <span className="text-gray-600 dark:text-gray-400 block mb-1">Consequences:</span>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    {context.consequences.map((consequence, index) => (
                      <li key={index} className="text-xs text-gray-700 dark:text-gray-300">
                        {consequence}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isConfirming}
          >
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? 'Processing...' : confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook for managing confirmation dialogs with consciousness awareness
 * Following AI_INSTRUCTIONS.md patterns for state management
 */
export function useConfirmationDialog() {
  const [dialogState, setDialogState] = useState<{
    isOpen: boolean;
    config: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose' | 'onConfirm'>;
    onConfirm?: () => void | Promise<void>;
  }>({
    isOpen: false,
    config: {
      title: '',
      description: ''
    }
  });

  const showConfirmation = (
    config: Omit<ConfirmationDialogProps, 'isOpen' | 'onClose' | 'onConfirm'>,
    onConfirm: () => void | Promise<void>
  ) => {
    setDialogState({
      isOpen: true,
      config,
      onConfirm
    });
  };

  const hideConfirmation = () => {
    setDialogState(prev => ({
      ...prev,
      isOpen: false
    }));
  };

  const handleConfirm = async () => {
    if (dialogState.onConfirm) {
      await dialogState.onConfirm();
    }
  };

  return {
    showConfirmation,
    hideConfirmation,
    confirmationDialog: (
      <ConfirmationDialog
        {...dialogState.config}
        isOpen={dialogState.isOpen}
        onClose={hideConfirmation}
        onConfirm={handleConfirm}
      />
    )
  };
}