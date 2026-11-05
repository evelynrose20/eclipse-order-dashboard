# Eclipse Order — Windows MySQL account backend

This development branch replaces Supabase **for account creation and approval only**. It uses your existing `eclipse_order` MySQL database and Node.js API on Windows. Supabase test data is intentionally discarded; no external database connection or export is necessary.

## What works

- Secure local Domina account initialization (only when no accounts exist)
- Members can submit registration requests with display name, email, strong password and 18+ declaration
- Accounts remain inactive with status `pending`; pending logins are rejected
- Domina can list all accounts and approve/reject requests using the registration dashboard
- Domina can change account roles and standing
- Database-backed login sessions expire and logout revokes them
- Passwords are hashed with scrypt and never stored as plaintext

**Ported in this branch:** the full inline D&D sheet editor, player/handler assignment, protected MySQL character sheets, member approvals, battle map, monsters, encounter initiative, event publishing and approvals, server-verified dice, OOC status transitions, RP preference controls, explicitly shared RP directory, FC rules and static Black Market. These features require the new `005_features.sql` migration and real Windows end-to-end validation before production. The existing production dashboard remains unchanged on `main`. Do not switch the main website to local-only mode until these APIs are implemented. The integrated local dashboard (Overview, roster, sheets, account approvals) is independently testable now.

## Windows setup (no manual SQL)

You have already created `eclipse_order`, its five core tables, and the restricted `eclipse_api` DB user. Your local `/ready` endpoint already reports `{"status":"ready","database":"connected"}`.

1. Download or pull the latest **`feature/windows-local-api-bootstrap`** branch from GitHub. If using a ZIP, copy your **existing secret** `server/.env` into the updated `server` folder on your PC. Never upload `.env` or share the credentials.
2. In `server/.env`, retain your existing DB settings and add:

```ini
API_ALLOWED_ORIGIN=http://localhost:5173
API_PUBLIC_ENABLED=false
API_PUBLIC_HOST=api.rosefires.com
MIGRATION_DB_USER=root
```

If HeidiSQL uses a different MySQL admin account, update `MIGRATION_DB_USER`. No MySQL administrator password is stored in `.env`.

3. Open PowerShell inside the updated `server` folder:

```powershell
npm install
npm run setup:local
```

This setup command privately asks for your **MySQL administrator password**, checks and adds the account-session and account-approval schema as needed, then finishes database preparation. It no longer asks for the Domina password in PowerShell. Your first Domina account is created in the **local browser form** instead. It will not overwrite existing accounts.

4. Start the local API:

```powershell
npm start
```

Verify `http://127.0.0.1:3182/health` and `http://127.0.0.1:3182/ready`.

## Test the registration and admin screen

In the **repository root**, create a local `.env.local` file containing:

```ini
VITE_ECLIPSE_API_URL=http://127.0.0.1:3182
```

In a **second PowerShell window**, in the repository root:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. If the database contains no accounts, it first displays **Create your Domina account** with regular password and confirmation fields. Set a password at least 16 characters long and submit; then sign in. The account portal also has `Request membership`. Create a test member (with a different email), then sign in with the Domina account, open **Pending account requests**, and click **Approve**. The approved member can then sign in. Once signed in, the site opens the original dashboard-inspired navigation with Overview, Character roster, Character sheets, and the Domina-only Order accounts section. The current roster uses the local MySQL character table, starting empty. Encounters, events, RP profiles and binding requests explicitly show a not-yet-connected message. Browser requests are allowed only from the exact `API_ALLOWED_ORIGIN` in your local `.env`.

When working on other dashboard features, remove `VITE_ECLIPSE_API_URL` from root `.env.local` to view the existing legacy UI.

## Security and launch restrictions

- The API remains bound to `127.0.0.1` so MySQL is never exposed.
- Public hostname and cross-origin support are explicitly opt-in; keep `API_PUBLIC_ENABLED=false` until the full dashboard backend is ported and audited.
- The registration declaration records a user's self-assertion only; it is not proof of age.
- Registration throttling is only a starter control. Before inviting public signups, add Cloudflare rate limiting, bot protection, recovery/email verification, backups, and persistent rate-limit storage.
- The existing Supabase site remains live on `main`; do not delete the Supabase project until the full feature migration and final cutover are verified.

## Fix for the old console password confirmation error

If your previous `npm run setup:local` ended with `Password invalid or confirmation mismatch`, the SQL setup had already completed but the first Domina account was NOT inserted. The old terminal raw-input code was fragile on Windows. Update to the latest development branch and run `npm run setup:local` again; it will only verify/complete schema changes and should not ask for the Domina password. Then start `npm start` and use the browser form at `http://localhost:5173` as described above. Do not share passwords or database admin credentials. Keep `API_PUBLIC_ENABLED=false` during bootstrap.

## Integrated dashboard progress

The local account portal now transitions into `src/LocalWorkspace.jsx` after login, with the original dashboard sidebar and member approvals embedded in **Order accounts**. The first MySQL `/characters` API supports guarded listing, command-created characters and editing permitted sheet fields. A member only receives their own records; a bound player receives a limited sheet with private D&D details omitted server-side; a handler receives the full sheet only for assigned characters; command sees full records. A linked character cannot be directly switched to bound status through sheet editing.

**Current limits:** Production deployment, secure account recovery/email verification, persistent rate limiting, automated backups, live Windows MySQL integration verification and Cloudflare cutover still require testing. Do not publish the Cloudflare route or merge to production until full access-control and end-to-end testing is complete.

## Finish local MySQL feature installation without changing existing accounts

On your PC, update/pull the latest `feature/windows-local-api-bootstrap` development branch, keeping your existing private `server/.env`. Because you already created and signed in with a Domina account, **do not create it again**. Stop only the backend in its PowerShell window, then in the updated `server` folder run:

```powershell
npm install
npm run setup:local
npm run dev
```

The setup command prompts once for your **local MySQL administrator password**, automatically creates the extra feature tables in `server/sql/005_features.sql`, and detects your existing account. It does not delete or replace your Domina login or other records. No Supabase credentials, export or manual SQL entry are needed. Password characters are hidden at the administrator-password prompt; the previous **Domina password confirmation bug** is eliminated.

The frontend remains in a separate PowerShell window in the repository root. Keep root `.env.local` set to `VITE_ECLIPSE_API_URL=http://127.0.0.1:3182` and run `npm run dev`; then open `http://localhost:5173`. You should see the original Eclipse Order navigation after signing in: Overview, Character roster, Character sheets, Black Market, Order accounts (Domina), Encounters & dice, Events & signups, My RP profile, Member RP profiles, Binding requests, and Workspace & backup / FC rules.

**Important functional expectations:** The database starts empty except for your account. Create/assign characters before inviting players to events. Members must explicitly save their 18+ declaration and opt in to event themes before signing up or rolling in encounters. RP profile sharing is always off by default and revocable; bound/free changes require the character player's OOC approval and command application. Member passwords and session data remain local. The API is intentionally not publicly exposed through Cloudflare until tested. The existing Supabase production site on `main` is unchanged.
