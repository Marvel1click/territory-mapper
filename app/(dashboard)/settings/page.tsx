import { redirect } from 'next/navigation';
import { requireAuthContext } from '@/app/lib/auth/context';
export default async function LegacySettingsPage() { const context = await requireAuthContext(); redirect(context.membership.role === 'publisher' ? '/field/settings' : '/dashboard/settings'); }
