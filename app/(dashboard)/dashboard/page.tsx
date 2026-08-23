'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ClipboardCheck,
  History,
  Map,
  MapPinned,
  RotateCcw,
  UserPlus,
  Users,
} from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/app/components/shared/AsyncState';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { apiFetch, formatClientError } from '@/app/lib/api/client';
import { useAuth } from '@/app/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardResponse {
  summary: {
    territories: number;
    available: number;
    activeAssignments: number;
    activeMembers: number;
    returnVisits: number;
    visits: number;
  };
  activity: Array<{
    id: string;
    action: string;
    entity_type: string;
    entity_id: string;
    created_at: string;
  }>;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<DashboardResponse>('/api/dashboard'));
    } catch (loadError) {
      setError(formatClientError(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingState label="Loading congregation summary…" />;
  if (error || !data) return <ErrorState message={error ?? 'Summary unavailable.'} retry={() => void load()} />;

  const firstName = user?.full_name?.split(' ')[0] || 'Overseer';
  const stats = [
    { label: 'Territories', value: data.summary.territories, note: `${data.summary.available} available`, icon: Map },
    { label: 'Active assignments', value: data.summary.activeAssignments, note: 'Currently checked out', icon: ClipboardCheck },
    { label: 'Active members', value: data.summary.activeMembers, note: 'Current access', icon: Users },
    { label: 'Visits recorded', value: data.summary.visits, note: `${data.summary.returnVisits} follow-ups`, icon: RotateCcw },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Congregation overview"
        title={`Good to see you, ${firstName}.`}
        description="Live territory availability, assignments, people, and ministry activity—all from the congregation database."
        actions={
          <>
            <Button variant="outline" asChild><Link href="/dashboard/members"><UserPlus aria-hidden="true" /> Invite member</Link></Button>
            <Button asChild><Link href="/dashboard/territories/new"><MapPinned aria-hidden="true" /> New territory</Link></Button>
          </>
        }
      />

      <section aria-label="Current summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, note, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground">{label}</p>
                  <p className="mt-2 text-4xl font-bold tabular-nums">{value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{note}</p>
                </div>
                <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><Icon aria-hidden="true" /></span>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div><CardTitle>Recent audit activity</CardTitle><CardDescription>Append-only changes made in this congregation.</CardDescription></div>
            <Badge variant="outline"><History aria-hidden="true" /> Live</Badge>
          </CardHeader>
          <CardContent>
            {data.activity.length === 0 ? (
              <EmptyState title="No activity yet" description="Changes to territories, houses, assignments, and visits will appear here." />
            ) : (
              <ol className="divide-y" aria-label="Recent activity">
                {data.activity.map((item) => (
                  <li key={item.id} className="flex items-center gap-4 py-4">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><History aria-hidden="true" className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold capitalize">{item.action.replaceAll('_', ' ')} {item.entity_type.replaceAll('_', ' ')}</p>
                      <p className="truncate text-sm text-muted-foreground">Reference {item.entity_id}</p>
                    </div>
                    <time className="text-sm text-muted-foreground" dateTime={item.created_at}>{new Date(item.created_at).toLocaleDateString()}</time>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Next actions</CardTitle><CardDescription>Keep field work moving.</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {[
              { href: '/dashboard/territories', label: 'Review territory stock', icon: Map },
              { href: '/dashboard/assignments', label: 'Manage assignments', icon: ClipboardCheck },
              { href: '/dashboard/reports', label: 'Export field records', icon: RotateCcw },
            ].map(({ href, label, icon: Icon }) => (
              <Button key={href} variant="outline" className="h-auto w-full justify-start py-4" asChild>
                <Link href={href}><Icon aria-hidden="true" className="text-primary" /><span className="flex-1 text-left">{label}</span><ArrowRight aria-hidden="true" /></Link>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
