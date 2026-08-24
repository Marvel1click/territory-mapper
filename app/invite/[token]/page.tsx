import type { Metadata } from 'next';
import { InvitationAcceptance } from './InvitationAcceptance';

export const metadata: Metadata = {
  title: 'Accept invitation',
  robots: { index: false, follow: false },
};

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitationAcceptance token={token} />;
}
