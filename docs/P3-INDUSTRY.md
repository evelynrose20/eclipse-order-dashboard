# P3 — Sites, Industry and Projects

## Model and boundaries

Industrial facilities can attach **either to an existing settlement or to an independent mapped industrial site** (farm, ranch, lumberyard, quarry, mine, refinery, workshop, plant or other). Independent sites have their own region, zone and map marker, but no fictional civilian population; their controlling faction comes from the territory at creation. A facility records its own operator at creation; changing the settlement's controller freezes production and construction until staff acknowledges the capture. The acknowledgment deliberately sets the facility to **Captured** and production to **Off**, without rewriting territory, characters or inventories.

The staff-only **World Administration → Industry & Projects** workspace separates **Order-controlled**, **NPC-controlled**, and **Unclaimed** facilities and projects. It has compact **Sites & production**, **Facility templates**, **Construction projects**, **Item catalog**, and **Production history** tabs.

## Author new facilities without deploying code

1. Use Item catalog to add any raw, refined, fuel, supply, or byproduct item. Optionally link it to an existing workshop material.
2. Create a Facility template with inputs, outputs, byproducts, worker/heat/power demands, operations per cycle (maximum 1,000), and required site level (1–20).
3. Add declarative rules under Condition & action: comparisons against status, level, workforce, heat, power, capacity, population, stability, or security. Actions are Allow, Block, or a bounded output multiplier. Predicates are data, not scripts. The server validates them and rejects circular input/output dependencies, including active pinned template versions.
4. Use the dry-run scenario to check sample worker, input, heat and power availability before publishing.
5. Publishing a revision creates an immutable template version. Existing facilities retain their previously selected version and recipe.

## Facility life cycle

A captured or ruined facility must be explicitly marked **Liberated** by staff. Create an industrial construction project linked to that facility. Projects have material needs, labor required and a completion result. Staff may optionally attach an existing Order campaign construction project for narrative/project coordination. This does not automatically reuse or double-count contributions made to that other project.

The industrial project receives resources **only when explicitly committed**. Sources:
- **Facility stock:** physically move an item into the committed project allocation.
- **Unreserved Order workshop stock:** debit shared workshop stock with an existing workshop ledger entry.

Personal or front-reserved goods are **not** visible or accessible through industrial contribution endpoints. The existing construction system has its own intentional, character-authorized reserved-material contributions; it is not silently depleted by P3.

A project advances at most once daily from assigned facility workers after its material requirements are fully committed. On completion, the project sets the explicitly configured facility state (for example, Operational). Captures and territorial ownership changes do not occur automatically.

## Production and stocks

Industry requirements are defined by the published template: **workforce needed**, **heat needed**, **power needed**, inputs and maximum capacity. Staff cannot type an arbitrary available workforce, energy balance, facility level or capacity into a live site. Available staff are calculated from the zone's simulated settlement workforce of the same controlling faction and allocated across active facilities. Utilities consume actual \`ceruleum-fuel\` in the facility inventory (one fuel unit supplies ten heat/power units). No workers or fuel means no powered production. These limits are reevaluated each cycle. Changing cadence after the first committed cycle is rejected, and founding a site cannot immediately mark it operational.

Each production run is one database transaction. It locks the facility and stock records, validates the pinned recipe and rules, enforces inputs, workforce, heat, power, site level, capacity and the 1,000-operation cap, deducts inputs, credits outputs and byproducts, and writes the production record plus item ledger entries. A unique facility/cycle key prevents duplicate runs after a restart or simultaneous request. If requirements are absent or status is not Operational, nothing is consumed.

Sites start in **Manual** production mode unless staff explicitly selects Automatic; **Off** disables runs. Slow = one eligible cycle per three-day bucket, Normal = daily, Fast = once per six-hour bucket. The Windows API polls every minute but does not replay every missed bucket following downtime.

Facility stock and Order shared workshop stock are different inventories. The UI provides explicit audited transfers from shared workshop (only when item IDs are mapped), releases back to shared workshop, and authorized reallocation between facilities. A facility-to-facility stock movement is an immediate staff-directed inventory reallocation, **not a simulated convoy**. Travel time, dispatch, weather delay, and real cargo manifests belong to P4.

## Acceptance scenarios

**Voidsent mine**: register a Captured mine, staff mark it Liberated, fund and finish its rebuilding project, assign available workers/power, then run an ore-producing cycle. Tests verify captured sites cannot produce, committed materials cannot be double spent, and the cycle runs once per key.

**Ceruleum production**: liberate and rebuild the captured rig, produce crude ceruleum, explicitly reallocate crude to a rebuilt refinery, satisfy heat/power/labor requirements, refine fuel and byproducts, and explicitly hand fuel to a destination facility. Tests verify the refinery cannot run without crude and that destination stock is recorded.

## Deployment and controls

Independent industrial locations additionally need **MySQL migration `055_independent_industry_sites.sql`**. This adds standalone mapped industry sites and installs safe starter templates for farming, ranching, logging, stone quarrying and timber milling without overwriting edited data. The original P3 features need **Windows API + MySQL migration `054_world_industry_projects.sql`** and the matching frontend. Before deployment, back up the production database, pull `main` on Windows, run `npm run setup:local` from `server`, restart the Windows API service, then refresh the browser.

Check that:
- The Item Catalog, Template Builder, Facilities and Projects tabs load without schema warnings.
- Creating and funding projects does not change personal or front-reserved balances.
- Site/capture transitions stop production until authorized.
- Repeated same-cycle runs are rejected.
- A captured site's former operator cannot continue automated production.
- Local Windows logs show the automatic industry scheduler without errors.

CI tests validate disposable MySQL schema and API flows; live Windows and browser acceptance remain separate.

## Simulation-owned production safeguards (migration 055)

- Industrial facilities **do not own their workers**. Labor is drawn from NPC or Order-controlled settlements in the same zone and faction, divided across eligible facilities. Placing ten farms does not create ten labor pools.
- Heat and power requirements are recipe inputs, not edit controls. A facility with no fuel cannot operate a powered recipe. Fuel is consumed and recorded in the industrial stock ledger in the same transaction as inputs/outputs.
- Creating a mapped site does not add population or housing. New sites begin ruined or captured and require real construction progress to become operational.
- Facility settings permit naming, pause/automatic mode, and an initial cadence. The API rejects direct staffing, level, heat/power, capacity and ownership edits. Once a production cycle has been recorded, cadence is locked to prevent repeated production by switching clock modes.
- Simulation-managed settlements cannot have population, employment or civic outcome fields overwritten in the ordinary settlement editor. Staff can still manage legitimate territorial information and fund infrastructure through the appropriate systems.
- New facilities and new farms are staff-visible zone map markers; existing settlement markers can also own industrial facilities without creating a separate site. Neither deletes existing infrastructure or stocks.

## Existing map locations are the single editing source (migration 056)

Use **World Administration → Territorial Map** to create and position farms, orchards, fisheries, ranches, logging camps, lumberyards, quarries, mines, refineries, factories, generators and other map sites. Use **Industry & Projects → Sites & Production → Attach Facility** to add production to that existing marker. The picker includes all existing map markers, grouped by marker type, including abandoned or destroyed ones. It does not duplicate the marker or require residents at that location.

A location whose map state is **Destroyed** or **Abandoned** can receive an industrial facility and a funded rebuilding project, but no production may run until the facility is operational **and** its location is no longer destroyed/abandoned. Successful industrial reconstruction moves a destroyed/abandoned location only to **Rebuilding**, not Secure, and leaves territorial control to the existing map system.

For installs using migration 055, previously created independent industrial markers and their facilities are retained and remain selectable under legacy independent site records. The old separate new-marker form is removed from the industry UI; new locations are authored in one place, the territory map editor. Migration **056_industry_map_location_templates.sql** adds non-destructive examples for orchards, fisheries, ore mines, ceruleum drilling, refining, foundries, workshops and generators in addition to previous farming, ranching, timber and quarry examples. Custom templates remain supported for every other map icon.
