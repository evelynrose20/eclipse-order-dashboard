# Eclipse Order — contributor and AI editing guide

## Architecture

The supported member portal uses React/Vite plus the Windows Node/MySQL API. `App.jsx` selects `LocalAccounts`/`LocalWorkspace` when `VITE_ECLIPSE_API_URL` is configured. The `src/apiBridge.js` adapter selects the matching Windows API actions. The legacy `Dashboard.jsx` + Supabase/browser storage path remains when the URL is absent and must not be confused with the primary Windows deployment.

Server routes and authorization live in `server/src/`; additive SQL migrations live in `server/sql/`. `server/src/setup-local.js` applies features, syndicate ranks and event XP. Historical `supabase/` scripts are **PostgreSQL-only** and must not be run against MySQL.

## Non-negotiable rules

1. Verify private-record access on the server, not by hiding UI elements. Bound players cannot receive sealed sheet details through API responses.
2. Binding and unbinding preserve the complete sheet and require explicit linked-player OOC approval. OOC pause, decline, revocation and withdrawal are available regardless of IC roleplay status.
3. RP content and kink preferences remain private by default; separate sharing must be opt-in and revocable. Do not expose private preference details to GMs or other members.
4. GM-only dice, private notes, event approvals, rank/role changes and completed-event XP awards require server-side permissions.
5. Event XP must be granted only for completed events to participating characters, once per character/event, through the server-owned progression system. Do not reintroduce a shop, payroll, wallet, purchases or ration system.
6. Account 18+ declarations are self-attestations, not proof of identity or age. Do not collect identity documents in this application.
7. Never commit login/database secrets, private OOC disclosures, live member exports or backups. Keep database access bound to the local interface.
8. Add forward-only MySQL migrations, preserve existing records and require a backup and explicit live database verification. GitHub CI does not install SQL.
9. Use a branch/PR for code changes, verify frontend and server tests, and do not merge/deploy without the user's approval.
10. Treat public API CORS, authentication, rate limiting, recovery, monitored uptime and encrypted backup/restore as release requirements.

## Review process

Inspect changed UI, server permissions, migration impacts and active vs. legacy paths. Run `npm ci && npm test && npm run build` from the repository root and `npm ci && npm test` from `server/`. Test MySQL integration with a real configured test database before claiming it passed; a skipped suite is not proof. Verify different account permissions in separate sessions, document migration/rollback implications and review the PR before merging.
