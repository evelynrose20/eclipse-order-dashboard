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
