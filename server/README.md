# Eclipse Order Windows local API — bootstrap only

This is a **local-only HTTP health server**, not the final backend and not a Supabase replacement yet. It deliberately binds to `127.0.0.1:3182`, has no public login endpoints, and must not be published through Cloudflare until session authentication and server-side access controls are implemented.

## Start on Windows PowerShell

From the cloned GitHub repo folder:

```powershell
cd server
Copy-Item .env.example .env
npm install
npm start
```

Open **http://127.0.0.1:3182/health**. Expect a JSON result containing `"status":"ok"`. Keep the terminal open for this test. To stop the server press Ctrl+C.

The `/ready` endpoint returns HTTP 503 until database credentials are added. This is expected during the first test. After creating a restricted database application user, edit **server/.env** locally (never in GitHub) to populate `DB_USER` and `DB_PASSWORD`; restart with `npm start`. Then `/ready` should report a connected database.

Do **not** put your MySQL root password in this file; use a separate least-privileged `eclipse_order` application database user. No tables, accounts or data are created by this bootstrap.

## Windows notes

- Confirm the listening process with `Get-NetTCPConnection -LocalPort 3182 -State Listen`.
- Only localhost connections work, by design. This is intentional; public access is unsafe before authentication is implemented.
- Cloudflare tunnel can remain Healthy, but **do not create the published application route yet**.
- `npm install` generates a local `package-lock.json`. We can commit a verified lockfile later after testing dependencies.
- If port 3182 is occupied, change `API_PORT` in the local `.env` and use the matching URL.
- No existing Supabase data is moved or altered.

## Step 20 — Create the empty local tables

Your earlier `/ready` response, `{"status":"ready","database":"connected"}`, confirms the Node API can connect to `eclipse_order`.

1. **Leave Cloudflare's published API route disabled.** There is no authentication API yet.
2. Open HeidiSQL and connect using your **database administrator** session, not the restricted `eclipse_api` account. Schema creation requires DDL privileges that `eclipse_api` intentionally lacks.
3. Select the existing `eclipse_order` database.
4. Open [server/sql/001_core.sql](sql/001_core.sql) from this branch and copy its contents into a new HeidiSQL Query tab.
5. Execute the script using F9.
6. Check the results using:

```sql
USE eclipse_order;
SELECT version, applied_at FROM schema_migrations;
SHOW TABLES;
SELECT COUNT(*) AS accounts FROM accounts;
SELECT COUNT(*) AS characters FROM characters;
```

The migration should show `001_core`; there should be **five tables** (`accounts`, `characters`, `character_status_requests`, `audit_log`, `schema_migrations`) and **zero account/character records**. It neither imports Supabase data nor creates the first Domina account.

### Important schema and privacy guarantees

- Account role and normal FC standing are separate columns.
- Character `collar_bound` and `bound_rank` are separate from account role.
- Full character sheets remain stored as JSON. Bound-player sheet redaction **must** be enforced by a future authenticated API before any browser reads them.
- Bound/free status transitions still require the linked player's explicit OOC approval; the table is groundwork, not a working approval endpoint.
- Password hashes will be stored using an appropriate password-hashing scheme in a future auth implementation; **do not manually insert plaintext passwords**.
- Member profiles, kink lists, event registration, dice, and backups are **not** migrated or implemented by this schema yet.
- Do not expose database port 3306 to the Internet.

## Step 22 — Initialize secure local account sessions

The five tables from `001_core.sql` are now created and `/ready` reports `{"status":"ready","database":"connected"}`.

Before creating any accounts:

1. **Back up** your new `eclipse_order` database with HeidiSQL (there may still be no member data, but keep a recovery point).
2. On GitHub, open [server/sql/002_sessions.sql](sql/002_sessions.sql) and copy its entire contents into a new HeidiSQL query tab.
3. Execute it with your **database administrator** session. The restricted `eclipse_api` user must not receive schema-changing privileges.
4. Check:

```sql
USE eclipse_order;
SELECT version,applied_at FROM schema_migrations;
SHOW TABLES;
```

Expected migration markers: `001_core`, `002_sessions`. Expected tables: **six**, including `account_sessions`. This does not import Supabase accounts or create logins.

## Step 23 — Update your Windows API source code

If you originally used **Download ZIP**, download the updated `feature/windows-local-api-bootstrap` branch. Extract it to a fresh location, and **copy your existing local `server/.env` file only onto your own PC** into the new `server` folder. Never upload `.env` to GitHub or put its contents in a chat.

If you cloned the branch with Git, update it from PowerShell in your repository directory:

```powershell
git checkout feature/windows-local-api-bootstrap
git pull origin feature/windows-local-api-bootstrap
```

Open a terminal in the **updated** `server` folder, install dependencies (if needed), and start the service:

```powershell
npm install
npm start
```

Leave the API terminal open. It should still respond at `http://127.0.0.1:3182/health` and `/ready`.

## Step 24 — Create your FIRST Domina account locally

Open a **second** terminal in that same `server` folder. Run:

```powershell
npm run setup:domina
```

The command prompts for your email, display name and a new password (twice). Password entry is **hidden**. Use a unique password of at least **16 characters**. Do not paste your password in GitHub, SQL Editor, screenshots or this chat.

For safety, this command only works **when the accounts table is empty**. It creates one Domina account using a randomly salted scrypt password hash. It does not create a web-accessible "create admin" endpoint.

## Step 25 — Verify local login

With the local API running, open the second PowerShell window inside the updated `server` directory and run:

```powershell
npm run check:login
```

Enter the new email and password in the terminal (password stays hidden). A success message should report `Role: domina` followed by a successful session logout. The test does **not** print the authentication token.

This initial API has three local-only authentication endpoints: `POST /auth/login`, `GET /auth/me`, and `POST /auth/logout`. Sessions expire after 12 hours and can be revoked by logout. There is a basic failed-login throttle; advanced rate limits, MFA, password reset and member-registration flows are not yet implemented. Do not expose these routes through Cloudflare.

**Do not enable the public Cloudflare route or move any Supabase records yet.** A local Domina sign-in does not mean the frontend is switched off Supabase. The account and character APIs, permission model, player migration and HTTPS/Cloudflare security still require implementation and testing.
