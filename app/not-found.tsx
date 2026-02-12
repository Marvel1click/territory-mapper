'use client';

import Link from 'next/link';
import { MapPin, Home, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NotFound() {
  const router = useRouter();
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="w-24 h-24 mx-auto bg-muted rounded-full flex items-center justify-center">
          <MapPin className="w-12 h-12 text-muted-foreground" />
        </div>

        {/* Error Code */}
        <div>
          <h1 className="text-6xl font-bold text-primary mb-2">404</h1>
          <h2 className="text-2xl font-semibold mb-2">Page Not Found</h2>
          <p className="text-muted-foreground">
            We couldn&apos;t find the page you&apos;re looking for. It might have been moved or deleted.
          </p>
        </div>

        {/* Divider */}
        <div className="w-16 h-1 bg-border mx-auto rounded-full" />

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border rounded-lg font-medium hover:bg-accent transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
        </div>

        {/* Helpful Links */}
        <div className="pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground mb-4">Popular pages:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link
              href="/overseer"
              className="px-4 py-2 bg-muted rounded-lg text-sm hover:bg-accent transition-colors"
            >
              Overseer Dashboard
            </Link>
            <Link
              href="/publisher"
              className="px-4 py-2 bg-muted rounded-lg text-sm hover:bg-accent transition-colors"
            >
              Publisher Dashboard
            </Link>
            <Link
              href="/settings"
              className="px-4 py-2 bg-muted rounded-lg text-sm hover:bg-accent transition-colors"
            >
              Settings
            </Link>
          </div>
        </div>

        {/* Support */}
        <p className="text-xs text-muted-foreground">
          If you believe this is a mistake, please contact your territory overseer.
        </p>
      </div>
    </div>
  );
}
