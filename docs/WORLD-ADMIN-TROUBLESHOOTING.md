---
aliases:
  - World Administration Repair
tags: [eclipse-order, operations, troubleshooting]
---

# World Administration — Editing & API Troubleshooting

This guide covers the World Administration map and editor introduced in migrations 041 and 042.

## Symptom: "The Order ledger is temporarily unavailable"

For map marker moves or icon changes, the frontend sends `PATCH /world-admin/settlements/:id/map`. Previously, the API CORS preflight allowed only `GET, POST, PUT, DELETE, OPTIONS`. Browsers blocked **PATCH** before sending it. The current API allows PATCH preflight as well.

A second possible cause is the Windows MySQL schema being older than the frontend/API. The updated API returns `world_setup_required` for missing world tables/columns and the UI explains the required migration steps rather than reporting a generic ledger error.

Other network failures (Windows service stopped, stale frontend URL, Cloudflare tunnel offline, wrong allowed origin, browser authentication) can also produce a similar banner. Don't assume those cases are a database error.

## Recovery checklist (Windows API host)

1. **Back up** the `eclipse_order` MySQL database and confirm you have restoration access.
2. Pull matching latest `main` frontend/API revisions. Check that the Windows API service uses that same revision.
3. From `server/`, run `npm ci` if dependencies changed, then `npm run setup:local`. It needs a local MySQL administrator password; never commit or post the password.
4. Verify migrations `041_world_administration_foundation` and `042_world_routes_garlean_weather` exist in `schema_migrations`.
5. Restart the **Windows Node API service**; updating GitHub Pages alone cannot fix API CORS methods or MySQL schema.
6. On the Windows host, confirm `http://127.0.0.1:3182/health` and `/ready` using your established local checks.
7. From the actual deployed web origin, test editing a region, settlement, icon/marker, and road. Inspect the browser Network panel for the `OPTIONS` preflight and the subsequent `PATCH`/ `PUT` request.
8. If failures remain, check the Windows service log for `[Eclipse Order API] Request failed: METHOD PATH CODE`. Share only the method, path and sanitized code; never share tokens, database passwords, request bodies or private member data.

## Security considerations

Only authorized command staff may edit world state; public/member reads must not expose hidden faction details. The migration is additive and does not delete existing settlements or positions. CORS is restricted to the configured website origin; it should **not** be opened to `*`.

## Related

- [[00-START-HERE|Documentation index]]
- [[LIVING-WORLD-TODO|Living World tasks]]
- [[LIVING-WORLD-WAR-COMMAND-MASTER-PLAN|Full design]]
- [[Operations/SERVER-README|Windows API setup]]
