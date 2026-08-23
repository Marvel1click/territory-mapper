'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LockKeyhole } from 'lucide-react';
import { DashboardErrorBoundary } from '@/app/components/error/ErrorBoundary';
import { Header } from '@/app/components/layout/Header';
import { Navigation } from '@/app/components/layout/Navigation';
import { useAuth } from '@/app/hooks/useAuth';
import { useAccessibilityStore } from '@/app/lib/store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { highContrast, bigMode, reducedMotion } = useAccessibilityStore();

  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    document.documentElement.classList.toggle('big-mode', bigMode);
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
  }, [bigMode, highContrast, reducedMotion]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 aria-hidden="true" className="animate-spin text-primary" /> Loading workspace…
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="grid min-h-dvh place-items-center text-center">
        <div>
          <LockKeyhole aria-hidden="true" className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h1 className="text-2xl">Sign-in required</h1>
          <p className="mt-2 text-muted-foreground">Opening the sign-in page…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <Header />
      <div className="mx-auto flex max-w-[1600px]">
        <Navigation />
        <main id="main-content" className="min-w-0 flex-1 px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8 md:pb-8">
          <DashboardErrorBoundary>{children}</DashboardErrorBoundary>
        </main>
      </div>
    </div>
  );
}
