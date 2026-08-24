# Territory Mapper

Territory Mapper is an invite-only, multi-tenant PWA for congregation territory planning and field work. It provides a desktop/tablet overseer workspace and a mobile-first publisher mode backed by Supabase, Mapbox, RxDB, Serwist, and Vercel.

## Product scope

- Admins manage invitations, membership, roles, and status.
- Admins and overseers draw territories, import houses, assign work, issue one-time checkout links, review visits, and export CSV/GeoJSON.
- Publishers see only active assignments, record append-only visits, manage return visits, and work from downloaded data while offline.
- Exact DNC addresses and notes are encrypted with AES-256-GCM and kept out of publisher IndexedDB. Publishers receive generic proximity warnings only.
- Public self-registration, stored audio, push notifications, billing, and behavioral analytics are intentionally out of scope.

## Architecture

- **Next.js 16 App Router** for the web application and authenticated route handlers.
- **Supabase Auth + Postgres** for identity, authoritative memberships, RLS, transactional assignment/DNC functions, and audit history.
- **RxDB replication protocol** for user-scoped offline data, server checkpoints, idempotent visits, tombstones, retries, and conflicts.
- **Mapbox GL** for territory boundary editing and field maps. Offline basemaps are limited to previously viewed tiles.
- **Serwist** for the TypeScript service worker, shell precaching, update prompts, offline fallback, and cache cleanup.
- **Vercel** for previews and production, with Core Web Vitals only through Speed Insights.

The production schema is additive in [`supabase/migrations/004_production_rebuild.sql`](supabase/migrations/004_production_rebuild.sql). Legacy metadata is read once for backfill; authorization thereafter comes from `congregation_memberships`.

## Local setup

Requirements: Node.js 22, npm, Docker or Podman for local Supabase, and provider credentials for a non-production project.

```bash
cp .env.example .env.local
npm ci
supabase start
npm run dev
```

Required environment values:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_MAPBOX_TOKEN
NEXT_PUBLIC_APP_URL
DNC_ENCRYPTION_KEY_VERSION
DNC_ENCRYPTION_KEY_V1
```

Generate a 32-byte DNC key with `openssl rand -base64 32`. Keep every referenced key version available until all records have been rotated. Never expose service-role or DNC keys through `NEXT_PUBLIC_*` variables.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run security:audit
npm run build
supabase test db
npm run test:e2e -- --project=chromium
```

Database tests require the local Supabase containers. Authenticated E2E journeys require a staging project with synthetic accounts through the `E2E_*` environment variables; they skip when those credentials are absent. Public and accessibility journeys always run.

## DNC migration

Back up the database before migration. After the additive SQL migration is applied, run the DNC migration in dry-run mode first:

```bash
npm run migrate:dnc
npm run migrate:dnc -- --apply
```

The script encrypts, verifies by decrypting in memory, and only then masks the legacy house fields. It is restart-safe. Do not remove an old encryption key version while records still reference it.

## Release policy

All work lands through a feature branch and Vercel preview using a staging Supabase project with synthetic data. Production cutover requires an explicit approval after backup, migration dry run, pgTAP, browser smoke tests, and preview review. Do not point a preview at production data.

See [`docs/PRODUCTION_RUNBOOK.md`](docs/PRODUCTION_RUNBOOK.md), [`docs/SECURITY.md`](docs/SECURITY.md), and [`docs/ACCESSIBILITY_CHECKLIST.md`](docs/ACCESSIBILITY_CHECKLIST.md).

## License

MIT. See [`LICENSE`](LICENSE).
