'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/hooks/useAuth';
import { Header } from '@/app/components/layout/Header';
import { Navigation } from '@/app/components/layout/Navigation';
import { DashboardErrorBoundary } from '@/app/components/error/ErrorBoundary';
import { useAccessibilityStore } from '@/app/lib/store';
import { Loader2, Lock } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const { highContrast, bigMode } = useAccessibilityStore();

  // Apply accessibility classes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('high-contrast', highContrast);
      document.documentElement.classList.toggle('big-mode', bigMode);
    }
  }, [highContrast, bigMode]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show access denied message while redirecting
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <Lock className="w-16 h-16 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Access Required</h1>
          <p className="text-muted-foreground">Please sign in to access this page</p>
          <p className="text-sm text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <div className="flex flex-1 overflow-hidden relative">
        <Navigation />
        
        <main
          className="
            flex-1 overflow-y-auto overflow-x-hidden
            transition-all duration-200 ease-in-out
            md:ml-64
            w-full
            min-h-0
          "
          role="main"
          aria-label="Dashboard content"
        >
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
            <DashboardErrorBoundary>
              {children}
            </DashboardErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
