'use client';

import { useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generateId } from '@/app/lib/utils';
import { useAccessibility } from '@/app/hooks/useAccessibility';
import { cn } from '@/app/lib/utils';
import { logger } from '@/app/lib/utils/logger';
import { Download, Share2, X, Copy, Check } from 'lucide-react';

interface QRCodeGeneratorProps {
  territoryId: string;
  territoryName: string;
  className?: string;
}

export function QRCodeGenerator({ territoryId, territoryName, className }: QRCodeGeneratorProps) {
  const { triggerHaptic, hapticPatterns } = useAccessibility();
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState('');

  // Generate checkout URL
  const generateCheckoutUrl = useCallback(() => {
    const token = generateId();
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/checkout?t=${territoryId}&token=${token}`;
  }, [territoryId]);

  // Open modal and generate URL
  const handleOpen = () => {
    const url = generateCheckoutUrl();
    setCheckoutUrl(url);
    setShowModal(true);
    triggerHaptic(hapticPatterns.medium);
  };

  // Close modal
  const handleClose = () => {
    setShowModal(false);
    setCopied(false);
  };

  // Copy URL to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(checkoutUrl);
      setCopied(true);
      triggerHaptic(hapticPatterns.success);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      logger.error('Failed to copy:', err);
    }
  };

  // Download QR code as PNG
  const handleDownload = () => {
    const svg = document.getElementById('territory-qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `territory-${territoryId}-qr.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
      
      triggerHaptic(hapticPatterns.success);
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  // Share functionality
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Territory: ${territoryName}`,
          text: `Check out this territory: ${territoryName}`,
          url: checkoutUrl,
        });
        triggerHaptic(hapticPatterns.success);
      } catch {
        // User cancelled or share failed - silently ignore
      }
    } else {
      handleCopy();
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-primary/10 text-primary hover:bg-primary/20 transition-colors',
          className
        )}
      >
        <Share2 className="w-4 h-4" />
        <span className="text-sm font-medium">Share QR</span>
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card rounded-2xl border border-border shadow-xl max-w-md w-full p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold">Share Territory</h3>
                <p className="text-sm text-muted-foreground">{territoryName}</p>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white rounded-xl">
                <QRCodeSVG
                  id="territory-qr-code"
                  value={checkoutUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                  imageSettings={{
                    src: '/icons/icon-192x192.svg',
                    height: 40,
                    width: 40,
                    excavate: true,
                  }}
                />
              </div>
            </div>

            {/* URL Display */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Checkout Link</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={checkoutUrl}
                  readOnly
                  className="flex-1 px-3 py-2 text-sm bg-muted rounded-lg border border-input"
                />
                <button
                  onClick={handleCopy}
                  className={cn(
                    'px-3 py-2 rounded-lg transition-colors',
                    copied
                      ? 'bg-green-500/10 text-green-500'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={handleDownload}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-muted hover:bg-accent transition-colors font-medium"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>

            {/* Instructions */}
            <p className="mt-4 text-xs text-muted-foreground text-center">
              Publishers can scan this QR code to check out the territory to their device.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
