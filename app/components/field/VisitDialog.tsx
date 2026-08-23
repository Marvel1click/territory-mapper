'use client';

import { useRef, useState } from 'react';
import { Loader2, Mic, MicOff, Save } from 'lucide-react';
import type { House, VisitOutcome } from '@/app/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAccessibility } from '@/app/hooks/useAccessibility';

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

export function VisitDialog({ house, open, onOpenChange, onSave }: { house: House | null; open: boolean; onOpenChange: (open: boolean) => void; onSave: (input: { outcome: VisitOutcome; notes: string | null; followUpAt: string | null }) => Promise<void> }) {
  const { voiceEnabled } = useAccessibility();
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const [outcome, setOutcome] = useState<VisitOutcome>('not-home');
  const [notes, setNotes] = useState('');
  const [followUp, setFollowUp] = useState('');
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startDictation = () => {
    const Speech = (window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: RecognitionConstructor }).webkitSpeechRecognition;
    if (!Speech) { setError('Voice-to-text is not supported here. Type the note manually.'); return; }
    const instance = new Speech();
    instance.lang = 'en-GB'; instance.continuous = false; instance.interimResults = false;
    instance.onresult = (event) => { const transcript = Array.from(event.results).map((result) => result[0].transcript).join(' '); setNotes((current) => `${current}${current ? ' ' : ''}${transcript}`); };
    instance.onend = () => setListening(false);
    instance.onerror = () => { setListening(false); setError('Dictation stopped. You can continue typing manually.'); };
    recognition.current = instance; setListening(true); setError(null); instance.start();
  };

  const stopDictation = () => { recognition.current?.stop(); setListening(false); };
  const save = async () => {
    setBusy(true); setError(null);
    try { await onSave({ outcome, notes: notes.trim() || null, followUpAt: followUp ? new Date(followUp).toISOString() : null }); onOpenChange(false); setNotes(''); setFollowUp(''); setOutcome('not-home'); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Visit could not be saved.'); }
    finally { setBusy(false); }
  };

  return <Dialog open={open} onOpenChange={(next) => { if (!next) stopDictation(); onOpenChange(next); }}><DialogContent><DialogHeader><DialogTitle>Record visit</DialogTitle><DialogDescription>{house?.address}. The outcome becomes append-only visit history.</DialogDescription></DialogHeader><div className="space-y-4"><div><Label htmlFor="visit-outcome">Outcome</Label><Select value={outcome} onValueChange={(value) => setOutcome(value as VisitOutcome)}><SelectTrigger id="visit-outcome"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="not-home">Not at home</SelectItem><SelectItem value="contacted">Contacted</SelectItem><SelectItem value="interested">Interest shown</SelectItem><SelectItem value="return-visit">Return visit</SelectItem><SelectItem value="do-not-call">Do not call</SelectItem></SelectContent></Select></div>{outcome === 'return-visit' ? <div><Label htmlFor="follow-up">Follow-up date and time</Label><Input id="follow-up" type="datetime-local" value={followUp} onChange={(event) => setFollowUp(event.target.value)} /></div> : null}<div><div className="mb-1 flex items-center justify-between gap-3"><Label htmlFor="visit-notes">Notes or transcript</Label>{voiceEnabled ? <Button type="button" size="sm" variant="outline" aria-pressed={listening} onClick={listening ? stopDictation : startDictation}>{listening ? <MicOff aria-hidden="true" /> : <Mic aria-hidden="true" />} {listening ? 'Stop' : 'Dictate'}</Button> : null}</div><Textarea id="visit-notes" value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} placeholder="Type notes here. Audio is never stored." /></div>{outcome === 'do-not-call' ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm"><strong>Privacy action:</strong> the exact address and note will be encrypted server-side and removed from publisher offline storage after save.</p> : null}{error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={busy || outcome === 'return-visit' && !followUp} onClick={() => void save()}>{busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Save aria-hidden="true" />} Save visit</Button></DialogFooter></DialogContent></Dialog>;
}
