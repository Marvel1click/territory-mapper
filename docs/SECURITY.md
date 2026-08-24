# Security and privacy model

## Trust boundaries

- Supabase Auth proves identity; editable user metadata is never an authorization source.
- `congregation_memberships` is the authoritative source for one active V1 congregation and role.
- RLS is the database backstop. Server routes repeat tenant/role checks before using the service role.
- Mutation routes enforce same-origin requests, Zod schemas, stable error codes, request IDs, no-store responses, and throttling.
- Checkout and invitation tokens are random, one-time, hashed at rest, revocable, and expire within seven days.

## DNC data

Exact DNC addresses and notes use versioned AES-256-GCM keys available only to the application server. The database stores ciphertext, a normalized lookup hash, coordinates, a generic warning radius, and key version. When a house becomes DNC, a transaction creates the restricted record and changes the publisher-visible house into a masked soft-delete tombstone. That tombstone evicts an older callable copy during the next RxDB pull.

Publisher DNC responses contain only coordinates, `Do not call nearby`, and warning radius. DNC responses are network-only and are not written to publisher IndexedDB or the service-worker data cache. Voice input stores transcripts only; audio is never uploaded or retained.

When a manager asks for geocoding during CSV preview, the submitted address is sent server-side to Mapbox for that lookup. Coordinates supplied directly in the CSV are not geocoded. This provider boundary should be included in the congregation's privacy review.

## Offline isolation

RxDB database names include a user/congregation-specific scope. Logout cancels replication, removes the active database, resets sync metadata, and clears user caches before returning to login. Auth responses and API data are network-only in Serwist. Public shells and static assets may be cached; basemap tiles are bounded and expire.

## Logging

Production logging emits JSON with event, level, timestamp, stable code, status, and request ID. Keys associated with addresses, authorization, cookies, coordinates, email, encryption keys, notes, passwords, phone, sessions, and tokens are redacted. Error messages and stacks are not emitted in production context objects.

Report a suspected vulnerability privately to the repository owner. Do not open an issue containing credentials, customer data, exact addresses, tokens, or exploitation details.
