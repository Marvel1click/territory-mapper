import { AppError, apiErrorResponse, apiSuccess, getRequestId, toAppError } from '@/app/lib/api/errors';
import { assertSameOrigin, parseJson, throttleMutation } from '@/app/lib/api/request';
import { requireAuthContext } from '@/app/lib/auth/context';
import { geocodePreviewSchema } from '@/app/lib/validation/schemas';

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const context = await requireAuthContext(['admin', 'overseer']);
    throttleMutation(context.userId, 'geocode-preview');
    const input = await parseJson(request, geocodePreviewSchema);
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

    const rows = await Promise.all(input.rows.map(async (row) => {
      if (row.latitude != null && row.longitude != null) {
        return { ...row, latitude: row.latitude, longitude: row.longitude, source: 'csv' as const, confidence: 1 };
      }
      if (!token) {
        return { ...row, latitude: null, longitude: null, source: 'unresolved' as const, confidence: 0, error: 'Mapbox geocoding is not configured.' };
      }
      const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(row.address)}.json`);
      url.searchParams.set('access_token', token);
      url.searchParams.set('limit', '1');
      url.searchParams.set('types', 'address');
      const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8_000) });
      if (!response.ok) {
        return { ...row, latitude: null, longitude: null, source: 'unresolved' as const, confidence: 0, error: 'Geocoding request failed.' };
      }
      const body = await response.json() as { features?: Array<{ center?: [number, number]; relevance?: number; place_name?: string }> };
      const match = body.features?.[0];
      if (!match?.center) {
        return { ...row, latitude: null, longitude: null, source: 'unresolved' as const, confidence: 0, error: 'No address match was found.' };
      }
      return {
        ...row,
        address: match.place_name ?? row.address,
        longitude: match.center[0],
        latitude: match.center[1],
        source: 'mapbox' as const,
        confidence: match.relevance ?? 0,
      };
    }));

    return apiSuccess({ rows }, requestId);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return apiErrorResponse(new AppError('INTERNAL_ERROR', 'Geocoding timed out. Try the preview again.', 504), requestId);
    }
    return apiErrorResponse(toAppError(error), requestId);
  }
}
