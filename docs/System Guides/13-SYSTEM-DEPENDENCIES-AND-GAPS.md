---
tags: [architecture, integrations, current-limitations]
---
# Integration map, ownership of stock and known boundaries

## What depends on what

| Feature | Input/source | Does it automatically do the next step? |
|---|---|---|
| Industry production | facility input stock, workers, fuel, state, optional grid | No automatic shared-Workshop credit |
| Warehouse shipment | source facility stock, route, vehicle, fuel, capacity | Receipt credits warehouse, not civilian provisions |
| Civilian welfare | civilian food/fuel/water/medicine inventory, civic infrastructure | No automatic pull from arbitrary warehouse |
| Civic construction | explicit FC Workshop material commitments, healthy workers, eligible cycles | No free completion when state becomes Rebuilding |
| Industrial restoration | facility project and industrial stock | Does not restore every building in the settlement |
| Generator | ceruleum fuel, condition, level, demand | No universal automatic warehouse refueling |
| Generator repairs/upgrades | blueprint, iron/timber shared stock, daily workforce progress | No instant upgrade or fuel creation |
| Chamber | player controls, eligible character, daily balance, optionally generator grade | Tank decant/Workshop stock transfer is separate |
| NPC development | owned NPC settlement, simulated economy, approval boundaries | Does not spend Order stock or seize protected land |
| Discord guild membership | OAuth/link, recurring membership check | Can revoke site access; doesn't delete characters |

## Why the system seems complex

There are several **parallel project frameworks**: map/territory recovery, civic infrastructure, industrial projects, power generator projects, warehouses and long-form campaign Construction & Restoration. Their progress numbers, recipes, stock ledgers and cycle controls **are not interchangeable**. Rebuilding a settlement therefore means completing an appropriate set of linked jobs rather than pressing one global rebuild button.

**Known design limitations to communicate before promising them:**
- No single unified “settlement rebuilt %” summary across all project types.
- No guaranteed automatic physical supply chain from every factory/warehouse to every civilian project.
- Generator refueling is a recorded, stock-backed local facility transfer; automatic warehouse/train dispatch to plants is not a universal finished flow.
- Some older sites still rely on local utility fuel even when newer settlement sites require grid power.
- Territory control and physical state can diverge until reviewed and updated.
- This handbook documents code paths; it cannot confirm a particular Windows DB has applied every migration.
- Member-owned individual housing is a **design idea**, not a completed property allocation module.

## Proposed future improvement (not implemented)

A read-only **Rebuilding Overview** in each settlement dossier could aggregate: territorial condition, controlled faction, damaged civic facilities, industrial sites blocked, active project requirements, available material source, power, fuel, residents, heating, and recovery risks. It should navigate to the existing systems rather than inventing a competing project ledger. The first milestone would be a dependency checklist, not another simulation.

## Documentation quality contract

Every new system should add/update one guide here and link its authoritative code modules. State explicitly whether a behavior is currently implemented, seeded only, manually triggered, automated, or planned. Never claim the UI does something the server does not enforce.
