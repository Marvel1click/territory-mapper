'use client';

import { useAuth } from '@/app/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2, Lock } from 'lucide-react';
import type { UserRole } from '@/app/types';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
}

export function RoleGuard({ children, allowedRoles, fallback }: RoleGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!isAuthenticated) {
        router.replace('/login');
      } else if (user) {
        const hasPermission = allowedRoles.includes(user.role);
        if (!hasPermission && !fallback) {
          // Redirect to appropriate dashboard based on role
          const redirectPath = user.role === 'publisher' ? '/publisher' : '/overseer';
          router.replace(redirectPath);
        }
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, router, fallback]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock className="w-12 h-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Please sign in to access this page</p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const hasPermission = allowedRoles.includes(user.role);

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
        <p className="text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

// Hook for checking permissions
export function usePermission(allowedRoles: UserRole[]) {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return { hasPermission: false, isLoading: true };
  if (!user) return { hasPermission: false, isLoading: false };
  
  return {
    hasPermission: allowedRoles.includes(user.role),
    isLoading: false,
  };
}
