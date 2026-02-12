'use client';

import Link from 'next/link';
import { useAuth } from '@/app/hooks/useAuth';
import { useUIStore } from '@/app/lib/store';
import { Menu, MapPin, User, LogOut } from 'lucide-react';
import { cn } from '@/app/lib/utils';
import { SyncStatus } from './SyncStatus';

interface HeaderProps {
  className?: string;
}

export function Header({ className }: HeaderProps) {
  const { user, signOut, isAuthenticated } = useAuth();
  const { toggleSidebar } = useUIStore();

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        className
      )}
      role="banner"
    >
      <div className="w-full max-w-[1920px] mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left section */}
        <div className="flex items-center gap-3 sm:gap-4">
          {isAuthenticated && (
            <button
              onClick={toggleSidebar}
              className="md:hidden p-2.5 rounded-lg hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Toggle menu"
              aria-expanded="false"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
          )}
          
          <Link 
            href="/" 
            className="flex items-center gap-2 sm:gap-3 font-bold text-lg sm:text-xl focus-visible:ring-2 focus-visible:ring-ring rounded-lg px-2 py-1 -ml-2"
          >
            <MapPin className="w-6 h-6 sm:w-7 sm:h-7 text-primary flex-shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Territory Mapper</span>
            <span className="sm:hidden" aria-hidden="true">TM</span>
          </Link>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2 sm:gap-4">
          {isAuthenticated ? (
            <>
              <SyncStatus />
              
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 rounded-lg">
                <User className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span className="truncate max-w-[150px] lg:max-w-[200px]">{user?.full_name || user?.email}</span>
              </div>
              
              <button
                onClick={signOut}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors focus-visible:ring-2 focus-visible:ring-ring min-h-[40px]"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:ring-2 focus-visible:ring-ring min-h-[40px]"
            >
              <User className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span>Sign In</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
