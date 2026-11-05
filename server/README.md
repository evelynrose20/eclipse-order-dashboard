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
