import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/db/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('congregations').select('id').limit(1);
    if (error) throw error;
    return NextResponse.json(
      {
        status: 'ok',
        version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? 'development',
        database: 'reachable',
        responseTimeMs: Date.now() - startedAt,
      },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch {
    return NextResponse.json(
      { status: 'degraded', database: 'unreachable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
