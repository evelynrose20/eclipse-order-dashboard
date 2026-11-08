# Railway freight infrastructure (migration 047)

Rail operations are edited in **World Administration → Territorial Map → Railway**, on the existing smooth original map. The **Railway** tab does not open a second map.

## Setup / rollout

1. Back up the production MySQL database.
2. Pull matching `main` frontend and Windows API revisions.
3. Run `npm run setup:local` from `server/`; confirm `048_rail_interzone_links` (and `047_rail_infrastructure`) in `schema_migrations`.
4. Restart the Windows API service.
5. Check that the original railways, junctions, mountain ranges, and zone boundaries remain visually unchanged.

No existing world road/rail records are modified by the migration.

## Lay track — redesigned drawing workflow

Use **World Administration → Zone Territory Map → Lay track** to create railway geometry on the **original smooth cartographic map**. This is different from the **Railway** tab, which manages station platforms, freight, switches and crossings.

1. Choose starting and destination settlements or saved junctions by clicking map markers or using the From/To controls. Route type stays locked to Railway while laying track.
2. To add a curve, click the map. Each new bend inserts into the nearest part of the route rather than being appended out of order. Drag circular gold handles to refine the curve; Shift+click a handle to remove it.
3. Optional **Trace track by dragging**: after choosing endpoints, enable the toggle and drag across open terrain to sketch the route. The sketch is reduced to at most 16 editable handles while retaining its shape. Nothing is saved until **Save railway**.
4. **Undo bend**, **Straighten**, **Reverse**, and **Cancel draft** apply only to unsaved work. You can still select existing tracks under **Edit routes** and reposition their bends.
5. To start a branch from a saved railway, use **Branch from route**, click directly on the visible track, and choose the branch destination. Curved rail snapping now follows the rendered curve, not the straight chord between control points.

Clicking a selected track in **Edit routes** adds a bend to its draft instead of discarding unsaved changes. Existing railway records remain on the same map; no second track editor or automatic track conversion is created.

## Railway stations and platforms

A station is anchored to an existing **rail-connected node** in the selected region/zone. To place a new one between two settlements, first use the existing route editor to split a rail line and create a saved shared node.

Station settings include name, status (planned, operational, closed, damaged), freight/passenger capabilities, freight capacity and RP notes. Add one or more platforms to a station, with code, freight/passenger/mixed/siding type, track length, capacity and independent status.

A freight station is considered *freight ready* only when its station is operational, freight handling enabled with positive capacity, and at least one operational freight/mixed platform has positive capacity. This is not a warehouse inventory balance.

## Switches and crossing controls

Switch records allow an explicit rail-segment pair at a shared rail junction. Each pair can be open, closed, or damaged. For rail junctions with three or more connections, route preview requires an explicitly open pair; for simple two-segment runs, normal through-running works unless a configured switch blocks it.

A crossing references an existing connected rail segment and road/trail segment in **the same zone**, with map X/Y coordinates near both routes. Crossing types are gated, ungated, signal-controlled, or grade separated. Crossings can be planned, operational, closed or damaged. Unsafe or closed crossings block the read-only freight route preview.

Station, switch, and crossing records are stored separately from route geometry. A track referenced by a switch/crossing, or a node holding rail infrastructure, cannot be removed until dependencies are cleared. Platforms must be removed before deleting their station.

## Older original-map routes

The Railway panel offers **Enable rail infrastructure on selected route**. This converts *only the selected older road or rail line* into the shared graph, preserving its endpoints, type, name and bends. Other lines remain unchanged. It is not an automatic bulk conversion.

## Railway management improvements and cross-map network links (migration 048)

**Stations, Platforms, Switches, Crossings, Network links** are separate sections of the Railway facility editor, not the Lay track tool.

- **Stations:** Add a station at a rail-connected settlement or junction. The form suggests an unused node and a name. After saving a station, use **Add platform here** directly from its record.
- **Platforms:** A platform belongs to one station and is not another settlement icon. New platforms automatically receive the next available code (F1, F2, etc.) and a starting capacity; missing, duplicate or invalid inputs are flagged before saving. An operational freight platform and operational station with positive capacities are required for freight readiness.
- **Switches:** Choose a shared junction where at least two rail segments meet. The form suggests its connected pair of tracks and an open status; save or change the pair's operating state.
- **Crossings:** These are **local intersections** of a road/trail and railway inside one zone. Clicking the road/rail intersection attempts to fill in the matching track IDs and coordinates; review them before saving.
- **Network links:** Two existing stations on **different zone maps**, whether in the same region or different regions, may be connected using an explicit rail network link. Specify the origin, destination, status, freight permission, and whether travel is bidirectional. The link is planned until explicitly made operational. This does not create a fake cross-zone line between unrelated percentages/coordinates.

The freight route preview traverses operational local rail segments and approved interzone links, respecting freight-ready stations, switches, and closed crossings. It lists local segments and cross-zone link IDs. It **does not** dispatch trains, move materials, or invent trip distances. Within one zone, draw physical rail lines; between maps, use station links.

**Deployment:** back up `eclipse_order` MySQL, pull the matching frontend and Windows API, run `npm run setup:local` in `server/`, verify migration `048_rail_interzone_links`, then restart the Windows API. The migration adds link records without modifying any saved map roads, trains, junctions, or stations.

## Trade readiness and subsequent phase

The **Freight route check** previews connectivity between two freight-ready stations. It follows saved rail segments, switch permissions, crossing closures, and zone boundaries.

It does **not** move workshop/front items, create cargo, dispatch trains, consume fuel, calculate real travel durations, or perform daily simulation. Those belong to the later logistics/trade stage with stockpile reservations, manifests, vehicle readiness, deliveries and idempotent transfers.

## Acceptance tests

- Create an active freight station, operational freight platform, and a second freight destination.
- Link both stations with saved rail track, verify the preview.
- Build a three-way rail junction; verify travel requires an open configured switch pair.
- Close the switch and confirm that preview becomes unavailable.
- Place a planned gated road/rail crossing; preview must block until the crossing is operational.
- Verify that unrelated roads and regions do not change.
- Verify that removing a track used by a switch or crossing receives a clear dependency error.
