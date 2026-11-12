# Eclipse Order API Control Center (Windows)

The Windows tray manager is a small local desktop control panel for the existing Node.js API and MySQL connection. It does not create a new public endpoint, modify database credentials or install SQL automatically.

## One-time installation

1. Install Node.js 22+ and Git on the Windows host. Keep MySQL configured as a **Windows service with Automatic startup** (Services → MySQL/MariaDB → Properties → Startup type: Automatic). Setting service startup may require administrator access. Ensure the database is restored and working before enabling unattended startup.
2. Keep the repository on the Windows machine, with a **private** `server/.env` and dependencies installed using `cd server; npm ci`.
3. From the repository, double-click **`tools/install-api-manager.cmd`**, or run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/install-api-manager.ps1`.
4. The control center starts immediately and a shortcut is created for the **current Windows user's sign-in**. You must log into that Windows account; this is not a boot-time Windows service.
5. Stop any other manually started `npm start` API instance first so two processes do not compete for port 3182. Keep the existing Cloudflare Tunnel installation and service running separately.

## Usage

- The app opens as a tray icon and has **Start**, **Restart**, **Stop** and **Open logs** actions. Closing the window minimizes to the tray; **Exit and stop API** exits the app.
- It checks local `/health` and `/ready` to distinguish a running Node process from a working MySQL connection. The MySQL service is **not** installed or managed by the app.
- It detects when **Git HEAD changes** after your own `git pull` (or `git checkout`) and restarts the Node API after that revision stays stable across two checks. It retries on API crashes. It does **not** run `git pull` itself or pull untrusted code.
- Logs are stored under `%LOCALAPPDATA%\EclipseOrder\ApiManager\logs` on the Windows PC, not in the public repo. Review logs locally; they can include sensitive diagnostic data.
- It does **not** automatically run `npm ci` or `setup:local`. After dependency or SQL changes, **back up MySQL**, run `cd server; npm ci; npm run setup:local` with the administrator password, and use Restart in the manager. Migrations remain manual because they can affect real member data.
- When the manager script itself changes on pull, exit and launch it again to load the new manager version. The live manager watches the API code revision but does not replace its own running PowerShell code.
- Keep the PC awake and the Windows account logged in for uninterrupted operation. If it is asleep, powered off, or logged out, API availability stops even if Cloudflare Tunnel reports healthy.

## Remove startup

Run `powershell -NoProfile -ExecutionPolicy Bypass -File tools/uninstall-api-manager.ps1`. That removes only the startup shortcut; it never deletes the database or API configuration.

## Troubleshooting

If the API is offline, use Open logs and check for missing Node.js, an invalid `server/.env`, or port 3182 already in use. If the API is online but the database is not ready, check the MySQL Windows service and private DB connection details; do not paste credentials into public issues or chat. Confirm `http://127.0.0.1:3182/health` and `http://127.0.0.1:3182/ready` on the Windows PC.
