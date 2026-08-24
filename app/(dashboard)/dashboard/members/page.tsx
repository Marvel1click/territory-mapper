'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, CheckCircle2, Copy, Loader2, MailPlus, ShieldCheck, UserRound, Users } from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '@/app/components/shared/AsyncState';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { apiFetch, formatClientError } from '@/app/lib/api/client';
import { useAuth } from '@/app/hooks/useAuth';
import type { Invite, Membership, MembershipStatus, UserRole } from '@/app/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MemberRow extends Membership {
  profiles?: { id: string; email: string; full_name: string; phone?: string | null } | null;
}

export default function MembersPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('publisher');
  const [manualUrl, setManualUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const memberData = await apiFetch<{ members: MemberRow[] }>('/api/members');
      setMembers(memberData.members);
      if (isAdmin) {
        const inviteData = await apiFetch<{ invites: Invite[] }>('/api/invites');
        setInvites(inviteData.invites);
      }
    } catch (loadError) { setError(formatClientError(loadError)); }
    finally { setLoading(false); }
  }, [isAdmin]);
  useEffect(() => { if (user) void load(); }, [load, user]);

  const invite = async () => {
    setBusyId('invite'); setError(null); setManualUrl(null);
    try {
      const response = await apiFetch<{ acceptUrl: string; delivery: string }>('/api/invites', { method: 'POST', body: JSON.stringify({ email, role }) });
      if (response.delivery === 'manual') setManualUrl(response.acceptUrl);
      else { setOpen(false); setEmail(''); }
      await load();
    } catch (inviteError) { setError(formatClientError(inviteError)); }
    finally { setBusyId(null); }
  };

  const updateMember = async (member: MemberRow, changes: { role?: UserRole; status?: MembershipStatus }) => {
    setBusyId(member.id); setError(null);
    try { await apiFetch('/api/members', { method: 'PATCH', body: JSON.stringify({ userId: member.user_id, ...changes }) }); await load(); }
    catch (updateError) { setError(formatClientError(updateError)); }
    finally { setBusyId(null); }
  };

  const revokeInvite = async (id: string) => {
    setBusyId(id); setError(null);
    try { await apiFetch(`/api/invites/${id}`, { method: 'DELETE' }); await load(); }
    catch (revokeError) { setError(formatClientError(revokeError)); }
    finally { setBusyId(null); }
  };

  if (loading) return <LoadingState label="Loading congregation members…" />;
  if (error && members.length === 0) return <ErrorState message={error} retry={() => void load()} />;
  const activeInvites = invites.filter((inviteItem) => !inviteItem.accepted_at && !inviteItem.revoked_at && new Date(inviteItem.expires_at) > new Date());

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Access administration" title="Membership is invite-only and server-authoritative." description={isAdmin ? 'Invite people, assign least-privilege roles, and suspend access without altering identity metadata.' : 'Review active congregation membership. Only admins can change roles or access.'} actions={isAdmin ? <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setManualUrl(null); }}><DialogTrigger asChild><Button><MailPlus aria-hidden="true" /> Invite member</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Invite a congregation member</DialogTitle><DialogDescription>The one-time token expires after seven days and can be revoked.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label htmlFor="invite-email">Email</Label><Input id="invite-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div><div><Label htmlFor="invite-role">Role</Label><Select value={role} onValueChange={(value) => setRole(value as UserRole)}><SelectTrigger id="invite-role"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="publisher">Publisher</SelectItem><SelectItem value="overseer">Overseer</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select></div>{manualUrl ? <div className="rounded-xl border bg-muted p-3"><p className="text-sm font-semibold">Email delivery needs manual sharing.</p><Button variant="outline" size="sm" className="mt-2" onClick={() => void navigator.clipboard.writeText(manualUrl)}><Copy aria-hidden="true" /> Copy private invite link</Button></div> : null}{error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}</div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Close</Button><Button disabled={busyId === 'invite' || !email} onClick={() => void invite()}>{busyId === 'invite' ? <Loader2 aria-hidden="true" className="animate-spin" /> : <MailPlus aria-hidden="true" />} Send invitation</Button></DialogFooter></DialogContent></Dialog> : undefined} />
      {error && !open ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-semibold text-destructive">{error}</p> : null}

      <Card><CardHeader><CardTitle>Current members</CardTitle><CardDescription>{members.filter((member) => member.status === 'active').length} active member{members.filter((member) => member.status === 'active').length === 1 ? '' : 's'}</CardDescription></CardHeader><CardContent>{members.length === 0 ? <EmptyState title="No members found" description="An admin can send the first invitation." icon={Users} /> : <ul className="divide-y">{members.map((member) => <li key={member.id} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_180px_180px]"><div className="flex min-w-0 items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><UserRound aria-hidden="true" /></span><div className="min-w-0"><p className="truncate font-bold">{member.profiles?.full_name || member.profiles?.email || 'Member'}</p><p className="truncate text-sm text-muted-foreground">{member.profiles?.email}</p></div>{member.role === 'admin' ? <Badge variant="outline"><ShieldCheck aria-hidden="true" /> Admin</Badge> : null}</div>{isAdmin ? <Select disabled={busyId === member.id} value={member.role} onValueChange={(value) => void updateMember(member, { role: value as UserRole })}><SelectTrigger aria-label={`Role for ${member.profiles?.full_name || member.profiles?.email}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="publisher">Publisher</SelectItem><SelectItem value="overseer">Overseer</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select> : <Badge variant="secondary" className="w-fit capitalize">{member.role}</Badge>}{isAdmin ? <Select disabled={busyId === member.id} value={member.status} onValueChange={(value) => void updateMember(member, { status: value as MembershipStatus })}><SelectTrigger aria-label={`Access status for ${member.profiles?.full_name || member.profiles?.email}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="suspended">Suspended</SelectItem><SelectItem value="removed">Removed</SelectItem></SelectContent></Select> : <Badge variant={member.status === 'active' ? 'default' : 'destructive'} className="w-fit">{member.status === 'active' ? <CheckCircle2 aria-hidden="true" /> : <Ban aria-hidden="true" />}{member.status}</Badge>}</li>)}</ul>}</CardContent></Card>

      {isAdmin ? <Card><CardHeader><CardTitle>Pending invitations</CardTitle><CardDescription>Tokens are hashed at rest and disappear from this list after acceptance, revocation, or expiry.</CardDescription></CardHeader><CardContent>{activeInvites.length === 0 ? <p className="text-sm text-muted-foreground">No active invitations.</p> : <ul className="divide-y">{activeInvites.map((inviteItem) => <li key={inviteItem.id} className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"><div><p className="font-bold">{inviteItem.email}</p><p className="text-sm text-muted-foreground">{inviteItem.role} · expires {new Date(inviteItem.expires_at).toLocaleString()}</p></div><Button variant="outline" disabled={busyId === inviteItem.id} onClick={() => void revokeInvite(inviteItem.id)}>{busyId === inviteItem.id ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Ban aria-hidden="true" />} Revoke</Button></li>)}</ul>}</CardContent></Card> : null}
    </div>
  );
}
