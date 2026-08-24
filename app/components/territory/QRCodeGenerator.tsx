'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Download, Loader2, QrCode, Share2 } from 'lucide-react';
import { apiFetch, formatClientError } from '@/app/lib/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SecureCheckoutLink {
  id: string;
  url: string;
  territoryName: string;
  expires_at: string;
}

export function QRCodeGenerator({ territoryId, territoryName }: { territoryId: string; territoryName: string }) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState('24');
  const [link, setLink] = useState<SecureCheckoutLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLink = async () => {
    setBusy(true); setError(null);
    try {
      const response = await apiFetch<{ checkoutLink: SecureCheckoutLink }>('/api/checkout-links', { method: 'POST', body: JSON.stringify({ territoryId, expiresInHours: Number(hours) }) });
      setLink(response.checkoutLink);
    } catch (createError) { setError(formatClientError(createError)); }
    finally { setBusy(false); }
  };

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  };

  const download = () => {
    const svg = document.getElementById(`checkout-qr-${territoryId}`);
    if (!svg) return;
    const image = new Image();
    const canvas = document.createElement('canvas');
    image.onload = () => {
      canvas.width = 1024; canvas.height = 1024;
      const context = canvas.getContext('2d');
      if (!context) return;
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, 1024, 1024); context.drawImage(image, 0, 0, 1024, 1024);
      const anchor = document.createElement('a'); anchor.href = canvas.toDataURL('image/png'); anchor.download = `${territoryName.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}-checkout.png`; anchor.click();
    };
    image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(new XMLSerializer().serializeToString(svg))))}`;
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) { setLink(null); setError(null); } }}>
      <DialogTrigger asChild><Button variant="outline" size="sm"><QrCode aria-hidden="true" /> Secure QR</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Checkout {territoryName}</DialogTitle><DialogDescription>Create a one-time, revocable link. Legacy unverified QR parameters are not accepted.</DialogDescription></DialogHeader>
        {!link ? <div className="space-y-4"><div><Label htmlFor={`expiry-${territoryId}`}>Link lifetime</Label><Select value={hours} onValueChange={setHours}><SelectTrigger id={`expiry-${territoryId}`}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 hour</SelectItem><SelectItem value="8">8 hours</SelectItem><SelectItem value="24">24 hours</SelectItem><SelectItem value="72">3 days</SelectItem><SelectItem value="168">7 days</SelectItem></SelectContent></Select></div>{error ? <p role="alert" className="text-sm font-semibold text-destructive">{error}</p> : null}<Button className="w-full" disabled={busy} onClick={() => void createLink()}>{busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <QrCode aria-hidden="true" />} Generate one-time link</Button></div> : <div className="space-y-4"><div className="mx-auto w-fit rounded-2xl bg-white p-4"><QRCodeSVG id={`checkout-qr-${territoryId}`} value={link.url} size={220} level="H" includeMargin imageSettings={{ src: '/icons/icon-192x192.png', width: 40, height: 40, excavate: true }} /></div><p className="text-center text-sm text-muted-foreground">Expires {new Date(link.expires_at).toLocaleString()}</p><div className="flex gap-2"><Button variant="outline" className="flex-1" onClick={() => void copy()}>{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {copied ? 'Copied' : 'Copy link'}</Button><Button variant="outline" className="flex-1" onClick={download}><Download aria-hidden="true" /> Download</Button></div>{typeof navigator !== 'undefined' && 'share' in navigator ? <Button className="w-full" onClick={() => void navigator.share({ title: `Territory: ${territoryName}`, url: link.url })}><Share2 aria-hidden="true" /> Share securely</Button> : null}</div>}
        <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
