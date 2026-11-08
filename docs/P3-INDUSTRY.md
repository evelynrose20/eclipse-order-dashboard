# P3 — Sites, Industry and Projects

## Model and boundaries

Industrial sites attach to an existing world settlement and therefore inherit its geographical context (region/zone) without requiring extra map station objects. A facility records its own operator at creation; changing the settlement's controller freezes production and construction until staff acknowledges the capture. The acknowledgment deliberately sets the facility to **Captured** and production to **Off**, without rewriting territory, characters or inventories.

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

Each production run is one database transaction. It locks the facility and stock records, validates the pinned recipe and rules, enforces inputs, workforce, heat, power, site level, capacity and the 1,000-operation cap, deducts inputs, credits outputs and byproducts, and writes the production record plus item ledger entries. A unique facility/cycle key prevents duplicate runs after a restart or simultaneous request. If requirements are absent or status is not Operational, nothing is consumed.

Sites start in **Manual** production mode unless staff explicitly selects Automatic; **Off** disables runs. Slow = one eligible cycle per three-day bucket, Normal = daily, Fast = once per six-hour bucket. The Windows API polls every minute but does not replay every missed bucket following downtime.

Facility stock and Order shared workshop stock are different inventories. The UI provides explicit audited transfers from shared workshop (only when item IDs are mapped), releases back to shared workshop, and authorized reallocation between facilities. A facility-to-facility stock movement is an immediate staff-directed inventory reallocation, **not a simulated convoy**. Travel time, dispatch, weather delay, and real cargo manifests belong to P4.

## Acceptance scenarios

**Voidsent mine**: register a Captured mine, staff mark it Liberated, fund and finish its rebuilding project, assign available workers/power, then run an ore-producing cycle. Tests verify captured sites cannot produce, committed materials cannot be double spent, and the cycle runs once per key.

**Ceruleum production**: liberate and rebuild the captured rig, produce crude ceruleum, explicitly reallocate crude to a rebuilt refinery, satisfy heat/power/labor requirements, refine fuel and byproducts, and explicitly hand fuel to a destination facility. Tests verify the refinery cannot run without crude and that destination stock is recorded.

## Deployment and controls

This feature needs **Windows API + MySQL migration `054_world_industry_projects.sql`** and the matching frontend. Before deployment, back up the production database, pull `main` on Windows, run `npm run setup:local` from `server`, restart the Windows API service, then refresh the browser.

Check that:
- The Item Catalog, Template Builder, Facilities and Projects tabs load without schema warnings.
- Creating and funding projects does not change personal or front-reserved balances.
- Site/capture transitions stop production until authorized.
- Repeated same-cycle runs are rejected.
- A captured site's former operator cannot continue automated production.
- Local Windows logs show the automatic industry scheduler without errors.

CI tests validate disposable MySQL schema and API flows; live Windows and browser acceptance remain separate.
