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
> A draft implementation on `feature/garlean-civic-needs-p2` adds configurable monthly Garlean climate curves, dated DM weather events/forecast, a separate staff-owned civilian stock ledger, monthly food group history, cohort registration, adjustable simulation thresholds, explicit preview/commit, bounded civic score changes, idempotent settlement/date cycles and an incident approval queue. All writes are command-only and audited. **The code implementation passes CI, including MySQL schema tests; live Windows/browser acceptance remains separate.** Added atomic transfers from unreserved shared Order workshop stock to civilian stores, without touching player- or front-reserved stock. Implemented manual recurring aid contracts from unreserved shared stock and cohort editing; still outstanding: front/character-owner-approved transfers, unattended delivery dispatch (intentionally off), live browser acceptance and essential-service consumption; settlement-specific weather microzones and weather-adjusted transport; practical MySQL/browser/permission acceptance, including backing up production before migration. No scheduled auto-ticks, surprise confiscation, automatic riots or player punishment are introduced.


- [x] Real-calendar, deterministic fictional Garlean seasonal temperature and conditions.
- [x] Fahrenheit presentation with seasonal/manual weather selection.
- [x] Civic outlook preview: food shortage, diet monotony, heat demand and unrest risk.
- [x] Per-region configurable seasonal climate curves, microclimates and DM weather events.
- [x] Climate profile, ten-day forecast, dated event overrides, recorded civic-cycle outlook/temperature history, and insulation/fuel/heating-facility model.
- [x] **Real** item-based civilian deliveries and storage, shared-Order-stock atomic transfers, category diversity over rolling monthly windows. Personal/front stock remains reserved unless separately authorized.
- [x] Editable population cohorts, employment, housing, public health and essential water/medicine consumption.
- [x] Editable heating facilities (operational/damaged/offline), climate-adjusted coverage and fuel consumed from civilian stockpiles.
- [x] Configurable food/variety thresholds, seasonal heating demand and bounded civic stability pressure.
- [x] Civic unrest-risk scoring and optional grievance/petition/strike proposals with explicit DM approval. No major outcome is automatic.
- [x] Opt-in off/narrative/managed/detailed modes, safe grace periods, caps, pause, dated idempotent **staff-triggered** cycle commits. No unattended punitive reset jobs; manual authorization is intentional.
- [x] Staff-facing alerts for essentials shortages, cold snaps, heating/public-works deficits and relief needs.

## P3 — Sites, industry and projects

- [x] Create facility/industry templates with zero code changes.
- [x] Resource/item catalog linked to existing workshop/inventory.
- [x] Inputs, outputs, byproducts, labor, heat/power, capacity, upgrade requirements.
- [x] Versioned declarative condition/action rule builder, dry runs, circular dependency checks.
- [x] Construction Projects linked to facilities and territories.
- [x] Reserved personal/front goods distinct from committed campaign materials.
- [x] Atomic production ledger and configurable production cycles with caps.
- [x] **MySQL acceptance test:** voidsent mine liberated → repaired → staffed → ore produced.
- [x] **MySQL acceptance test:** ceruleum rig captured → drilling plant rebuilt → refining enabled → fuel delivered by explicit facility stock handoff (P4 transport simulation is separate).

P3 implementation notes and Windows rollout checklist: [P3-INDUSTRY.md](P3-INDUSTRY.md). Code and disposable-MySQL test coverage complete; live Windows acceptance remains outstanding.

## P4 — Logistics, trade and transports

**Substantial P4 mechanics now implemented on main (migrations 087–096), with live Windows/browser acceptance still outstanding.** Supply Command defaults to a territory-centered strategic view, with original workshops, sites, NPC farming, internal rail, diplomacy, military installations and the Merchant Exchange still accessible as their own systems. The screen was protected by a render error boundary and a regression test after a `npcRoutes` initialization bug caused the grey-screen crash.

- [x] **Cargo simulation:** Commissioned vehicles, cargo limits, route previews, actual facility stock/fuel deductions, uniquely keyed manifests, timed arrivals, replay-safe receipts and returns; never consume privately reserved goods.
- [x] **Configured rail services:** Freight uses menu-based Internal Rail Logistics service routes, not mandatory physical mapped rail stations. Existing train services and journeys remain intact.
- [x] **Inter-region connections:** Planned/operational/damaged/closed cross-region corridors, with multi-corridor routing. Commissioning and repair require actual industrial material stock from endpoint facilities. This is a deliberate connection system, not imaginary automatic roads between regions.
- [x] **Independent mapped industrial sites:** Site facilities can build same-zone, same-faction depot access links to settlements and use their constructed transport hubs for freight. Link travel time/fuel counts. No new map markers or duplicate farms are generated.
- [x] **Supply incidents:** Snow and blizzard conditions can stop a convoy at arrival; the shipment remains reserved. Command chooses shelter (3-hour delay) or a shorter escorted journey with an available operational garrison. No automatic casualties or loot drops.
- [x] **Cross-faction permissions:** Bilateral proposed/active/suspended/retired trade treaties, requiring existing diplomatic trust and tension levels for ratification. Unapproved cross-faction freight is blocked.
- [x] **Civilian food/medicine/fuel:** Staff can hand received freight into the settlement welfare ledger with an idempotent receipt and storage checks.
- [x] **Military supplies:** Staff can transfer arrived industrial ammunition to the actual castrum store at the destination, only once per shipment.
- [x] **Winterization:** New Order civic insulation projects require manufactured `freight-insulation` panels from industrial inventory rather than workshop materials; historical projects keep their prior requirements.
- [x] **Bounded NPC relief:** NPC-controlled settlements with automatic simulation can send genuine surplus food to other NPC settlements needing it, using actual food reserves, population/workforce-limited pack caravans and existing mapped connections. Cross-faction movement requires an active treaty; deliveries remain in transit until received.
- [x] **Recurring agreements:** Staff can opt in per contract to real stocked, capacity-checked automatic freight. They start OFF, and do not create unlimited goods.
- [x] **Strategic gameplay interface:** Mapped settlement supply status, road bends/backgrounds, internal rail services, active industrial/food convoys, NPC farms, merchant contract demand, military and welfare alerts, and direct navigation to preserved specialized workspaces.
- [ ] **Still outstanding:** Full assembled-train-consist linkage and location tracking across both rail journey and freight manifests; NPC caravan returning/redirecting after blocked delivery; cross-region mixed-mode route handoff; operational ships and pack-animal production; dynamic escort combat/vehicle condition and weather damage; rich NPC diplomatic bargaining and pricing; owner-authorized private front cargo; fully unified order/market delivery accounting.
- [ ] **Deployment acceptance:** Backup MariaDB, run Windows setup through migration 096, restart API, complete a populated browser screenshot/control audit, test interrupted transports and concurrent dispatches on live-equivalent data. CI success is not proof of this production check.

[Detailed implementation and rollout](P4-LOGISTICS.md).

### P4 visual integration — Supply Command

- [x] Default strategic territory command instead of the old blank shipment register, with specialist freight tabs retained.
- [x] Read-only overlays for territorial routes, industry facilities/stores, NPC farming and food relief, railway journeys, merchant exchange demand, fronts and castrum installations.
- [x] Existing map imagery and road junction geometry reused, with safe fallback if the overlay fails to render.
- [ ] Final populated-browser visual acceptance remains required; do not mark it done solely because builds pass.

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

### Settlement infrastructure & welfare usability (2026-11-08)
- [x] Empty settlements have **no civilian provisions requirement, food shortage, heating demand, water/medicine consumption, or civic unrest pressure**; existing stocks remain intact.
- [x] Population increases require available housing capacity. New empty settlements start with no homes; existing residents retain baseline housing during migration 052. Occupied housing cannot be destroyed or removed until residents are accommodated.
- [x] Editable physical settlement upgrades: housing, defenses, clinics, waterworks, granaries, insulation and public works, with planned/building/operational/damaged/destroyed states and scaled effective benefits.
- [x] Civic Welfare reorganized as a compact tabbed staff workspace. Weather editing is collapsed; player-facing civilian information remains readable.
- [x] New MySQL migration 052 and integration/unit coverage. Windows API must run setup and restart to load the schema.

### Living settlement autonomy & NPC observatory (2026-11-08)
- [x] Staff-only **NPC Settlements** screen separated from Order/unclaimed settlement management, with faction, region, population, employment, supply indices, construction queue, journal and trend view.
- [x] Windows API automatic clock (once-per-minute poll; one idempotent cycle per eligible cadence window) with restart-safe history and no catch-up flood. NPC-controlled settlements automatically begin simulation; unclaimed sites remain untouched.
- [x] Faction ownership boundary guards: changing between Order and NPC control disables prior automatic permissions until staff explicitly re-enables them. Changing NPC factions keeps the independent NPC cycle.
- [x] NPC-local abstract production/consumption, housing-limited migration, gradual employment, material/service shortages, stability, and nonviolent construction/milestones. **NPC resource indices never consume Order shared stock.**
- [x] Order settlement autonomy is opt-in and off by default; region/settlement/civic policy must all enable it. Order cycles use real civilian stock and existing civic-cycle duplicate guards. Construction uses actual workforce and optionally configured unreserved shared materials, with one-time recorded debits.
- [x] Slow, normal and fast NPC cadence; slow or normal Order cadence. Staff pause and stop options.
- [x] Dated history records for every committed autonomous cycle; no automatic territory swaps, raids, riots, casualties, or political outcomes.
- [ ] Live Windows service acceptance after running migration 053 and restarting API; CI test database is not the live server.

### P4 visual integration — Supply Command (2026-11-09)
- [x] Make Logistics & Freight open to a strategy-game supply command overview rather than a blank shipment register. Preserve shipment/contract/transport/history tooling under dedicated tabs.
- [x] Pull read-only signals from the existing territorial map, industrial facilities and actual stocks, NPC farm routes/cargo/warehouses, operational Internal Rail Logistics stations and trains, Merchant Exchange demand, Order fronts, and castrum/military installation records.
- [x] Match the region's existing map background, stored road and junction bends, user-placed settlements, and map rail services; show active freight and NPC route overlays without reviving removed track/station editing.
- [x] Selecting a mapped settlement exposes local needs, warehouses, garrisons and industry with a targeted freight-dispatch entry where a destination facility exists.
- [ ] Finish *mechanical* integration still outstanding: production-to-contract planning, NPC political trade permissions, front-authorized reservations, escorts, weather interruptions, cross-region multimodal routing, rail train cargo linkage, and industrial insulation construction. This overview reads pre-existing systems; it does not claim all of them share one transaction engine.
- [ ] Verify map and command layout on the live frontend with actual populated world data; automated tests do not constitute a browser screenshot review.
