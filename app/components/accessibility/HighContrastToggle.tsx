'use client';

import { useAccessibility } from '@/app/hooks/useAccessibility';
import { Eye, EyeOff } from 'lucide-react';

export function HighContrastToggle() {
  const { highContrast, toggleHighContrast, triggerHaptic, hapticPatterns } = useAccessibility();

  const handleToggle = () => {
    toggleHighContrast();
    triggerHaptic(hapticPatterns.medium);
  };

  return (
    <button
      onClick={handleToggle}
      className={`
        flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl
        transition-all duration-200 min-h-[48px]
        focus-visible:ring-2 focus-visible:ring-ring outline-none
        ${highContrast 
          ? 'bg-yellow-400 text-black border-2 border-black shadow-md' 
          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80 border-2 border-transparent'
        }
      `}
      aria-label={highContrast ? 'Disable high contrast mode' : 'Enable high contrast mode'}
      aria-pressed={highContrast}
    >
      {highContrast ? (
        <>
          <Eye className="w-5 h-5" aria-hidden="true" />
          <span className="font-bold">High Contrast On</span>
        </>
      ) : (
        <>
          <EyeOff className="w-5 h-5" aria-hidden="true" />
          <span className="font-medium">High Contrast</span>
        </>
      )}
    </button>
  );
}
