# Production runbook

## Release gates

Do not merge the release branch to `master` until every gate is green and the owner explicitly approves production cutover.

1. Confirm the Vercel preview is linked to the staging Supabase project and contains synthetic data only.
2. Run `npm ci`, lint, typecheck, unit tests, `npm audit --audit-level=high`, the production build, pgTAP, and Chromium/mobile E2E.
3. Complete the manual accessibility checklist.
4. Verify `/api/health`, sign-in, invitation acceptance, territory import, assignment, secure checkout, field visits, reconnect sync, conflict notice, return, exports, and logout cleanup.
5. Confirm the preview has no unexpected runtime errors and that CSP contains no production `unsafe-eval`.

## Pre-cutover

1. Record the current Vercel production deployment URL as the rollback target.
2. Create and verify a restorable Supabase backup. Record its timestamp and project reference in the private change record; never commit credentials or customer data.
3. Confirm all DNC key versions referenced by production records are present in the production environment.
4. Apply the additive migration. Do not run a destructive schema cleanup in this release.
5. Run `supabase test db` against an isolated clone or staging database and repeat tenant/RLS smoke queries against production with synthetic test identities.
6. Run `npm run migrate:dnc` without `--apply`; review the count. Then run with `--apply`, verify the reported count, and confirm no active DNC house retains a plaintext address or note.
7. Re-run health and read-only smoke checks. Obtain explicit approval.

## Deploy

1. Merge the reviewed branch to `master` only after approval.
2. Watch the GitHub Actions release gates and Vercel deployment to completion.
3. Verify the production deployment ID and commit SHA match the approved release.
4. Check `/api/health`, then exercise the primary overseer and publisher journeys in a private browser session.
5. Review privacy-filtered Vercel runtime errors and Core Web Vitals. Confirm no exact addresses, notes, emails, tokens, cookies, or coordinates appear in logs.
6. Test one offline visit, reconnect it, and confirm its mutation is present once in `visits` and reflected on the house.

## Rollback

If the application is unhealthy, promote the recorded previous Vercel deployment. The additive database migration remains in place because it is backward-compatible. Revoke checkout links created during a failed release if their integrity is uncertain. Do not restore the database unless data corruption is proven and the owner approves the restore.

If DNC migration verification fails, stop the migration script. It masks a row only after encryption verification, so unprocessed rows remain available for a safe retry. Retain all encryption key versions.

## Incident triage

- Correlate client reports with the privacy-safe `x-request-id`.
- Check Vercel runtime errors, `/api/health`, Supabase status/logs, and the latest deployment diff.
- For sync issues, capture collection name, mutation ID, checkpoint, conflict resolution, and timestamp—never document content.
- For suspected tenant or DNC exposure, disable the affected deployment, revoke checkout links, preserve evidence, and notify the owner immediately.

## Monitoring limits

This project records privacy-filtered structured warnings/errors and Core Web Vitals only. It intentionally has no pageview or behavioral analytics. Vercel Hobby observability and retention are limited and are not a substitute for an on-call service, long-term log archive, alerting SLA, or guaranteed incident response. Review current plan limits in the Vercel dashboard before production use and upgrade or add an approved privacy-safe drain if operational requirements exceed them.
