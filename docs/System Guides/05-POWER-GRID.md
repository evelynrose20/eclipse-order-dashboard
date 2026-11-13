---
tags: [power, fuel, infrastructure, guide]
---
# Power grid and generator restoration

**UI:** World Administration → choose region/zone → Power Grid, or open a settlement dossier and jump to its power buildings.

A power plant belongs to **one settlement**, not a global electricity pool. The grid list is scoped to the selected region/zone. Existing generators report **condition, fuel, days remaining, blueprint/level, rated output and operating state**. Output, demand and condition determine Outage / Low / Good / Perfect.

## Build, repair, replace or upgrade

Use a **generator blueprint** from the editable Blueprint Library, then start a project. Standard seed models include Obsolete Garlean Ceruleum Mk.I (level 1), Mk.II (2), Mk.III (3) and Imperial Magitek Power Core (4). Blueprint requirements specify iron, repair timber and labor; project costs are recorded. **Repair** restores condition at the same technology; **Upgrade** requires a higher model; **Replace** uses a selected permitted blueprint; **Construct** creates a new power building. Condition and rating aren't free-form editable fields.

Fund materials from **FC Workshop shared stock**, then use the power-project workforce advancement action. Unfunded projects do not advance. Construction progression is bounded by workforce and daily advancement checks. Generator repair and upgrade projects are **separate** from civic building projects.

## Fuel and outages

Ceruleum power consumes stored fuel over elapsed time. Deliver fuel from real `ceruleum-fuel` at a compatible Order-controlled industrial facility in the same settlement; recording the delivery debits facility stock. An empty generator eventually stops. Settlements with NPC residents can accumulate unrest and reduced stability during an outage; World Admin reports lighting and powered heating unavailability. Civilian heating fuel is a **different** stock from generator ceruleum.

**Castrum Moonlight seeded example:** old Mk.I, 32% condition, 500 fuel units and 100 consumed/day initially. Its values change after installation, time and repairs.

## Chamber power coupling

An admin must explicitly set **Extraction Chamber Power Source** to the chamber's actual settlement; absent a link the chamber uses its legacy rate. **Low or Outage: no extraction. Good: 0.2 units/30 seconds. Perfect: 0.5 units/25 seconds.** Power level does not automatically move the chair to another settlement.

**Boundaries:** not every legacy standalone facility is grid-connected. Some older factories still use local fuel logic. Generator fuel delivery is not yet a seamless automated warehouse/train replenishment order; choose a facility with real stock.

**Code:** `PowerGridPanel.jsx`, `world-power.js`, `world-power-projects.js`, `world-industry-engine.js`, `thralls.js`. Related [[01-SETTLEMENT-REBUILDING]].
