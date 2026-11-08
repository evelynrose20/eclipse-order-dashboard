# Railway freight infrastructure (migration 047)

Rail operations are edited in **World Administration → Territorial Map → Railway**, on the existing smooth original map. The **Railway** tab does not open a second map.

## Setup / rollout

1. Back up the production MySQL database.
2. Pull matching `main` frontend and Windows API revisions.
3. Run `npm run setup:local` from `server/`; confirm `047_rail_infrastructure` in `schema_migrations`.
4. Restart the Windows API service.
5. Check that the original railways, junctions, mountain ranges, and zone boundaries remain visually unchanged.

No existing world road/rail records are modified by the migration.

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
