# P4 — Logistics, Trade & Transport (Windows API)

## Scope and user workflow

The **Industry & Logistics → Logistics & Freight** sidebar workspace is for Domina / High Command, next to existing **Trade Routes** (player contracts) and **Internal Rail Logistics** (train service scheduling). No duplicate map editor or purple theme is added.

### First use

1. Run migrations 087–096 with `npm run setup:local` under `server/` **after backing up the live MariaDB database**. Run the full setup; the migration chain is additive and re-runnable. Restart the Windows API process afterward, then refresh the hosted frontend.
2. Create or select an existing **settlement-linked industrial facility** at origin and destination. Goods must already exist in the real `world_industry_stock` inventory. Neither player-reserved workshop materials nor front reservations are borrowed.
3. Produce and commission a suitable transport through **Magitek & War Stores**. Assign its equipment inventory lot to the **origin settlement**; the lot's recorded `cargo_capacity` and quantity limit the actual payload.
4. Register a transport type in Logistics & Freight. Select road, rail, air, sea, or pack, set cargo capacity, time per leg and real fuel consumption. The first operational freight fleet is road/rail/air using commissioned equipment; sea and pack templates are preparatory until matching assets are modeled.
5. Draw/create real road/trail/skyway/waterway connections using the existing territory route editor. For rail, **use the existing menu-based Internal Rail Logistics station services**, including cross-zone and cross-region services—do **not** reintroduce track or railway station placement on the map.
6. Use **Dispatch freight** and **Check mapped route**. Select source/destination, material, quantity and commissioned equipment lot. On confirmed dispatch, stock and fuel are deducted transactionally and the cargo is stored as *in transit*.
7. The Windows service checks due deliveries on its persisted simulation clock (every minute). Once due and safe to receive, cargo is deposited exactly once in the destination industrial facility. A control/condition change can hold a shipment for staff review; no automatic losses are applied.
8. For food, medicine or fuel, click **Supply civilians** on an arrived shipment to transfer cargo from the destination industrial depot to actual `world_civic_stock`. Eligible item classifications are managed in **Civic goods**. Ceruleum fuel and basic freight food/medicine items are preclassified; their production must still consume real industry inputs.

### Recurring contracts

Trade, relief, military and industry agreements store a recurring cadence, cargo, source, destination and transport template. **Dispatch due cargo** remains available as a manual action. An officer may alternatively select a commissioned stationed vehicle and explicitly **Enable auto** per agreement; this is OFF by default. The Windows clock dispatches at most one eligible shipment per cadence using the same stock/fuel/capacity checks and idempotency key. If stock, fuel, an available vehicle or the route is missing, no shipment is created. Use Disable auto, Pause/Resume or Retire at any time.

### Safety and audit

- Transactional `SELECT ... FOR UPDATE` protects source material, fuel, destination receipt, equipment lot, contract status and shipment state.
- Every dispatch includes a unique idempotency key; a retry returns the previously recorded shipment rather than removing stock again.
- Cargo is in **exactly one state**: source stock before dispatch, locked to the shipment while traveling, or destination stock after arrival. An interrupted convoy remains in transit but cannot auto-arrive until resumed.
- Recall returns cargo to its source and does not refund spent fuel.
- Industrial ledger actions identify freight dispatch, fuel use, arrival, recall and civic handoff. Civilian stock receives a matching civic movement; a unique receipt record prevents repeated civilian credit.
- No wallet, player goods, private fronts, unrestricted staff inventory minting or automatic civilian harm is part of this delivery flow.
- Automatic system receipts use no human actor identity.

### Route constraints

Ground paths use **actual road/trail nodes and segments**, falling back to saved legacy map roads when necessary. Air/sea need explicit compatible drawn links. Rail freight uses **operational Order internal rail services** connecting selected settlement stops; it does not require physical map-track geometry. Local transfers between facilities at the same settlement are supported. General cross-region road/sea/air, unanchored independent production sites and NPC faction-owned autonomous trade remain future work; they are not silently treated as connected.

### Data ownership

| Record | Owner |
|---|---|
| Items, fuel, source/destination stock | `world_industry_items`, `world_industry_stock` |
| Vehicles and their manufacture | `world_magitek_equipment_inventory`, equipment templates |
| Road / map edges | `world_route_segments`, `world_map_routes` |
| Menu railway service | `order_internal_rail_routes`, `order_internal_rail_stations` |
| Freight types | `world_logistics_transport_templates` |
| Agreements | `world_logistics_contracts` |
| Transit manifests | `world_logistics_shipments` |
| Activity audit | `world_logistics_events` and `world_industry_ledger` |
| Civilian item approvals / receipts | `world_logistics_civic_item_types`, `world_logistics_civic_receipts` |
| Civic welfare stock | `world_civic_stock`, `world_civic_movements` |

### Acceptance checks before considering P4 live

- Back up real MariaDB; run `npm run setup:local` inside `server/`; restart the API service.
- Run repository `npm ci && npm test && npm run build` and server `npm ci && npm test`, including MySQL integration in CI.
- Verify two valid linked facilities, enough actual inventory, a commissioned vehicle lot, and a compatible route.
- Verify a duplicate dispatch key does **not** duplicate stock deductions; a second arrival does **not** duplicate destination stock; a second civic handoff does **not** duplicate fuel or food.
- Verify insufficient cargo/fuel, missing road, invalid vehicle class, vehicle already traveling, broken facility, and missing permissions fail without changing any stock.
- Verify automatic arrival after due on the Windows service and no catch-up flood after restart.
- Verify the existing Internal Rail menu remains intact, the territory map rail lines remain visible, and no old projects, fronts or archives were reset.
- Confirm the Logistics UI matches `docs/DASHBOARD-DESIGN-RULES.md` in full, with no pink/purple standalone panels.

## Outstanding P4 scope

This is **not the entire planned P4 simulation**. Remaining work includes NPC political/economic trade agreements, generalized cross-region air/sea/road and site-to-site routes, asset models for ships/pack animals, physical escorts, weather-based delay/damage and DM event queues, industrial insulation material consumption by civic projects, faction-approved access to reserved front goods, and comprehensive live deployment acceptance. Update `docs/LIVING-WORLD-TODO.md` rather than checking those features prematurely.

## Strategic Supply Command overview

The Logistics & Freight page now defaults to **Supply Command**, a read-only strategic overlay over existing world systems. It uses current World Administration region and zone data, saved map background imagery, stored road bends/junctions and settlement pins. It shows manufactured freight movements, menu-based internal rail services and running trains, NPC mapped-farm cargo, civilian food/heat alerts, industrial facility stores, military castrums, merchant exchange demand and Order fronts. Selecting a location offers a targeted freight manifest if that location has an industrial destination facility. Other controls open the existing World Administration, Internal Rail Logistics, Merchant Exchange and Order Fronts screens without replacing or deleting their histories.

**Important boundary:** Visibility and navigation are integrated, but the older specialized systems still retain their own transaction rules. NPC agricultural shipments, player-front market contracts and staff rail journeys have **not** been silently rewritten as world-logistics manifests. Their common simulation/ownership rules and weather/escort/multimodal transport remain ongoing work. The strategic view is not a replacement territory editor and does not create map objects.

## Expanded strategic transport and gameplay (migrations 091–096)

- **Regional corridors (091):** Create planned transport links between existing settlements. Each route has an explicit mode, time, material cost and operational/damaged/closed state. Real stock at an endpoint facility is consumed when commissioning or repairing. Only operational links are eligible for cross-region pathfinding.
- **Weather decisions (091):** Severe snow or blizzard can interrupt a shipment on arrival. Command may wait three hours or order an expedited 30-minute continuation only if an actual operational garrison is available. Goods remain reserved while held; the same shipment does not trigger the same recorded incident again.
- **Military logistics (092):** Arrived freight can be credited once to ammunition stores of the actual matching castrum after a destination depot stock debit.
- **Diplomatic access (093):** Transport across faction boundaries is denied unless a bilateral treaty is active, requiring trust >=40 and tension <=65 at approval. The treaty itself does not produce goods or compel NPC agreements.
- **Independent facilities (094):** Mapped farms and industry sites without a settlement attachment can plan and build an access link to a same-zone, same-faction settlement hub. Material construction costs, access travel time, damage and closures constrain use.
- **Civic insulation (095):** New Order insulation civic construction uses real industrial insulation panels and a dedicated progress requirement. Existing workshop-based projects remain undisturbed.
- **NPC food redistribution (096):** Autonomous NPC settlements with food surpluses, available workers and connected pack routes dispatch bounded food relief to other NPC settlements experiencing shortages. The origin loses stock at departure; the destination gains it only on delivery. Cross-faction moves require a treaty. Blocked deliveries hold their reserved goods, which still needs a formal recall/reroute workflow.

**Limitations deliberately retained:** NPC food relief is not a complete price-based cross-faction barter market. Railway freight still uses manufactured locomotive lots and existing rail services, but does not yet fully reserve a complete composed train consist across both rail systems. Ships and pack animals are not yet production-tracked assets. Front-reserved or personally owned cargo requires separate owner authorization before any future transfer route. This iteration should not be described as the entire living logistics simulation until these links and live browser acceptance are finished.

**Required deployment:** Backup production MariaDB first, pull `main`, run `npm run setup:local` in the Windows `server` directory, restart the API service, then refresh the deployed site. Production behavior has not been verified merely by GitHub CI passing.

## Rail freight and NPC caravan recovery (097–098)

A rail freight manifest now selects a **running assembled train journey**, not a standalone locomotive lot. The API checks the pre-existing internal railway route, origin/destination settlements, departure/loading window, wagon cargo-capacity snapshot and cargo already assigned to that train. Receipts follow that journey's scheduled arrival and cancelled runs place undelivered freight on hold. This does not replace the separate Internal Rail command, create new trains, or transport goods without an inventory debit.

NPC relief caravans that cannot deliver are held with their original food reservation intact. They can redirect once along mapped pack/trail roads to another needy NPC settlement only if capacity and faction treaty permissions allow; otherwise a delayed, capacity-checked return restores the same goods to their origin. Each change is recorded in the NPC caravan event history. Full rail train-location simulations and complex intermodal handoffs remain incomplete.

## Fleet-backed command UI (099)

Transport profile registration now starts from real manufactured equipment stock and assembled Order trains. The UI lists the pinned cargo capacity and fuel specification, not editable numbers. The server verifies a non-damaged, non-retired Order lot or assembled consist and records its source reference; historical templates stay available for compatibility with earlier agreements. New profiles cannot be invented without corresponding fleet stock. Actual dispatch still requires stationed equipment (or a running train journey) and enough fuel and cargo capacity.

The supply theater now uses a larger map with timed icons for in-transit freight, running Order trains and mapped NPC farm/caravan shipments. Markers follow saved graph segments and legacy road bends where available, with a direct endpoint interpolation fallback for paths whose geometry is not in the selected zone; those positions are visual progress estimates, not independently simulated vehicle physics. Held journeys stop moving. The new trade agreement and treaty dialogs use location/faction selection and contextual stock or diplomatic data; neither interface changes the underlying territorial or stock rules.
