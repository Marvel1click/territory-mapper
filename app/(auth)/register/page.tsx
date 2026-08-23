import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegistrationClosedPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-muted/30 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <span className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <MailCheck aria-hidden="true" className="size-6" />
          </span>
          <CardTitle role="heading" aria-level={1}>Territory Mapper is invite-only</CardTitle>
          <CardDescription>
            Ask your congregation administrator for an invitation. Existing accounts can continue
            to sign in with their current password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="min-h-11 w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
