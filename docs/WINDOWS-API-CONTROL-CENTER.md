# Imperium Noctis API Control Center — no terminal required

The Windows Control Center starts with Windows sign-in and keeps the existing Node API running. **No PowerShell or npm window should remain open.**

## Install or upgrade the desktop launcher

1. `git pull` the latest `main` branch on the Windows host (the existing GitHub installation).
2. Right-click the old tray icon and select **Exit and stop API**.
3. Double-click **`tools/install-api-manager.vbs`**. This replaces the old startup shortcut with a silent Windows Script Host launcher and opens the Control Center.
4. On subsequent Windows sign-ins, Windows runs `tools/launch-api-manager.vbs` in the tray without a visible terminal. Double-click `launch-api-manager.vbs` to launch manually (it starts minimized); use `wscript.exe tools/launch-api-manager.vbs /show` to open the window immediately.
5. If you already used the earlier installer, **re-run this new installer once** to replace its startup registration. The old PowerShell shortcut is not silently switched until then.

The installer requires no machine-wide service changes. The Windows account must be signed in and the PC awake for the user-level manager to run. Cloudflare Tunnel remains managed separately.

## Database status and updates

- **API** shows whether local `/health` responds.
- **Database** shows whether local `/ready` can connect to MySQL. MySQL may be running inside XAMPP, Docker or another host; it does not need a recognizable Windows service name.
- **Database updates** compares the tracked SQL migration records in the local database against the scripts called by the repository's `setup-local.js`. It checks on startup and periodically. **Update required** means tracked schema versions are missing; **Current** means all tracked versions were found, not that every API functionality test passed. **Unknown** means the status could not be verified.
- **CHECK / APPLY DATABASE UPDATES** runs the existing SQL setup from inside the app. No npm terminal is necessary. First make a **verified restorable MySQL backup** (the app does not create backups). In the dialog, confirm the backup and either enter your *local MySQL administrator* password or explicitly check **My local MySQL administrator account has no password**. Password input is masked and sent over a private stdin pipe, not command arguments, environment variables or logs. Empty credentials are accepted only when that option is checked; no password is created or changed.
- The app temporarily stops its own API process while the migration runs, then restarts it if it was running. It stores logs locally under `%LOCALAPPDATA%\EclipseOrder\ApiManager\logs`. An error remains visible if migration fails. Never send logs with secrets or private member information to public issues.
- The manager does not automatically run schema migrations on every Git pull because a failed migration could damage production data. The **update status** tells you when manual approval and backup are needed. It also does not automatically install new npm dependencies after updates.

## API controls

**START**, **RESTART**, **STOP**, and **OPEN LOGS** remain available. Git HEAD changes from a manual `git pull` trigger an API restart after the revision stabilizes. A crash is retried automatically. Close the window to minimize to the tray; choose **Exit and stop API** to quit.

## Uninstall startup

Run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/uninstall-api-manager.ps1`, or delete the **Imperium Noctis API Control Center** shortcut from the Windows Startup folder. Uninstalling does not affect your database or secrets.

## Troubleshooting

### Port 3182 already in use (EADDRINUSE)

If a previous `npm start`, Node process, or Windows service is already listening on port **3182**, the Control Center now detects it before launching a duplicate. It reports **ONLINE - EXTERNAL PROCESS** if that process responds to the API health check, or **PORT IN USE** otherwise. It will not kill an unknown process. To let the Control Center own the API, stop the old manually started Node server or its service, then press **START**. Do not run `npm start` in a terminal while the Control Center manages the server. Database updates are blocked while another server owns the port.

To identify the listener locally, use Windows Resource Monitor (Network → Listening Ports) or `Get-NetTCPConnection -LocalPort 3182 -State Listen | Select-Object OwningProcess`. Check the PID's command before ending anything. No automatic kill is performed.


- If **Database connected** but **Database updates unknown**, the connection may lack permission to read `schema_migrations`. Check local logs and the configured database user.
- If **Update required**, use the in-app button only after backing up, then confirm the status becomes **Current**.
- If the old Windows PowerShell window remains open, it belongs to the older manager instance: exit it through its tray menu, then run the new VBS installer.
- Keep `server/.env` private and MySQL bound to localhost. Do not expose the management app to the internet.
