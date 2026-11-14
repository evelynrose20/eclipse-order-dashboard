---
aliases: [Settlement Rebuilding Guide, Rebuild a Settlement]
tags: [world, restoration, guide]
---
# Settlement rebuilding — step by step

## New command workflow (November 2026)

Open **World Administration → select Region and Zone → Rebuilding**, or use **Rebuild settlement** in a settlement dossier. This is the central restoration dashboard for an existing site; it reads the same civic, industrial, power and warehouse records used everywhere else.

1. Select the settlement. The summary shows territorial state, controlling faction, civilians, workforce, and critical repairs. Switch between **Everything / Buildings / Industry / Power / Warehouses** to see individual assets.
2. For an Order-controlled **Destroyed** or **Abandoned** location, use **Begin rebuilding**. This only changes the settlement's territorial state and records the action. It does not grant materials, housing, equipment, or fuel.
3. Under **Buildings**, a damaged or destroyed **template-backed** structure can now start a **funded repair** directly, retaining its previous level; an operational building can start a **level upgrade**. Legacy non-template structures remain visible but need separate staff review instead of receiving imaginary recipes.
4. For each active civic project, inspect its exact material requirement, shared stock and labor progress. **Commit available** debits existing FC stock through the same locked endpoint as Civilian Welfare. For detailed blueprint selection, choose **Open building editor**; this now opens directly on the Buildings tab.
5. Under **Industry**, review affected factories/farms and their projects, then open **Industry & Projects** for their native material and labor controls. For power, open **Power Grid** for generator blueprint projects and stock-backed fuel delivery. For warehouses, open the existing **Freight → Warehouses** screen.
6. After individual systems are working, review warnings and separately decide whether the map's territorial condition should change to Secure. There is no free “Finish All” action, and an empty checklist is not automatic story authorization.

The overview has **no separate construction stock or progress database**; it is a shared view over the existing records. Civic buildings have the most complete direct repair/upgrade controls in the overview; industry, generators, and warehouses still use their existing specialized actions.

## First: what does Rebuilding mean?

A settlement has a **territorial state** (Peaceful, Secure, Contested, Occupied, Liberated, Rebuilding, Abandoned, Destroyed). This describes its world/map condition; it is **not** a percent-complete master reconstruction job. Buildings and industrial facilities each have their own conditions, active construction projects, materials, and workforce requirements.

A place may be Order-controlled and still Destroyed; taking control is not a repair. Conversely, repairing one facility does not necessarily make every civilian service operational. Do **not** solve this by manually setting everything to 100% in Edit Settlement.

## For an Order-controlled destroyed/abandoned place

1. Open **World Administration → region → zone → settlement marker/dossier**. Confirm you are editing the intended zone and inspect **Control**, **Government**, and **Territorial state** separately.
2. Confirm the Order actually **controls** the site. If an NPC faction controls it, follow the conflict/approved takeover system. For an unclaimed site, the NPC recovery-claims workflow specifically concerns NPC claimant proposals, not instant Order annexation.
3. Set the territorial state to **Rebuilding** only when story authority and current control support that change. This is a narrative/status action, **not** free restoration.
4. Review the site's **Civilian Welfare → Buildings & defenses**. Identify destroyed or damaged homes, waterworks, granaries, clinic, school, insulation and other civic facilities. For a template-backed building choose **repair**; for missing infrastructure start a **new template-backed building**. A repair restores the prior building; a higher tier needs its own **improvement/upgrade project**.
5. Examine **Industry & Projects** for production sites attached to the settlement or mapped farm/mine/factory. A destroyed or abandoned mapped location cannot produce until an appropriate industry reconstruction project restores it. Confirm ownership, workforce, operating inputs, output storage, climate/fuel and power.
6. Examine **Power Grid** in the **same region/zone**. If the generator is damaged, choose a **Repair project**; to replace or improve its technology choose **Replace** or **Upgrade** and an appropriate blueprint. Do not edit generator condition directly.
7. Fund the projects. Civic projects consume committed **shared FC Workshop materials**, and industrial/power/warehouse jobs use their respective material sources. A requirement shown as `30 iron ingots` is not satisfied just because the material exists somewhere on the map: check **which inventory** the project debits.
8. Advance the relevant **construction/workforce cycle**. Civic projects are progressed by applicable settlement/civic cycles, with material funding gating work; industrial projects have their own production/construction advancement; the power panel supports its own funded daily advances. Do not expect one “Next Day” control to complete every system.
9. Check that restored buildings are **Operational**, that industrial output is enabled, that heating/lighting actually have power and fuel, that civilian food/water/medicine are available, and that housing and unrest have stabilized.
10. When the location is narratively recovered, set territorial condition to **Secure** or another appropriate state. The system does not treat that as a universal automated completion event.

## Worked example — Castrum Moonlight

The seeded **Obsolete Garlean Ceruleum Mk.I** has **32% condition** and initially **500 units of fuel at 100/day** (five days at the initial rate). Those are starting values, **not necessarily live values** once time has elapsed or staff have delivered fuel.

1. Find **Castrum Moonlight** in its actual region and zone; select **Power Grid**. Its plant should appear only within that zone.
2. Start **Repair** using the existing Mk.I blueprint. This should restore condition without changing its model/level.
3. Supply required **iron ingots** and **repair timbers** from shared stock; progress its labor through the power-project controls. Or choose **Upgrade** to Mk.II+ for improved output/fuel economy; this costs the target blueprint's full requirements.
4. Before the plant exhausts its fuel, deliver actual **ceruleum-fuel** from an Order-controlled industrial facility with stock **at the plant's settlement**. A staff-recorded delivery must debit real stock.
5. Inspect **Civilian Welfare** for heating fuel, food, clean water, medicine and housing separately. Electric power outage affects powered heat and lighting, but a full civilian recovery still needs provisions and civic structures.
6. If the chair is installed here, **Power Grid → Extraction Chamber Power Source** must link the chair to Castrum Moonlight; this location is not guessed by the server.

## What NPC rebuilding does differently

**Diplomacy & Wars → Reconstruction & takeover requests** contains proposals for unclaimed existing locations from NPC factions. The nearby faction may propose restoring a ruin, but **command must approve** ownership transfer; a protected site requires explicit override. Approval sets a ruined/abandoned site to Rebuilding while retaining previous industry and civilian records. This is a **claim**, not an instantly completed repair. NPC-managed settlements can autonomously choose civic templates, pay with NPC development points and advance work under their simulation rules. They **do not** draw materials from the Order's Workshop.

## Typical reasons a repair does not progress

- You edited the **territorial state** rather than creating/funding a **building** project.
- Project materials have not been **committed** or belong to a different stock ledger.
- Insufficient healthy workforce or project progression has already happened for that cycle.
- The relevant regional/settlement simulation is **off/paused**, or only narrative mode is active.
- A mapped industrial location is still **Destroyed/Abandoned**, or the controlling faction changed.
- Electricity, local fuel, weather protection, route connectivity or industrial inputs are insufficient.
- A warehouse has goods, but no authorized transfer placed those goods into the project-eligible inventory.

**Code references:** `server/src/world-administration.js`, `world-settlement-upgrades.js`, `world-civic-template-projects.js`, `world-settlement-simulation.js`, `world-industry-engine.js`, `world-power-projects.js`, `world-recovery-claims.js`. Additional design detail: [[P2-CIVIC-INFRASTRUCTURE-TEMPLATES]].
