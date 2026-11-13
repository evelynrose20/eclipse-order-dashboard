---
tags: [logistics, warehouses, rail, airships, guide]
---
# Logistics: cargo, warehouses, roads, rail and airships

**UI:** logistics/freight pages, routes and station/vehicle tools; World Administration → Territorial Map for physical road/rail geometry; industry facility and warehouse views.

The key principle is **physical stock accounting**. A factory producing ammunition does not automatically place that ammunition in Castrum Moonlight's warehouse or send it to the front. A shipment must have an origin with stock, a supported path, a valid transport/service, enough fuel/capacity and an authorized destination.

**Cargo lifecycle:** generate or gather goods at source facility → select a route/corridor and transport → validate capacity, same-zone/path rules, fuel and equipment → dispatch (source debited) → delivery/transit/disruption → receive at destination (credited). Staff controls exist for disruptions and resuming deliveries. Airships consume substantial fuel; roads, rail and airship routes are supported, **not sea shipping or pack animals**.

## Warehouse construction

Warehouse designs define multiple storage levels, capacity and an editable multi-material **construction recipe**. Build from an existing Order-owned industrial depot with materials in the appropriate connected zone. Commissioning or upgrading spends materials from the source facility, not free global stock.

**Important recipe correction:** original seeded warehouse blueprints accidentally picked the alphabetically first supply good, leading to **Preserved Fish ×30** for a depot. Migration `130_fix_warehouse_food_blueprints.sql` corrects untouched original recipes and unbuilt matching orders to **Iron Ingots**. Custom blueprints are preserved. Run Windows `setup:local` to apply.

## Routes and handoffs

Road and rail geometry is maintained through the zone map; this is not the same as a train being physically dispatched. Internal rail and freight/standing supply lines have their own timetables and resource rules. Check origin/destination, route segments, vehicles, fuel, capacity, climate interruptions and any rail journey needed before assuming something will move.

**Common blockers:** missing same-zone construction depot; missing input or fuel; warehouse full including goods already in transit; disconnected roads or rail; vehicle not stationed or assigned; missing air dock; location ownership mismatch; a damaged site that cannot operate.

**Code:** `LogisticsWarehouses.jsx`, `WarehouseBlueprintsPanel.jsx`, `FreightLogistics.jsx`, `world-warehouses.js`, `world-warehouse-blueprints.js`, `world-logistics.js`, `world-route-network.js`, `world-standing-supply-lines.js`. More: [[P4-LOGISTICS]], [[RAILWAY-TRADE-INFRASTRUCTURE]].
