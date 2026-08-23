import { z } from 'zod';
import { AppError } from './errors';

const mutationWindows = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_MUTATIONS_PER_WINDOW = 60;

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new AppError('ORIGIN_REJECTED', 'The request origin is not allowed.', 403);
  }
  if (!origin && !fetchSite) {
    throw new AppError('ORIGIN_REJECTED', 'The request origin could not be verified.', 403);
  }
  if (!origin) return;

  const requestOrigin = new URL(request.url).origin;
  const allowedOrigins = new Set(
    [
      requestOrigin,
      process.env.NEXT_PUBLIC_APP_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    ].filter((value): value is string => Boolean(value)),
  );

  if (!allowedOrigins.has(origin)) {
    throw new AppError('ORIGIN_REJECTED', 'The request origin is not allowed.', 403);
  }
}

export function throttleMutation(
  actorId: string,
  scope: string,
  options: { limit?: number; windowMs?: number } = {},
): void {
  const now = Date.now();
  const key = `${actorId}:${scope}`;
  const attempts = (mutationWindows.get(key) ?? []).filter(
    (timestamp) => now - timestamp < (options.windowMs ?? WINDOW_MS),
  );
  if (attempts.length >= (options.limit ?? MAX_MUTATIONS_PER_WINDOW)) {
    throw new AppError(
      'RATE_LIMITED',
      'Too many changes were submitted. Please wait and try again.',
      429,
    );
  }
  attempts.push(now);
  mutationWindows.set(key, attempts);
}

export async function parseJson<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError('VALIDATION_FAILED', 'The request body must be valid JSON.', 400);
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const details = result.error.flatten().fieldErrors;
    throw new AppError(
      'VALIDATION_FAILED',
      'Some submitted fields are invalid.',
      400,
      details as Record<string, string[]>,
    );
  }
  return result.data;
}
