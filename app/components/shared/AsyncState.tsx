import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function LoadingState({ label = 'Loading current data…' }: { label?: string }) {
  return (
    <Card role="status">
      <CardContent className="flex min-h-48 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 aria-hidden="true" className="animate-spin text-primary" />
        {label}
      </CardContent>
    </Card>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <Card role="alert" className="border-destructive/35">
      <CardContent className="flex min-h-48 flex-col items-center justify-center text-center">
        <AlertTriangle aria-hidden="true" className="mb-3 size-9 text-destructive" />
        <p className="max-w-xl font-semibold">{message}</p>
        {retry ? (
          <Button variant="outline" className="mt-4" onClick={retry}>
            <RefreshCw aria-hidden="true" /> Try again
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
  action,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Icon aria-hidden="true" className="size-7" />
        </span>
        <h2 className="text-xl font-bold">{title}</h2>
        <p className="mt-2 max-w-md text-muted-foreground">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
