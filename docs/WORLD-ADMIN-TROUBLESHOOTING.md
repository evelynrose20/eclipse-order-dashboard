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
4. Verify migrations `041_world_administration_foundation` through `046_world_zones` exist in `schema_migrations`.
5. Restart the **Windows Node API service**; updating GitHub Pages alone cannot fix API CORS methods or MySQL schema.
6. On the Windows host, confirm `http://127.0.0.1:3182/health` and `/ready` using your established local checks.
7. From the actual deployed web origin, test editing a region, settlement, icon/marker, and road. Inspect the browser Network panel for the `OPTIONS` preflight and the subsequent `PATCH`/ `PUT` request.
8. If failures remain, check the Windows service log for `[Imperium Noctis API] Request failed: METHOD PATH CODE`. Share only the method, path and sanitized code; never share tokens, database passwords, request bodies or private member data.

## Security considerations

Only authorized command staff may edit world state; public/member reads must not expose hidden faction details. The migration is additive and does not delete existing settlements or positions. CORS is restricted to the configured website origin; it should **not** be opened to `*`.

## Connected road and railway editor (migration 045)

The original smooth **Plan a route / Edit routes** tools use `world_route_nodes` and `world_route_segments`. The optional **Connect older routes** action transactionally imports the old `world_map_routes` records as network edges and removes those originals only after successful import. It retains route names, types, bends and endpoint links. Back up production MySQL before invoking it.

After pulling the matching frontend and Windows API revisions, run `npm run setup:local` in `server/` and restart the Windows service. Verify all versions 041 through **046_world_zones** exist in `schema_migrations`.

In the original territory map, choose **Plan a route** or **Edit routes**. **Plan a route** joins settlements or existing junctions; **Place junction** snaps onto existing nodes/sites/roads; **Branch from route** splits an existing graph segment into a shared vertex; **Move places** drags a junction while preserving attached route endpoints; **Edit routes** uses the original curved route and bend controls. Railway splits automatically create rail switch nodes. Nodes with attached edges cannot be deleted.

Map routes are drawn using SVG paths because they are editable geographic geometry; user-facing icons use the Font Awesome CSS/web-font library, not SVG icons.

## Related

- [[00-START-HERE|Documentation index]]
- [[LIVING-WORLD-TODO|Living World tasks]]
- [[LIVING-WORLD-WAR-COMMAND-MASTER-PLAN|Full design]]
- [[Operations/SERVER-README|Windows API setup]]

## Region and zone hierarchy (migration 046)

Each region now has a permanent **Regional Overview** zone, created automatically and populated with every existing settlement, road, rail segment, junction and mountain annotation in that region. This migration does not delete, reproject or merge existing geometry. New zones start empty, with their own optional HTTPS map background and independent Government, Control, Supporting Faction and territorial condition.

Use **World Administration → Region → Zone** to switch between zone maps. **New zone** creates a separate map. **Edit zone** changes its properties. **Add settlement** places a site on the currently selected zone. The smooth original road and railway editor remains the only map editor. Routes and junctions cannot cross between different zone maps; zones with map content cannot be deleted, and the overview zone is protected.

Back up MySQL, pull frontend/API together, run `npm run setup:local` inside `server/`, then restart the Windows API service. Verify `046_world_zones` in `schema_migrations` and test switching zone maps, site placement, road branches and independent ownership.

