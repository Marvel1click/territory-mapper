'use client';

import { useAccessibility } from '@/app/hooks/useAccessibility';
import { ZoomIn, ZoomOut } from 'lucide-react';

export function BigModeToggle() {
  const { bigMode, toggleBigMode, triggerHaptic, hapticPatterns } = useAccessibility();

  const handleToggle = () => {
    toggleBigMode();
    triggerHaptic(hapticPatterns.medium);
  };

  return (
    <button
      onClick={handleToggle}
      className={`
        flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl
        transition-all duration-200 min-h-[48px]
        focus-visible:ring-2 focus-visible:ring-ring outline-none
        ${bigMode 
          ? 'bg-primary text-primary-foreground shadow-md' 
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        }
      `}
      aria-label={bigMode ? 'Disable big mode' : 'Enable big mode'}
      aria-pressed={bigMode}
    >
      {bigMode ? (
        <>
          <ZoomOut className="w-5 h-5" aria-hidden="true" />
          <span className="font-semibold">Big Mode On</span>
        </>
      ) : (
        <>
          <ZoomIn className="w-5 h-5" aria-hidden="true" />
          <span className="font-medium">Big Mode</span>
        </>
      )}
    </button>
  );
}
