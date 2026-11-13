---
aliases: [System Handbook, Dashboard Game Guide]
tags: [systems, handbook, staff, guide]
---
# Eclipse Order — System Handbook

**Purpose:** A practical guide to what the live dashboard does, how its systems connect, and where actions actually happen. These are operating instructions, not a proposed feature list. Verified from the repository on **13 November 2026**; the live Windows database may be on an older revision.

## Start with the workflow
- **[[01-SETTLEMENT-REBUILDING]]** — destroyed, abandoned, rebuilding; ownership versus actual repairs; worked Castrum Moonlight example.
- **[[02-WORLD-MAP-AND-OWNERSHIP]]** — regions, zones, mapped places, factions, territory states.
- **[[03-CIVILIAN-WELFARE-AND-BUILDINGS]]** — population, food, water, fuel, unrest, housing and infrastructure.
- **[[04-INDUSTRY-AND-CRAFTING]]** — construction projects, industrial sites, templates, stock and Workshop.
- **[[05-POWER-GRID]]** — generators, blueprints, fuel, outage effects and chamber power.
- **[[06-LOGISTICS-AND-WAREHOUSES]]** — goods, warehouses, roads, rail, airships, deliveries and fuel.
- **[[07-DIPLOMACY-WAR-AND-NPC-SIMULATION]]** — claims, conflict authority, diplomacy and automated NPC behavior.
- **[[08-CHARACTERS-EVENTS-AND-COMBAT]]** — character sheets, XP, events, encounters and RP.
- **[[09-ACCOUNTS-GOVERNANCE-AND-STAFF]]** — approvals, Discord-only access and governance.
- **[[10-CHAMBER-AND-ALCHEMY]]** — permissions, extraction, tanks, production enhancements and crafting stock.
- **[[11-VENUE-AND-PUBLIC-SITE]]** — public pages, recruitment and venue operations.
- **[[12-OPERATIONS-AND-TROUBLESHOOTING]]** — Windows API, migrations, deployment and diagnosis.
- **[[13-SYSTEM-DEPENDENCIES-AND-GAPS]]** — shared materials, automation boundaries, known gaps and terminology.

## What a settlement needs

A place can be **controlled** but still ruined; a building can be repaired while its **territorial state** still says Rebuilding; supplies can be in a **warehouse** but not yet in **civilian stock**. Each has a different inventory and status. Do not assume a label in one screen updates the others.

**Basic Order workflow:** (1) confirm legal control, (2) inspect individual facility condition, (3) choose a project or blueprint, (4) obtain materials at the right location/inventory, (5) commit funds and labor, (6) advance the applicable cycles, (7) confirm the functional service, (8) update territorial narrative state when justified.

## Source of truth and upkeep

The Windows MariaDB-backed API is authoritative for saved progress, stock and permissions. GitHub Pages only delivers the frontend. These guides do not claim that a feature is installed until `npm run setup:local` succeeds and the Windows API restarts. Cross-check individual guides against their listed source modules after changing behavior. Preserve the old specialized design docs as architectural/historical references; use this handbook for **how to play and administer**.

**Documentation rules for future contributors:** Every new system should document who may use it, how to begin, required inputs, cost source, what advances automatically versus manually, success criteria, UI path, affected database state, and failure cases. Do not confuse simulated NPC spending, FC Workshop materials, City Builder facility stock, civilian stock and warehouse stock.
