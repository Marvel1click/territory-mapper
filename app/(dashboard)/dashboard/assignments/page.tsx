'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, ClipboardCheck, Loader2, RotateCcw, UserRound } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/app/components/shared/AsyncState';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { TerritoryStatusBadge } from '@/app/components/shared/StatusBadge';
import { QRCodeGenerator } from '@/app/components/territory/QRCodeGenerator';
import { apiFetch, formatClientError } from '@/app/lib/api/client';
import type { Assignment, Membership, Territory } from '@/app/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface MemberRow extends Membership {
  profiles?: { id: string; email: string; full_name: string; phone?: string | null } | null;
}

interface AssignmentRow extends Assignment {
  territory_name?: string;
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [territoryId, setTerritoryId] = useState('');
  const [publisherId, setPublisherId] = useState('');
  const [dueDate, setDueDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [assignmentData, territoryData, memberData] = await Promise.all([
        apiFetch<{ assignments: AssignmentRow[] }>('/api/assignments'),
        apiFetch<{ territories: Territory[] }>('/api/territories'),
        apiFetch<{ members: MemberRow[] }>('/api/members'),
      ]);
      setAssignments(assignmentData.assignments); setTerritories(territoryData.territories); setMembers(memberData.members);
    } catch (loadError) { setError(formatClientError(loadError)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const available = useMemo(() => territories.filter((territory) => territory.status === 'in-stock'), [territories]);
  const publishers = useMemo(() => members.filter((member) => member.status === 'active' && member.role === 'publisher'), [members]);
  const active = assignments.filter((assignment) => assignment.status === 'active');
  const history = assignments.filter((assignment) => assignment.status !== 'active');

  const createAssignment = async () => {
    setBusyId('create'); setError(null);
    try {
      await apiFetch('/api/assignments', { method: 'POST', body: JSON.stringify({ territoryId, publisherId, dueDate: dueDate ? new Date(`${dueDate}T23:59:59`).toISOString() : null, mutationId: crypto.randomUUID() }) });
      setOpen(false); setTerritoryId(''); setPublisherId(''); setDueDate(''); await load();
    } catch (createError) { setError(formatClientError(createError)); }
    finally { setBusyId(null); }
  };

  const returnAssignment = async (id: string) => {
    setBusyId(id); setError(null);
    try { await apiFetch(`/api/assignments/${id}`, { method: 'PUT', body: JSON.stringify({ mutationId: crypto.randomUUID() }) }); await load(); }
    catch (returnError) { setError(formatClientError(returnError)); }
    finally { setBusyId(null); }
  };

  if (loading) return <LoadingState label="Loading assignments…" />;
  if (error && assignments.length === 0 && territories.length === 0) return <ErrorState message={error} retry={() => void load()} />;

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Assignment desk" title="Keep checkout simple and accountable." description="Direct assignments and one-time QR links use the same database-enforced checkout transaction." actions={<Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={available.length === 0}><ClipboardCheck aria-hidden="true" /> Assign territory</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Create an assignment</DialogTitle><DialogDescription>Only one active assignment can exist for a territory.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label htmlFor="assignment-territory">Territory</Label><Select value={territoryId} onValueChange={setTerritoryId}><SelectTrigger id="assignment-territory"><SelectValue placeholder="Choose an available territory" /></SelectTrigger><SelectContent>{available.map((territory) => <SelectItem key={territory.id} value={territory.id}>{territory.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="assignment-publisher">Publisher</Label><Select value={publisherId} onValueChange={setPublisherId}><SelectTrigger id="assignment-publisher"><SelectValue placeholder="Choose an active publisher" /></SelectTrigger><SelectContent>{publishers.map((member) => <SelectItem key={member.user_id} value={member.user_id}>{member.profiles?.full_name || member.profiles?.email || member.user_id}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="due-date">Due date (optional)</Label><Input id="due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></div></div>{error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}<DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={!territoryId || !publisherId || busyId === 'create'} onClick={() => void createAssignment()}>{busyId === 'create' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />} Check out</Button></DialogFooter></DialogContent></Dialog>} />
      {error && !open ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-semibold text-destructive">{error}</p> : null}

      <section aria-labelledby="secure-links-heading"><div className="mb-3"><h2 id="secure-links-heading" className="text-xl font-bold">One-time field checkout</h2><p className="text-sm text-muted-foreground">Generate an expiring QR for any available territory.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{available.slice(0, 6).map((territory) => <Card key={territory.id}><CardContent className="flex items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="truncate font-bold">{territory.name}</p><TerritoryStatusBadge status={territory.status} /></div><QRCodeGenerator territoryId={territory.id} territoryName={territory.name} /></CardContent></Card>)}{available.length === 0 ? <p className="text-sm text-muted-foreground">No territories are currently available for QR checkout.</p> : null}</div></section>

      <Tabs defaultValue="active"><TabsList><TabsTrigger value="active">Active ({active.length})</TabsTrigger><TabsTrigger value="history">History ({history.length})</TabsTrigger></TabsList><TabsContent value="active">{active.length === 0 ? <EmptyState title="No active assignments" description="Assign an available territory directly or issue a secure QR checkout link." icon={ClipboardCheck} /> : <div className="grid gap-4 lg:grid-cols-2">{active.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} busy={busyId === assignment.id} onReturn={() => void returnAssignment(assignment.id)} />)}</div>}</TabsContent><TabsContent value="history">{history.length === 0 ? <EmptyState title="No returned assignments" description="Completed assignment history will remain here for reporting." icon={RotateCcw} /> : <div className="grid gap-4 lg:grid-cols-2">{history.map((assignment) => <AssignmentCard key={assignment.id} assignment={assignment} />)}</div>}</TabsContent></Tabs>
    </div>
  );
}

function AssignmentCard({ assignment, busy, onReturn }: { assignment: AssignmentRow; busy?: boolean; onReturn?: () => void }) {
  return <Card><CardHeader><div className="flex justify-between gap-3"><div><CardTitle>{assignment.territory_name ?? assignment.territoryName ?? 'Territory'}</CardTitle><CardDescription className="mt-1 flex items-center gap-1"><UserRound aria-hidden="true" className="size-4" />{assignment.publisher_name}</CardDescription></div><Badge variant={assignment.status === 'active' ? 'default' : 'secondary'}>{assignment.status === 'active' ? <ClipboardCheck aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}{assignment.status}</Badge></div></CardHeader><CardContent><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted-foreground">Checked out</p><p className="font-semibold">{new Date(assignment.checked_out_at).toLocaleDateString()}</p></div><div><p className="text-muted-foreground">Due</p><p className="font-semibold">{assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}</p></div></div>{onReturn ? <Button variant="outline" className="mt-5 w-full" disabled={busy} onClick={onReturn}>{busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <CalendarClock aria-hidden="true" />} Return territory</Button> : null}</CardContent></Card>;
}
