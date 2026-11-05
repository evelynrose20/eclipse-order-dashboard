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

**Still in development:** Character sheets, events, encounters, member RP profiles and binding request APIs are not ported from Supabase yet. The existing production dashboard remains unchanged on `main`. Do not switch the main website to local-only mode until these APIs are implemented. The new account portal is independently testable now.

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

Open `http://localhost:5173`. If the database contains no accounts, it first displays **Create your Domina account** with regular password and confirmation fields. Set a password at least 16 characters long and submit; then sign in. The account portal also has `Request membership`. Create a test member (with a different email), then sign in with the Domina account, open **Pending account requests**, and click **Approve**. The approved member can then sign in. Browser requests are allowed only from the exact `API_ALLOWED_ORIGIN` in your local `.env`.

When working on other dashboard features, remove `VITE_ECLIPSE_API_URL` from root `.env.local` to view the existing legacy UI.

## Security and launch restrictions

- The API remains bound to `127.0.0.1` so MySQL is never exposed.
- Public hostname and cross-origin support are explicitly opt-in; keep `API_PUBLIC_ENABLED=false` until the full dashboard backend is ported and audited.
- The registration declaration records a user's self-assertion only; it is not proof of age.
- Registration throttling is only a starter control. Before inviting public signups, add Cloudflare rate limiting, bot protection, recovery/email verification, backups, and persistent rate-limit storage.
- The existing Supabase site remains live on `main`; do not delete the Supabase project until the full feature migration and final cutover are verified.

## Fix for the old console password confirmation error

If your previous `npm run setup:local` ended with `Password invalid or confirmation mismatch`, the SQL setup had already completed but the first Domina account was NOT inserted. The old terminal raw-input code was fragile on Windows. Update to the latest development branch and run `npm run setup:local` again; it will only verify/complete schema changes and should not ask for the Domina password. Then start `npm start` and use the browser form at `http://localhost:5173` as described above. Do not share passwords or database admin credentials. Keep `API_PUBLIC_ENABLED=false` during bootstrap.
