# Railway logistics — mapped track supply network

## Current player workflow

Railway freight belongs in **Supply Command → Supply Lines**. The separate **Internal Rail Logistics** page has been retired; its earlier duplicate station/service creation is no longer part of normal setup.

1. Draw or connect railway tracks in the region/zone map. Track endpoints must be attached to actual settlement route nodes or linked through an operational rail corridor.
2. Assemble an Order-owned freight train with a locomotive and railcars in the existing magitek train assembly system.
3. In Supply Lines, create a standing order from a factory, mine, farm or warehouse to a warehouse, industry depot or military installation. Select **Rail freight**, a transport template and the train consist.
4. The backend validates a connected rail map path. In the same transaction, it registers missing operational settlement terminals and both outgoing and return rail services. Existing terminal damage and paused service states are respected: operators can inspect/reopen closed terminals or resume paused services in **Supply Lines → Railway access**. Damaged terminals still need restoration.
5. Scheduled dispatches require real source inventory and train fuel, use manufactured freight capacity, and create actual rail journey records. The train returns before being available for another supply route. Overcapacity, interrupted journeys, broken connections or unavailable stations cause waiting or disrupted cargo, not free goods.

**Important:** a track that is visually near a site is not by itself connected. The **Inspect track near source** control measures proximity (3% zone-map threshold) as a hint only. Railway loading still requires a connected map route. Add a siding/track connection in the map if necessary.

## Data safety and compatibility

The database tables `order_internal_rail_stations`, `order_internal_rail_routes` and `order_internal_rail_journeys` are deliberately retained. They contain earlier schedules, historic runs, train location and outstanding in-transit cargo. No database tables or route maps were removed; historical journeys and old API links remain valid for compatibility. The old standalone React interface and CSS are removed.

Automatically generated service durations use an initial **20 minutes per mapped rail segment** (at least 15 minutes, max 7 days) if no earlier service exists. This is a game-system estimate, not real-world distance or speed. Existing service times remain unchanged.

The map-first setup requires the existing migrations through **107**, which were already introduced. This UI/backend refactor does not require a new schema migration, but changing the Windows API service still requires pulling the latest code and restarting it.

## Known bounds

Automatic routes are currently point-to-point; multiple destinations require separate standing lines. Existing rail deliveries use the same stock, capacity, fuel, waiting and recovery rules as other standing supply routes. Destruction and damage are not automatically repaired by drawing tracks: restoration consumes actual materials through the relevant construction systems.
