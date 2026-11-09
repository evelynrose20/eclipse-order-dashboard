# Continental strategy map — transition plan

## Implemented foundation
- A continent-wide strategy map is the primary World Administration map, with drag pan, wheel zoom, fit control, political/status layers and a territory inspector.
- The original local map stays accessible through **Detailed local map** or **Open local map & settlements**. It retains the existing route, mountain, marker and road editing tools.
- New saved continent background and polygon outlines live in `world_continent_settings` and `world_continent_territories`; migration 075 is additive and repeatable.
- Each polygon belongs to an existing `world_zones` record, preserving controlling, governing and supporting factions, strategic status, climate region and simulation references.
- Polygon validation rejects malformed, out-of-bounds, degenerate and self-intersecting shapes.

## Not implemented / decisions for the next phase
- **Canonical continent artwork and geographic placement**: none is invented. Command staff supplies a suitable background and traces polygons. Existing per-zone map percentages are relative to their original zones, not global world coordinates.
- **Cross-territory location and transport placement**: requires a deliberate coordinate migration and editor for continent-level settlement, industrial site, road, railway and logistics layers. Existing local coordinates must not be treated as continent coordinates.
- **Territory topology and conflict**: define shared edges, adjacency, passability, overlapping polygon rejection, ownership effects and war-front simulation separately. Polygon color by itself must not automatically change ownership or trigger conflict.
- **Performance and interaction**: province labels by zoom, terrain overlays, selection/search, minimap, and GPU/map tiling when the continent becomes large.
- **Political changes**: control is still edited using the existing zone workflow; border geometry does not automatically annex land or change faction ownership.

## Proposed game model
- Continent is a camera and spatial layer, not a new economic region.
- Region remains a behind-the-scenes climate, geography and simulation grouping.
- Territory (existing zone) is a polygon with faction control, strategic state and adjacency.
- Location remains settlement/factory/farm/fort, attached to a territory; its workforce and economy continue using the existing simulation.
- Transport links use real authored nodes and edges and must connect across territory boundaries without inventing travel times.
- Only staff-authored edits change map data; independent NPC simulations may progress their economy under the existing safeguards.
