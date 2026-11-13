---
tags: [windows, api, mariadb, operations]
---
# Installation, updates and debugging

**Two separate deployments:** GitHub Pages serves the React frontend; the **Windows Node API** connected to **MariaDB** is authoritative for login, world state, inventories and simulation. Pushing frontend code does not migrate the database or restart the local service.

## Safe update procedure

1. Back up the `eclipse_order` database before schema changes, and ensure you can restore it.
2. On the Windows API host, pull the same `main` revision as the website: `git pull origin main`.
3. From the repository root run `npm run setup:local`; equivalently use `npm --prefix server run setup:local` or `cd server && npm run setup:local`. This applies the repository's sequential SQL changes.
4. Confirm setup completes without errors, restart the Windows Node API service, then hard-refresh the site.
5. Check `/health` and `/ready` on the Windows API host. Verify an authenticated admin action from the correct public origin.

## Debug by subsystem

- **Frontend looks old:** check GitHub Pages job, browser cache, base path and committed frontend build.
- **New frontend but API responds 401:** inspect Discord login/session/membership, API route authorization and Windows API revision; do not fix by disabling authentication.
- **Missing columns / unknown SQL table:** Windows setup or service is on a different revision, or migration failed. Check its console output and schema migrations.
- **Production stopped:** inspect facility state, remaining input stock, worker count, fuel, project condition, map state, grid grade and last-cycle key.
- **Supply does not appear:** trace each ledger hop—facility → shipment → warehouse → civilian/Workshop stock as applicable.
- **No active project progress:** materials not committed, wrong cycle, insufficient workforce, paused simulation or wrong project type.
- **Discord users still approved:** confirm the Windows API process is running its membership sync, and that guild membership checks are available.

**Never** put passwords, tokens, private characters, consent details or production backups into the Git repository or docs. See [[WORLD-ADMIN-TROUBLESHOOTING]], [[WINDOWS-API-CONTROL-CENTER]], [[WINDOWS-SELF-HOSTING]], [[OPERATIONS]].
