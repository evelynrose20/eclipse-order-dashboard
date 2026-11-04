# Self-hosting Eclipse Order on a Windows PC — migration plan

## Current architecture

The production app is a React/Vite static site. Its browser client uses Supabase's /auth/v1 login and /rest/v1/rpc endpoints. The database is PostgreSQL with Row Level Security and SECURITY DEFINER functions. Simply changing the frontend URL to `localhost`, a MySQL port, or a PostgreSQL server will NOT work for other players: browsers cannot safely connect directly to a database, and the old RPCs are PostgreSQL functions.

**This branch does not migrate the application off Supabase.** It introduces only the inline sheet editor and RP profile system. Leave the current database connected until a replacement backend is built and tested.

## Recommended Windows-local option

For a small FC, use a dedicated Windows PC that runs 24/7:

- Node.js HTTP API listening on `127.0.0.1:3182` or another private port (a future component; not implemented yet).
- MySQL/MariaDB on `127.0.0.1:3306`, or a locally installed PostgreSQL instance. If you already maintain MySQL/HeidiSQL on Windows, it can work, but it requires converting Supabase PostgreSQL functions to application-service authorization.
- Expose **only the authenticated HTTP API**, not the database port, through Cloudflare Tunnel to a domain you control, e.g. `api.example.com`.
- Keep the React website on GitHub Pages; change the app's API client only after endpoint/auth/data migrations are complete.
- Run the API and Cloudflare tunnel as Windows services with automatic restart; configure Windows Firewall to disallow inbound MySQL/PostgreSQL connections from the public Internet.

## Required implementation phases

1. **Inventory and snapshot**: Export all Supabase character rows, role/membership records, character status requests, event signups, encounter combatants, dice history, FC rules, private RP preferences, kink profiles and audit history. Encrypt the backup. Verify counts.
2. **Choose destination DB**: Use existing Windows MySQL if you prefer; PostgreSQL on Windows minimizes changes to schema types but still requires replacing the Supabase Auth/RPC gateway, or running an equivalent self-hosted API layer.
3. **Implement backend auth**: Email/password reset, strong password hashing, session/refresh-token handling, rate limits and audit logs. Avoid reusing old frontend admin credentials. Existing Supabase password hashes/session tokens cannot simply be copied over into a custom login implementation; plan a new sign-in/password-reset rollout or an explicit auth bridge.
4. **Move permissions server-side**: Domina, High Command, Handler and Member authorization; bound sheet redaction; reversible status approvals; event signup ownership; OOC stop/withdrawal; private-by-default kink/profile sharing; GM-only dice. These must be checked before every read/write.
5. **Migrate data** into the destination schema with stable user and character IDs. Verify all public/private record access for at least four distinct accounts.
6. **Cut over safely** with a staging hostname, backup/restore drill, HTTPS, health checks, and a rollback plan. Only switch the production frontend once tests pass.

## Reliability, cost, and privacy

Self-hosting can avoid Supabase subscription charges but does **not** eliminate operational work. If the PC loses power, goes to sleep, reboots, or the home Internet is down, the FC API goes offline. Protect it with Windows updates, a UPS where possible, an external encrypted backup drive plus a separate offsite copy, and a tested restore procedure. Never store player OOC preferences in a public GitHub repo.

Cloudflare Tunnel uses outbound connections, so it can publish a localhost HTTP API without opening router inbound ports; it does not replace proper API authentication/authorization. Keep the DB socket private. Use a domain with Cloudflare DNS for a stable hostname.

## Why this is a project, not a SQL setting

The existing client requires Supabase Auth and PostgreSQL RPC semantics. Hosting only MySQL/PostgreSQL on your Windows PC is not enough. A standalone Windows Node API and matching React client changes are separate implementation work; this repo intentionally does not claim that switch is already complete.
