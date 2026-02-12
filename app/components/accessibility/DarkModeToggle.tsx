'use client';

import { useEffect, useState, useSyncExternalStore, useCallback } from 'react';
import { Moon, Sun } from 'lucide-react';
import { cn } from '@/app/lib/utils';

// Subscribe function for useSyncExternalStore
function subscribe(callback: () => void) {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function getServerSnapshot() {
  return false; // Default to light on server
}

function getInitialDarkState(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem('theme');
  if (stored) return stored === 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function DarkModeToggle({ className }: { className?: string }) {
  // Use useSyncExternalStore for system preference
  const systemPrefersDark = useSyncExternalStore(
    subscribe,
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    getServerSnapshot
  );

  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  // Initialize theme after mount to avoid hydration mismatch
  useEffect(() => {
    setIsDark(getInitialDarkState());
    setMounted(true);
  }, []);

  // Apply theme when system preference changes (only if no user preference stored)
  useEffect(() => {
    if (!mounted) return;
    const stored = localStorage.getItem('theme');
    if (!stored) {
      document.documentElement.classList.toggle('dark', systemPrefersDark);
      setIsDark(systemPrefersDark);
    }
  }, [systemPrefersDark, mounted]);

  // Apply initial theme to document
  useEffect(() => {
    if (mounted) {
      document.documentElement.classList.toggle('dark', isDark);
    }
  }, [mounted, isDark]);

  const toggle = useCallback(() => {
    const newValue = !isDark;
    setIsDark(newValue);
    document.documentElement.classList.toggle('dark', newValue);
    localStorage.setItem('theme', newValue ? 'dark' : 'light');
  }, [isDark]);

  if (!mounted) {
    return (
      <button
        className={cn(
          'p-2 rounded-lg bg-muted text-muted-foreground transition-colors',
          className
        )}
        aria-label="Toggle dark mode"
      >
        <Sun className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        'p-2 rounded-lg transition-colors',
        isDark 
          ? 'bg-primary/10 text-primary' 
          : 'bg-muted text-muted-foreground hover:bg-accent',
        className
      )}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
    </button>
  );
}

// Hook for dark mode
export function useDarkMode() {
  const [isDark, setIsDark] = useState<boolean>(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setIsDark(getInitialDarkState());
    setMounted(true);
  }, []);

  // Apply theme to document when state changes
  useEffect(() => {
    if (mounted) {
      document.documentElement.classList.toggle('dark', isDark);
    }
  }, [isDark, mounted]);

  const toggle = useCallback(() => {
    const newValue = !isDark;
    setIsDark(newValue);
    localStorage.setItem('theme', newValue ? 'dark' : 'light');
  }, [isDark]);

  const setDark = useCallback((value: boolean) => {
    setIsDark(value);
    localStorage.setItem('theme', value ? 'dark' : 'light');
  }, []);

  return { isDark: mounted ? isDark : false, toggle, setDark, mounted };
}
