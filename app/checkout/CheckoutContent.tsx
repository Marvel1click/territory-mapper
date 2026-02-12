'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/hooks/useAuth';
import { useTerritories, useHouses, useAssignments, useSync } from '@/app/hooks/useRxDB';
import { useAccessibility } from '@/app/hooks/useAccessibility';
import { generateId } from '@/app/lib/utils';
import { logger } from '@/app/lib/utils/logger';
import type { Territory } from '@/app/types';
import { 
  MapPin, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  QrCode,
  Calendar,
  User,
  ArrowRight,
  Home,
  Clock
} from 'lucide-react';

export function CheckoutContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuth();
  const { triggerHaptic, hapticPatterns } = useAccessibility();
  
  const territoryId = searchParams.get('t');
  const token = searchParams.get('token');
  
  const { territories, isLoading: territoriesLoading } = useTerritories(user?.congregation_id);
  const { houses } = useHouses(territoryId || undefined, user?.congregation_id);
  const { assignments, addAssignment } = useAssignments(user?.congregation_id);
  const { sync } = useSync(user?.congregation_id);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [territory, setTerritory] = useState<Territory | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [publisherName, setPublisherName] = useState(user?.full_name || '');
  const [dueDate, setDueDate] = useState('');

  // Calculate default due date (14 days)
  useEffect(() => {
    const date = new Date();
    date.setDate(date.getDate() + 14);
    setDueDate(date.toISOString().split('T')[0]);
  }, []);

  // Find territory from URL param
  useEffect(() => {
    if (territoriesLoading) return;

    if (!territoryId) {
      setError('Invalid territory link - no territory specified');
      setIsLoading(false);
      return;
    }

    const found = territories.find(t => t.id === territoryId);
    if (!found) {
      setError('Territory not found. It may have been deleted or you may not have access.');
      setIsLoading(false);
      return;
    }

    // Check if territory is already checked out
    const existingAssignment = assignments.find(
      a => a.territory_id === territoryId && a.status === 'active'
    );
    
    if (existingAssignment) {
      setError(`This territory is already checked out by ${existingAssignment.publisher_name}`);
      setIsLoading(false);
      return;
    }

    setTerritory(found);
    setIsLoading(false);
  }, [territoryId, territories, territoriesLoading, assignments]);

  const handleCheckout = async () => {
    if (!isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(window.location.href)}`);
      return;
    }

    if (!territory || !user?.congregation_id) {
      setError('Unable to process checkout. Please try again.');
      return;
    }

    if (!publisherName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsCheckingOut(true);
    setError('');

    try {
      // Create assignment
      const newAssignment = {
        id: generateId(),
        territory_id: territory.id,
        publisher_id: user.id,
        publisher_name: publisherName.trim(),
        congregation_id: user.congregation_id,
        checked_out_at: new Date().toISOString(),
        checked_out_by: user.id,
        due_date: new Date(dueDate).toISOString(),
        status: 'active' as const,
        qr_token: token || generateId(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      await addAssignment(newAssignment);
      await sync();
      
      setCheckoutComplete(true);
      triggerHaptic(hapticPatterns.success);
      
      // Redirect to publisher view after 2 seconds
      setTimeout(() => {
        router.push('/publisher');
      }, 2000);
    } catch (err) {
      logger.error('Checkout failed:', err);
      setError('Failed to check out territory. Please try again.');
      triggerHaptic(hapticPatterns.error);
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Calculate stats
  const houseCount = houses.length;
  const estimatedHours = Math.ceil(houseCount * 2 / 60); // ~2 min per house

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading territory...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-destructive/10 rounded-full flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-xl font-bold mb-2">Unable to Checkout</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  if (checkoutComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Territory Checked Out!</h1>
          <p className="text-muted-foreground mb-6">
            You have successfully checked out <strong>{territory?.name}</strong>.
            Redirecting to your territories...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <div className="max-w-md w-full">
        {/* Territory Card */}
        <div className="bg-card rounded-2xl border border-border shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-primary/5 p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-full flex items-center justify-center">
              <QrCode className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold mb-1">Territory Checkout</h1>
            <p className="text-sm text-muted-foreground">
              Scan successful! Review the territory details below.
            </p>
          </div>

          {/* Territory Info */}
          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-primary/10 rounded-xl">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{territory?.name}</h2>
                {territory?.description && (
                  <p className="text-sm text-muted-foreground">{territory.description}</p>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 bg-muted rounded-xl">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Home className="w-4 h-4" />
                  <span className="text-sm">Houses</span>
                </div>
                <p className="text-2xl font-bold">{houseCount}</p>
              </div>
              <div className="p-4 bg-muted rounded-xl">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-sm">Due Date</span>
                </div>
                <p className="text-lg font-bold">
                  {new Date(dueDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Publisher Info */}
            {isAuthenticated ? (
              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-3 p-4 bg-muted rounded-xl">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{user?.full_name || user?.email}</p>
                    <p className="text-sm text-muted-foreground">Will be assigned to you</p>
                  </div>
                </div>
                
                {/* Publisher Name Input (allow editing) */}
                <div>
                  <label className="block text-sm font-medium mb-2">Your Name</label>
                  <input
                    type="text"
                    value={publisherName}
                    onChange={(e) => setPublisherName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 rounded-lg border border-input bg-background"
                  />
                </div>

                {/* Due Date Input */}
                <div>
                  <label className="block text-sm font-medium mb-2">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-input bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    <Clock className="w-3 h-3 inline mr-1" />
                    Estimated time: {estimatedHours} hour{estimatedHours !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 bg-amber-500/10 rounded-xl mb-6">
                <p className="text-sm text-amber-700">
                  You need to sign in before checking out this territory.
                </p>
              </div>
            )}

            {/* Actions */}
            <button
              onClick={handleCheckout}
              disabled={isCheckingOut || (isAuthenticated && !publisherName.trim())}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isCheckingOut ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Checking out...
                </>
              ) : (
                <>
                  {isAuthenticated ? 'Check Out Territory' : 'Sign In to Check Out'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>

            {!isAuthenticated && (
              <p className="mt-4 text-sm text-muted-foreground text-center">
                You&apos;ll be redirected to sign in first
              </p>
            )}
          </div>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel and return home
          </Link>
        </div>
      </div>
    </div>
  );
}
