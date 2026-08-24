'use client';

import { Eye, Moon, Move, Smartphone, Type, Volume2 } from 'lucide-react';
import { useAccessibility } from '@/app/hooks/useAccessibility';
import { useDarkMode } from './DarkModeToggle';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';

export function AccessibilitySettings() {
  const settings = useAccessibility();
  const dark = useDarkMode();
  const rows = [
    { id: 'theme-dark', label: 'Dark theme', description: 'Use a low-glare dark surface.', checked: dark.isDark, toggle: dark.toggle, icon: Moon },
    { id: 'high-contrast', label: 'High contrast', description: 'Use black, white, yellow, and cyan with stronger borders.', checked: settings.highContrast, toggle: settings.toggleHighContrast, icon: Eye },
    { id: 'big-mode', label: 'Big Mode', description: 'Increase text and controls for field use.', checked: settings.bigMode, toggle: settings.toggleBigMode, icon: Type },
    { id: 'reduced-motion', label: 'Reduced motion', description: 'Disable non-essential animation and smooth scrolling.', checked: settings.reducedMotion, toggle: settings.toggleReducedMotion, icon: Move },
    { id: 'haptics', label: 'Haptic DNC alerts', description: 'Vibrate on supported devices when a DNC warning is nearby.', checked: settings.haptics, toggle: settings.toggleHaptics, icon: Smartphone },
    { id: 'voice', label: 'Voice-to-text', description: 'Allow optional on-device dictation. Audio is never uploaded or stored.', checked: settings.voiceEnabled, toggle: settings.toggleVoice, icon: Volume2 },
  ];

  return (
    <Card>
      <CardHeader><CardTitle>Accessibility & field comfort</CardTitle><CardDescription>Preferences stay on this device and can be changed at any time.</CardDescription></CardHeader>
      <CardContent className="divide-y">
        {rows.map(({ id, label, description, checked, toggle, icon: Icon }) => (
          <div key={id} className="flex items-center gap-4 py-5">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" /></span>
            <div className="min-w-0 flex-1"><label htmlFor={id} className="font-bold">{label}</label><p id={`${id}-description`} className="text-sm text-muted-foreground">{description}</p></div>
            <Switch id={id} aria-describedby={`${id}-description`} checked={checked} onCheckedChange={toggle} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
