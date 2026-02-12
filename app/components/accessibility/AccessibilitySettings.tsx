'use client';

import { useAccessibility } from '@/app/hooks/useAccessibility';
import { HighContrastToggle } from './HighContrastToggle';
import { BigModeToggle } from './BigModeToggle';
import { Volume2, VolumeX, Smartphone, PhoneOff, Palette } from 'lucide-react';

export function AccessibilitySettings() {
  const {
    haptics,
    voiceEnabled,
    reducedMotion,
    toggleHaptics,
    toggleVoice,
    toggleReducedMotion,
  } = useAccessibility();

  return (
    <section className="p-6 sm:p-8 bg-card rounded-2xl border border-border shadow-sm" aria-labelledby="accessibility-heading">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-primary/10 rounded-xl">
          <Palette className="w-6 h-6 text-primary" aria-hidden="true" />
        </div>
        <h2 id="accessibility-heading" className="text-xl sm:text-2xl font-bold">Accessibility Settings</h2>
      </div>

      <div className="space-y-8">
        {/* Visual Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Visual
          </h3>
          <div className="flex flex-wrap gap-3">
            <HighContrastToggle />
            <BigModeToggle />
          </div>
        </div>

        {/* Haptic Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Haptics
          </h3>
          <button
            onClick={toggleHaptics}
            className={`
              flex items-center gap-3 px-5 py-3 rounded-xl
              transition-all duration-200 min-h-[48px]
              focus-visible:ring-2 focus-visible:ring-ring
              ${haptics
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }
            `}
            aria-pressed={haptics}
          >
            {haptics ? (
              <>
                <Smartphone className="w-5 h-5" aria-hidden="true" />
                <span className="font-medium">Vibration On</span>
              </>
            ) : (
              <>
                <PhoneOff className="w-5 h-5" aria-hidden="true" />
                <span className="font-medium">Vibration Off</span>
              </>
            )}
          </button>
          <p className="text-sm text-muted-foreground pl-1">
            Get haptic feedback when approaching Do Not Call addresses
          </p>
        </div>

        {/* Voice Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Voice
          </h3>
          <button
            onClick={toggleVoice}
            className={`
              flex items-center gap-3 px-5 py-3 rounded-xl
              transition-all duration-200 min-h-[48px]
              focus-visible:ring-2 focus-visible:ring-ring
              ${voiceEnabled
                ? 'bg-primary/10 text-primary border border-primary/20'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }
            `}
            aria-pressed={voiceEnabled}
          >
            {voiceEnabled ? (
              <>
                <Volume2 className="w-5 h-5" aria-hidden="true" />
                <span className="font-medium">Voice-to-Text On</span>
              </>
            ) : (
              <>
                <VolumeX className="w-5 h-5" aria-hidden="true" />
                <span className="font-medium">Voice-to-Text Off</span>
              </>
            )}
          </button>
        </div>

        {/* Motion Settings */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Motion
          </h3>
          <label className="flex items-center gap-4 cursor-pointer p-2 -m-2 rounded-xl hover:bg-muted/50 transition-colors">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={toggleReducedMotion}
              className="w-5 h-5 rounded-lg border-border text-primary focus:ring-primary cursor-pointer"
            />
            <span className="font-medium">Reduce motion and animations</span>
          </label>
        </div>
      </div>
    </section>
  );
}
