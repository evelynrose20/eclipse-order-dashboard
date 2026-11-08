---
aliases:
  - Living World TODO
  - War Command Roadmap
tags:
  - eclipse-order
  - living-world
  - roadmap
status: active
updated: 2026-11-07
---

# Living World & War Command — Implementation Tasks

> [!note] Status rules
> Checked means implemented **in repository**. Live deployment, permissions, and RP acceptance need separate verification. Keep this list updated when code merges. Do not mark a feature done just because it is designed.

**Design:** [[LIVING-WORLD-WAR-COMMAND-MASTER-PLAN]]
**Vault home:** [[00-START-HERE]]
**Current phase:** World Administration / interactive map foundation.

## P0 — Fix live editing and improve map

- [x] Permit PATCH in Windows API CORS preflight for map marker edits.
- [x] Return helpful `world_setup_required` when world schema migration has not been applied.
- [x] Add route/method to safe server diagnostic log for failed requests (no SQL/secrets exposed).
- [ ] **Verify against actual running Windows API:** migrate database, restart Node service, edit a region, edit a settlement, move a marker, change its icon, create/edit/delete a road from the deployed frontend.
- [ ] Test on desktop browser and mobile; confirm Cloudflare and origin settings.
- [x] Improve territory map presentation with Garlean terrain/contours, better roads, map key, location marker states and clearer editing workflow.
- [ ] User screenshot review and follow-up visual polish after deployment.

## P1 — World registry and mapping

- [x] Store editable regions linked to settlements (migration 041).
- [x] Link settlements to Factions of the Realm by faction IDs (government/controller/support).
- [x] Create/edit world records with command permissions.
- [x] Separate settlement/civilian overview from visual territory map.
- [x] Drag saved site markers and change their symbols without changing other settlement state (migration 042).
- [x] Create roads/trails/rail/sky/water links with manually adjustable bends.
- [x] Region/zone hierarchy, separate zone navigation and independent HTTPS map backgrounds (migration 046).
- [x] Add persistent mountain-range map annotations, with editable named ridgelines.
- [x] Expose territorial status directly on colored settlement map markers and provide a quick status selector.
- [x] Register the Eclipse Order itself as a selectable, database-backed governing/control/support faction.
- [x] Add Secure, Abandoned, and Destroyed settlement conditions without changing owner/controller.
- [x] Add explicit route drafting, a selectable existing-route registry, draggable/insertable bends, editing route types and railway cartographic tracks.
- [x] Shared road junctions/rail switches independent of settlements, allowing saved route branching and splitting.
- [x] **Superseded/archived:** visual railway stations, rail switches, crossings and map track management (migrations 045–048). Existing records preserved, but the map controls are removed by request.
- [x] **Internal Rail Logistics (migration 049):** staff-only menu tabs for named stations at Order settlements/fronts, configurable services, timed train dispatch and journey progress/history with train icon (no map-based tracks).\n- [ ] Inventory-safe cargo manifests, reserved front stock, fuel and automatic delivery settlements (future P4; current train operation is schedule/RP tracking only).
- [ ] **Deferred by request:** ownership polygons/borders are unnecessary for the current compact maps.
- [ ] **Deferred by request:** separate public/secret map layers are unnecessary for the current maps.
- [ ] Multiple supporting factions, separate beneficiaries/protectorates and territorial history.
- [ ] Route graph distances, traversal constraints, bridge access and passability.
- [ ] Upload-map-image workflow and image storage policy.
- [ ] Object template/instance editor (site types, reusable icons and configurable metadata).
- [ ] Map object deletion/archiving with dependent-route validation.

## P2 — Garlean climate and civilian needs

> [!important] P2 feature branch review (2026-11-08)
> A draft implementation on `feature/garlean-civic-needs-p2` adds configurable monthly Garlean climate curves, dated DM weather events/forecast, a separate staff-owned civilian stock ledger, monthly food group history, cohort registration, adjustable simulation thresholds, explicit preview/commit, bounded civic score changes, idempotent settlement/date cycles and an incident approval queue. All writes are command-only and audited. **Do not mark the P2 boxes complete until the PR is verified and merged.** Added atomic transfers from unreserved shared Order workshop stock to civilian stores, without touching player- or front-reserved stock. Still outstanding: front/character-owner-approved transfers and dedicated recurring delivery contracts; comprehensive cohort editing and essential-service consumption; settlement-specific weather microzones and weather-adjusted transport; practical MySQL/browser/permission acceptance, including backing up production before migration. No scheduled auto-ticks, surprise confiscation, automatic riots or player punishment are introduced.


- [x] Real-calendar, deterministic fictional Garlean seasonal temperature and conditions.
- [x] Fahrenheit presentation with seasonal/manual weather selection.
- [x] Civic outlook preview: food shortage, diet monotony, heat demand and unrest risk.
- [ ] Per-region configurable seasonal climate curves, microclimates and DM weather events.
- [ ] Forecast/outlook history, climate profiles and insulation/fuel/heat model.
- [ ] **Real** item-based food deliveries and storage, category diversity over rolling monthly windows.
- [ ] Population cohorts, employment, housing, public health and essential services.
- [ ] Civilian heating infrastructure and fuel consumed from real stockpiles.
- [ ] Configurable food adequacy/variety thresholds and seasonal civic satisfaction.
- [ ] Simulated unrest states (grievances/petitions/strikes); DM approval for major outcomes.
- [ ] Opt-in narrative, managed and detailed simulation; safe grace periods, caps, pause, idempotent reset jobs.
- [ ] Alerts for shortages, cold weather, public works and relief opportunities.

## P3 — Sites, industry and projects

- [ ] Create facility/industry templates with zero code changes.
- [ ] Resource/item catalog linked to existing workshop/inventory.
- [ ] Inputs, outputs, byproducts, labor, heat/power, capacity, upgrade requirements.
- [ ] Versioned declarative condition/action rule builder, dry runs, circular dependency checks.
- [ ] Construction Projects linked to facilities and territories.
- [ ] Reserved personal/front goods distinct from committed campaign materials.
- [ ] Atomic production ledger and configurable production cycles with caps.
- [ ] **Acceptance test:** voidsent mine liberated → repaired → staffed → ore produced.
- [ ] **Acceptance test:** ceruleum rig captured → drilling plant rebuilt → refining enabled → fuel delivered.

## P4 — Logistics, trade and transports

- [ ] Configurable transportation templates (freight truck, railway, airship, ships, pack animals).
- [ ] Routes and transport pathfinding using territory roads.
- [ ] Convoy manifest, cargo capacity, escort, fuel, vehicle readiness, idempotent dispatch/delivery.
- [ ] Regular shipments, emergency aid, faction support agreements and custom trade contracts.
- [ ] In-transit inventory and destination receipt; no double-spending or double delivery.
- [ ] Weather disruptions and DM-created convoy events.

## P5 — Military forces

- [ ] Editable formations and NPC troop/vehicle counts; staff permissions.
- [ ] Tanks, magitek walkers and custom vehicle templates.
- [ ] Unit readiness, training, morale, repairs, supplies and stationing.
- [ ] Movement and territorial defense with logistics costs.
- [ ] DM-approved casualties, equipment loss and deployment outcomes.

## P6 — War Command and politics

- [ ] Campaign lifecycle: draft, mobilization, active, paused, armistice, resolution, archive.
- [ ] Campaign-scoped commanders, quartermasters, operation DMs, audit.
- [ ] Reuse Events/Encounters & Dice for operations, signups and combat.
- [ ] Campaign chapters, optional branches, hidden objectives and unlock rules.
- [ ] Outcome proposals with approval queue and transactionally applied effects.
- [ ] Terrain/fortification/supplies/intelligence influence choices, not automatic RP results.
- [ ] Existing Senate integration: appropriations, treaties, war debates, Domina ratification.
- [ ] Diplomatic treaties and faction settlements without forced automatic political control.
- [ ] Permanent war archive, reconstruction and postwar relief.

## P7 — Dashboard, reliability and release

- [x] Group sidebar into World & Territory and Industry & Logistics hubs.
- [ ] Unified dashboard information architecture once the full world features grow.
- [ ] Shared responsive components, accessibility, keyboard/drag alternatives, screenreader route labels.
- [ ] Admin preview/draft/publish, version history, audit explorer.
- [ ] Unit and MySQL integration tests for every simulation transaction and read ACL.
- [ ] End-to-end browser tests for settlement edits, roads, factions and permissions.
- [ ] Windows service deployment instructions, backup/restore dry run, secrets isolation.
- [ ] Performance tests with hundreds of locations, routes, site types and NPC cohorts.

## Transport network editor — released on main
- [x] Font Awesome web-font icons for major site and dashboard controls; map facility icon picker includes lumber yards, logging, sawmills, quarries, rail stations and more.
- [x] Authenticated road/rail graph tables with shared junctions and rail switches (migration 045).
- [x] Create branches, snap to existing nodes and route segments, split segments at saved junctions, move a junction and retain all attached connections.
- [x] Preview and save road, trail, air-route and waterway edges with editable bend points. Former rail geometry is archived and no longer edited via the map.
- [x] Explicit transaction-safe conversion of older settlement-to-settlement routes without losing waypoints or track types.
- [x] MySQL 8 integration tests covering junction splits, branches, moves and import.
- [ ] Production Windows API migrations through 049 and browser acceptance test: menu stations, timed train dispatch, visible train progress, plus unchanged road/mountain maps.

## Current release checklist

- [ ] Back up production MySQL.
- [ ] Pull latest matching frontend and Windows API code.
- [ ] Run `npm run setup:local` inside `server/`; verify migrations 041–049, including 049_internal_rail_logistics.
- [ ] Restart Windows API service (not just GitHub Pages redeploy).
- [ ] Browser test creating stations at Order-controlled settlements/fronts, same-zone/cross-zone/cross-region rail services, live progress, arrival and cancellation.
- [ ] Test map status labels (peaceful/contested/occupied/liberated/rebuilding), draw/edit/delete mountain ranges, and save Order authority in all three settlement relationships.
- [ ] Confirm master plan and this checklist are readable in Obsidian.

## Working principles

- Templates and data-driven configuration for ordinary new RP content.
- The Domina controls IC war declarations; OOC moderation and consent remain independent.
- No hidden edits to player or business-front inventory.
- Major territorial/civic/military losses require authorization; never run punitive offline cascades.
- Keep **world state**, **site control**, **government**, **support**, and **faction reputation** distinct.

- [x] Searchable Font Awesome map icon picker with user-entered safe Free Solid names and expanded forestry, ceruleum, rail and military site categories (no schema changes).
