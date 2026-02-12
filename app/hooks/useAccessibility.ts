'use client';

import { useCallback, useEffect } from 'react';
import { useAccessibilityStore } from '@/app/lib/store';

export function useAccessibility() {
  const {
    highContrast,
    bigMode,
    haptics,
    voiceEnabled,
    reducedMotion,
    toggleHighContrast,
    toggleBigMode,
    toggleHaptics,
    toggleVoice,
    toggleReducedMotion,
  } = useAccessibilityStore();

  // Apply classes on mount
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('high-contrast', highContrast);
      document.documentElement.classList.toggle('big-mode', bigMode);
    }
  }, [highContrast, bigMode]);

  // Haptic feedback trigger
  const triggerHaptic = useCallback(
    (pattern: number | number[] = 50) => {
      if (!haptics) return;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    },
    [haptics]
  );

  // Haptic patterns
  const hapticPatterns = {
    light: 20,
    medium: 50,
    heavy: 100,
    success: [50, 100, 50],
    warning: [100, 50, 100],
    error: [200, 100, 200],
    dncProximity: [30, 50, 30, 50, 30],
  };

  return {
    // States
    highContrast,
    bigMode,
    haptics,
    voiceEnabled,
    reducedMotion,
    
    // Toggles
    toggleHighContrast,
    toggleBigMode,
    toggleHaptics,
    toggleVoice,
    toggleReducedMotion,
    
    // Actions
    triggerHaptic,
    hapticPatterns,
  };
}
