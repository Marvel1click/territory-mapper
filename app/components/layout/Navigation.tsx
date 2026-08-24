'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ClipboardCheck,
  LayoutDashboard,
  Map,
  MapPinned,
  RotateCcw,
  Settings,
  Users,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/app/hooks/useAuth';
import { cn } from '@/app/lib/utils';

const managerLinks = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/dashboard/territories', label: 'Territories', icon: Map },
  { href: '/dashboard/assignments', label: 'Assignments', icon: ClipboardCheck },
  { href: '/dashboard/members', label: 'Members', icon: Users },
  { href: '/dashboard/reports', label: 'Reports', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

const publisherLinks = [
  { href: '/field', label: 'My territories', shortLabel: 'Field', icon: MapPinned },
  { href: '/field/return-visits', label: 'Return visits', shortLabel: 'Returns', icon: RotateCcw },
  { href: '/field/settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
];

type NavigationLink = {
  href: string;
  label: string;
  shortLabel?: string;
  icon: typeof LayoutDashboard;
};

export function Navigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  const links: NavigationLink[] = user?.role === 'publisher' ? publisherLinks : managerLinks;

  const activeFor = (href: string) =>
    pathname === href || href !== '/dashboard' && href !== '/field' && pathname.startsWith(`${href}/`);

  return (
    <>
      <aside className="sticky top-18 hidden h-[calc(100dvh-4.5rem)] w-64 shrink-0 border-r px-4 py-6 md:block">
        <nav aria-label="Workspace navigation" className="space-y-1.5">
          {links.map(({ href, label, icon: Icon }) => {
            const active = activeFor(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold transition-colors',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-8 rounded-2xl border bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-bold text-foreground">{user?.congregation?.name ?? 'Your congregation'}</p>
          <p className="mt-1 capitalize">{user?.role} access</p>
        </div>
      </aside>

      <nav
        aria-label="Field navigation"
        className="safe-area-bottom fixed inset-x-0 bottom-0 z-50 grid border-t bg-card/95 px-2 pt-2 backdrop-blur-xl md:hidden"
        style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
      >
        {links.map(({ href, label, shortLabel, icon: Icon }) => {
          const active = activeFor(href);
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-bold',
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              <Icon aria-hidden="true" className="size-5" />
              <span className="max-w-full truncate">{shortLabel ?? label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
