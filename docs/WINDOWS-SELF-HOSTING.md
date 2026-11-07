# Eclipse Order — Windows hosting overview

**Current direction:** The Windows Node.js + MySQL API and matching React client are already implemented in the repository. This is no longer only a hypothetical migration plan. Production readiness still requires real-server migration, permissions, backup, and Cloudflare checks.

## Components

- Frontend: React/Vite static site on GitHub Pages, built with `VITE_ECLIPSE_API_URL=https://api.rosefires.com` for the documented public setup.
- API: Node.js 22+ on Windows, bound to `127.0.0.1:3182`; keep `server/.env` private.
- Database: local MySQL `eclipse_order`; do not expose port 3306.
- External access: existing **Eclipse-Order-API** Cloudflare Tunnel, configured to the local Node API after security checks.

See [server setup](Operations/SERVER-README.md) for installation and [Cloudflare launch](Operations/CLOUDFLARE-LAUNCH.md) for routing. Use `npm run setup:local` from `server/` after a backup to install additive MySQL migrations, including event XP.

## What the old Supabase files mean

The legacy browser/Supabase adapter remains in the repository for compatibility when `VITE_ECLIPSE_API_URL` is unset. It is not the supported Windows member portal. Do not run PostgreSQL/Supabase SQL against MySQL or assume legacy users/passwords automatically moved into MySQL. If there is historical data to preserve, plan and verify any transfer separately before retiring the old instance.

## Before opening access

Verify account approval and login, server-side role checks, private bound-sheet redaction, OOC pause and revocation, event signup ownership, GM dice, completed-event XP, HTTPS/CORS, rate limiting and a restorable encrypted database backup. Test from a second device through the published website; local `/ready` is not a substitute for a public login check.

Hosting from a Windows PC means downtime during power loss, sleep, restarts, or network failure unless you add reliable service startup and power protection. Do not store passwords, private member records or backups in GitHub. 
