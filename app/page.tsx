import Image from 'next/image';
import Link from 'next/link';
import {
  Accessibility,
  ArrowRight,
  CheckCircle2,
  CloudOff,
  MapPinned,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const capabilities = [
  {
    icon: CloudOff,
    title: 'Ready between connections',
    description: 'Downloaded assignments and queued visits stay available in field mode.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacy by role',
    description: 'Congregations stay isolated and DNC details remain restricted.',
  },
  {
    icon: Accessibility,
    title: 'Built to be readable',
    description: 'Keyboard support, strong contrast, clear labels, and an optional Big Mode.',
  },
];

export default function HomePage() {
  return (
    <div className="min-h-dvh">
      <header className="border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 rounded-xl font-bold">
            <Image src="/icons/icon-192x192.png" alt="" width={42} height={42} priority />
            <span className="text-xl">Territory Mapper</span>
          </Link>
          <Button asChild variant="outline">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </header>

      <main id="main-content">
        <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:py-24">
          <div>
            <Badge variant="secondary" className="mb-5 gap-2 px-3 py-1.5">
              <CheckCircle2 aria-hidden="true" className="size-4 text-primary" />
              Invite-only congregation workspace
            </Badge>
            <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Calm territory work, from planning to the doorstep.
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Draw, assign, download, and work territories with a field-first map that protects
              sensitive details and recovers cleanly when connectivity returns.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-h-12 gap-2 px-6">
                <Link href="/login">
                  Open your workspace <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="min-h-12">
                <Link href="/register">How invitations work</Link>
              </Button>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Existing accounts keep their current password. New access starts with an administrator invitation.
            </p>
          </div>

          <Card className="surface-calm overflow-hidden border-primary/15 p-2">
            <CardHeader className="flex-row items-center justify-between gap-4 pb-2">
              <div>
                <p className="text-sm font-semibold text-muted-foreground">Saturday field plan</p>
                <CardTitle className="mt-1 text-2xl">North congregation</CardTitle>
              </div>
              <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground">
                <MapPinned aria-hidden="true" />
              </span>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <TerritoryPreview name="Oak Road" detail="46 homes" status="Available" tone="available" />
              <TerritoryPreview name="Station Quarter" detail="Assigned to Alex" status="In field" tone="assigned" />
              <TerritoryPreview name="Riverside" detail="Boundary review" status="Needs review" tone="pending" />
              <div className="mt-4 rounded-2xl border bg-muted/55 p-4 text-sm text-muted-foreground">
                Every status pairs color with a label and icon, so the map remains understandable
                in high contrast and without color perception.
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="border-y bg-card/65">
          <div className="mx-auto grid max-w-7xl gap-5 px-4 py-14 sm:px-6 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="bg-background/75">
                <CardHeader>
                  <span className="mb-2 grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon aria-hidden="true" />
                  </span>
                  <CardTitle>{title}</CardTitle>
                </CardHeader>
                <CardContent className="text-muted-foreground">{description}</CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-8 text-sm text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">
        <p>Territory Mapper · Privacy-respecting field work</p>
        <p>No public registration · No behavioral analytics</p>
      </footer>
    </div>
  );
}

function TerritoryPreview({
  name,
  detail,
  status,
  tone,
}: {
  name: string;
  detail: string;
  status: string;
  tone: 'available' | 'assigned' | 'pending';
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
      <span className={`grid size-10 shrink-0 place-items-center rounded-full bg-muted status-${tone}`}>
        <MapPinned aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{name}</p>
        <p className="truncate text-sm text-muted-foreground">{detail}</p>
      </div>
      <Badge variant="outline" className={`status-${tone}`}>{status}</Badge>
    </div>
  );
}
