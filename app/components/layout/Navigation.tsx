'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/app/hooks/useAuth';
import { useUIStore } from '@/app/lib/store';
import { cn } from '@/app/lib/utils';
import {
  LayoutDashboard,
  Map,
  Users,
  Settings,
  X,
  Sparkles,
} from 'lucide-react';

const overseerLinks = [
  { href: '/overseer', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/overseer/territories', label: 'Territories', icon: Map },
  { href: '/overseer/assignments', label: 'Assignments', icon: Users },
  { href: '/overseer/getting-started', label: 'Getting Started', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const publisherLinks = [
  { href: '/publisher', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/publisher/territory', label: 'My Territory', icon: Map },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Navigation() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  if (!isAuthenticated) return null;

  const links = user?.role === 'overseer' || user?.role === 'admin' 
    ? overseerLinks 
    : publisherLinks;

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden transition-opacity duration-200"
          onClick={toggleSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-14 sm:top-16 z-40 h-[calc(100vh-3.5rem)] sm:h-[calc(100vh-4rem)] w-64 bg-card border-r border-border',
          'transform transition-transform duration-200 ease-in-out',
          'md:translate-x-0 overflow-hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
        role="navigation"
        aria-label="Main navigation"
      >
        <div className="flex flex-col h-full p-4 sm:p-5 overflow-y-auto scrollbar-thin">
          {/* Close button - mobile only */}
          <button
            onClick={toggleSidebar}
            className="md:hidden absolute top-3 right-3 p-2.5 rounded-lg hover:bg-accent transition-colors focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>

          {/* User info */}
          <div className="mb-6 p-4 bg-accent/50 rounded-xl border border-border/50">
            <p className="font-semibold truncate text-foreground">{user?.full_name || user?.email}</p>
            <p className="text-sm text-muted-foreground capitalize mt-0.5">{user?.role}</p>
          </div>

          {/* Navigation links */}
          <nav className="flex-1 space-y-1.5 overflow-y-auto scrollbar-thin">
            {links.map((link) => {
              const Icon = link.icon;
              // Only do prefix matching for non-dashboard routes to prevent
              // dashboard from highlighting when on sub-pages like /overseer/assignments
              const isDashboardRoot = link.href === '/overseer' || link.href === '/publisher';
              const isActive = pathname === link.href || 
                (!isDashboardRoot && pathname.startsWith(`${link.href}/`));

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => {
                    if (window.innerWidth < 768) toggleSidebar();
                  }}
                  className={cn(
                    'flex items-center gap-3 px-3 sm:px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                    'min-h-[48px] focus-visible:ring-2 focus-visible:ring-ring outline-none',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer info */}
          <div className="mt-auto pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground text-center px-2 py-2">
              Territory Mapper <span className="opacity-75">v1.0</span>
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
