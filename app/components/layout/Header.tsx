'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LogOut, UserRound } from 'lucide-react';
import { useAuth } from '@/app/hooks/useAuth';
import { SyncStatus } from '@/app/components/layout/SyncStatus';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export function Header() {
  const { user, signOut } = useAuth();
  const initials = (user?.full_name || user?.email || 'TM')
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href={user?.role === 'publisher' ? '/field' : '/dashboard'} className="flex min-w-0 items-center gap-3 rounded-xl">
          <Image src="/icons/icon-192x192.png" alt="" width={40} height={40} priority />
          <div className="min-w-0">
            <p className="truncate font-bold leading-tight">Territory Mapper</p>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              {user?.congregation?.name ?? 'Congregation workspace'}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <SyncStatus />
          <div className="hidden items-center gap-2 rounded-xl border bg-card px-2.5 py-1.5 lg:flex">
            <Avatar className="size-8">
              <AvatarFallback>{initials || <UserRound aria-hidden="true" />}</AvatarFallback>
            </Avatar>
            <div className="max-w-44 leading-tight">
              <p className="truncate text-sm font-bold">{user?.full_name || user?.email}</p>
              <p className="truncate text-xs capitalize text-muted-foreground">{user?.role}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void signOut()}>
            <LogOut aria-hidden="true" />
          </Button>
        </div>
      </div>
    </header>
  );
}
