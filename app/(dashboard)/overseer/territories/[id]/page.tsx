import { redirect } from 'next/navigation';
export default async function LegacyTerritoryPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; redirect(`/dashboard/territories/${id}`); }
