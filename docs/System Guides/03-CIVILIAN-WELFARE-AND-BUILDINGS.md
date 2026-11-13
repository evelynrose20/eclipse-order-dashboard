---
tags: [civilians, city-builder, guide]
---
# Civilian welfare, housing and civic structures

**UI:** World Administration → Civilian Welfare → select settlement. Its tabs include civilian conditions, food/heating/essentials and buildings/defenses.

The current civic resources are **food, heating fuel, water and medicine**. Stored goods and source movements are recorded in a civilian ledger; consumption influences shortages, stability and unrest. Weather and insulation matter for heating. Empty settlements do not need civilian provisions until residents arrive, but housing supports future population.

## Supply versus correction

The **Civilian Supply Inventory** shows recorded inventory and recent movements. **Move shared Order goods** debits real FC Workshop stock to supply civilians. The separate **Manual stock adjustment** is an audited administrative correction/story event, not a normal trade or convoy. It supports both City Builder catalog items and FC Workshop catalog items in its picker. It does **not** transfer from a real industrial warehouse or factory.

Item identity is recorded internally; staff should choose items by name in the picker. Adding fake stock bypasses logistics, so reserve the correction tool for reconciliation or explicitly authored events.

## Civic buildings

**Buildings & defenses** uses a reusable catalog of structure templates: housing, granaries, waterworks, clinics, schools, insulation, defenses, public works. Templates define effect, level cap, construction labor, recipe materials and NPC development cost. An **active funded project** must finish before a new building's effect applies. Upgrading an operational building leaves its existing completed benefit while the next level is constructed. **Repair** returns the damaged building to its prior level; it does **not** award a new one.

For Order projects, materials are explicitly committed and debited from shared stock, by ingredient, before labor progresses. NPC projects use NPC development resources. The detailed rules and legacy migration history are in [[P2-CIVIC-INFRASTRUCTURE-TEMPLATES]].

## Simulation modes

The region, settlement and civic profile all affect whether cycles run. **Off**, **Narrative**, **Managed** and paused states are not interchangeable. Don't enable NPC self-government to make Order-owned settlements develop automatically: Order work requires its own funded resources and controls. Repeating a cycle on the same key/date should not double-spend or double-progress.

## Symptoms

Food present in a warehouse but zero in Civic Welfare: stocks are separate. Medical access low even with medicine: a clinic or services may also be needed. Heating shortage despite fuel: check infrastructure, cold weather, insulation and electric supply. Unrest increasing: inspect shortages, public services, housing, power outages and the last civic cycle.

**Code:** `CivicNeedsPanel.jsx`, `SettlementUpgradesPanel.jsx`, `CivicTemplateManager.jsx`, `world-civic-needs.js`, `world-civic-template-projects.js`, `world-settlement-simulation.js`. Related: [[05-POWER-GRID]].
