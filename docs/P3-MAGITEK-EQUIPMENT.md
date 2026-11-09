# Magitek Manufacturing, Rolling Stock and War Reserves (migration 071)

**Where:** Industry & Projects → Magitek & war stores.

This adds vehicle and military-equipment manufacturing to the ordinary Industry & Projects simulation without creating free vehicles or replacing existing train/railway maps. Equipment is fictional FFXIV-RP stock owned by a faction; it is separate from character equipment and player inventory.

## Design flow

1. **Create an equipment design.** A starter draft is available for a ground cargo hauler, magitek freight wagon, locomotive, armored vehicle/tank, or airship. Other types include field and siege equipment. Choose an item ID, description, transport capacity, cargo capacity, crew requirement, and optional operating fuel and fuel consumption.
2. **Build a manufacturing recipe.** Use the equipment design as an output in a normal **Facility template** of category *Manufacturing*. Recipes can contain any compatible registered input materials, byproducts, labor, heat, power, throughput and level restrictions. The equipment design page opens a factory template editor with the selected finished output already filled in. Place an actual factory at a map or settlement site through **Attach production**, then develop it through existing construction/repair rules and operate it normally.
3. **Manufacture finished units.** The Industry engine debits exact recipe inputs and utilities, uses actual employed workers and power/fuel, respects weather and site status, and writes completed equipment output to the manufacturing facility's own stock and ledger.
4. **Commission finished units.** Choose an operational Order-owned factory and design; **Commission** debits integer finished items from that factory stock and creates an audited fleet or war-reserve lot. A design is not stock. Only an assembly-line recipe that actually produces the selected equipment may commission it. Repeated commissioning is bounded by available physical stock.
5. **Organize fleet reserves.** Each lot records the originating factory, quantity, item design revision and complete pinned specifications. Keep lots in reserve, mark them damaged/retired, or assign all or part of a reserve batch to an Order-controlled settlement. Splitting a lot conserves its total quantity and writes both movement records. Commissioning is restricted to operational, faction-controlled Manufacturing facilities that have the particular equipment item listed as a real assembly-line output. Changes to blueprint specifications do not retroactively strengthen older commissioned units.

## Production balancing and anti-cheat

Manufacturing a vehicle requires at least two distinct inputs, nonzero power, real skilled industrial labor, and minimum total ingredient quantities appropriate to its equipment class and each unit of output. For instance, armored vehicles require more resources than ordinary field equipment, and airships need more than freight wagons. The material floor rises with passenger and cargo capacity. Category-specific capacity limits prevent a lightweight cart from being configured as a limitless hauler. Output is restricted to whole vehicles; equipment cannot be a byproduct and no multiplier rule can multiply or fractionalize them. Templates cannot masquerade as Manufacturing when they are another industry class.

The equipment blueprint is an output definition rather than an alternative production action. Equipment outputs cannot be classified as byproducts or use rules that multiply production, since that could create free or fractional complete vehicles. Staff cannot create commissioned vehicles by editing inventory totals or assigning an unrealized design. Existing safety checks for labor, location control, fuel and construction resources remain active. Asset registration, assignment, reserve splitting, damage and retirement are written to `world_magitek_equipment_movements`.

## Scope and later simulation connections

**Currently operational:** factory templates, custom equipment designs, factory-held finished stock, commissioned reserve lots, equipment counts, per-unit cargo/passenger/crew/fuel specifications, faction-controlled assignment records and audit history. This permits meaningful war-readiness stockpiles, rolling stock fabrication, armored reserves and industrial supply planning.

**Not automatically connected yet:** assigning a railcar here does **not** add physical freight capacity to an existing internal rail journey or draw extra cars on the map. Station assignments are administrative readiness plans, not simulated travel. War battles, combat strength, fleet missions, maintenance/refueling and train consists still need separate integration with their respective simulation systems. Avoid treating equipment specs as effective bonuses to those systems before the appropriate integration is implemented.

## Installation

Pull the latest GitHub `main`, run `npm run setup:local` from `server` on the Windows API host, restart the service, then refresh the dashboard. The new migration `071_magitek_equipment_manufacturing.sql` extends the industry item category list and creates the blueprint, inventory and movement tables. It leaves existing facilities, industry recipes, rail routes and past material stock ledgers unchanged.

## Official Garlean equipment and enormous military airships (migrations 072–073)

The **Magitek & war stores** equipment library includes a conservative, lore-tagged seed list drawn from FFXIV:

- **Canonical magitek types:** Reaper, Vanguard, Colossus and Juggernaut.
- **Canonical imperial aircraft categories:** Magitek Gunship and Imperial Assault Craft.
- **Canonical military airship classes:** Aurora-class Warship (medium) and Agrius-class Flying Fortress (capital-scale). The **Gration** is an actual named vessel of comparable scale, *not* a newly invented Gration-class design.
- **Documented Garlean railway vehicle:** Mark XLIX Passenger Train, modeled as a locomotive/trainset for this sim.
- **Original RP-derived designs:** Imperial-style Freight Locomotive, Freight Railcar and Troop Railcar. Those generic model names are not presented as verified Square Enix vehicle designations.

References: [Official FFXIV ARR world lore](https://na.finalfantasyxiv.com/a_realm_reborn/world/lore), [Garlean Empire / Encyclopaedia Eorzea class summaries](https://ffxiv.consolegameswiki.com/wiki/The_Garlean_Empire), [Mark XLIX Endwalker sightseeing landmark](https://ffxiv.consolegameswiki.com/wiki/The_Runaway_Train).

All passenger counts, military crew counts, resource requirements, movement fuel consumption and cargo capacities are **gameplay estimates**, not canon numeric statistics. Descriptions, provenance fields and edition revisions preserve that distinction; only the seeded official designs may claim verified FFXIV class/model status. Blueprints do not create free vehicles or finished production output.

Capital-scale airships use the distinct **capital_airship** class, with larger allowed capacity and much higher manufacturing labor/power/material floors than small gunships or assault transports. To build an Agrius-class-style fleet, create an actual manufacturing facility template and work through its normal inputs, staff and fuel-backed power. A recommended starting production recipe is filled from the selected blueprint, including the much larger cost of capital ships. All completed ships are commissioned into the existing war fleet inventory and may be stationed as readiness assets; the flight/battle simulation is not yet connected.

### Complete trains and internal railway services

A locomotive blueprint or isolated freight wagon is not a complete train. **Magitek & war stores → Assemble complete trains** combines **one actually commissioned, reserve-status locomotive lot** with one or more reserved manufactured railcar lots. The unit quantity in a car lot counts toward the locomotive's pinned maximum hauled wagon count. The whole train records its **actual combined cargo capacity, passenger capacity and crew requirement** from the historical specifications of its physical carriages and locomotive. The same locomotive or wagon lot cannot be in two trains or reassigned independently while assembled. Disassembly returns all units to reserve; historical train records and the equipment ledger remain.

**Internal Rail Logistics** can now select one of these assembled trains when dispatching a rail service. The journey records the consist ID and its actual capacity at departure. A train cannot run two simultaneous routes, be disassembled during its journey or begin a later leg from a station different from its last arrival. Older journey history is preserved, including earlier menu-only service records with no physical consist attached.

This first integration is an **operational scheduling and capacity registry**, not yet full cargo loading/unloading. Assigning a train to a journey neither creates cargo nor moves workshop inventory; railway engine fuel and the goods being shipped must receive a separate actual stock/consumption implementation before automated train deliveries can be claimed. Existing road/rail map geometry remains unchanged and is not overwritten by the menu-based internal railway service.
