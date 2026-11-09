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


## Province strategy integration (migration 076)
- `world_strategic_provinces` are independent subdivisions of existing `world_zones`, with their own terrain and editable polygons. The zone remains the economic/state and climate grouping; provinces inherit its current faction control. Existing zones and their continent outlines are **not** transformed or deleted.
- `world_strategic_province_infrastructure` tracks roads, railway readiness, fortifications, and power (0–5). These are **development records**; they do not yet replace real transport connections or automatically alter industrial throughput.
- `world_strategic_province_projects` records each autonomous investment, the sponsoring NPC settlement, its owner, cost, new level, and simulation cycle. NPC simulation debits earned development points from the existing `world_settlement_autosim` ledger inside the existing settlement transaction. If the faction has no industry-earned points, it cannot build.
- Province creation, terrain editing, and polygon drawing are accessible from the continent map. The existing city-builder/local map and Industrial Sites & Blueprints workspaces are one click away.
- Industry recipes and their `shared`/`order_only` access rules are untouched. NPC economic production and construction use the existing template systems.
- A state with no NPC economic settlements cannot invest in its provinces until one has been established and is earning capacity. Staff does not set NPC infrastructure levels manually.

### Future gameplay to implement (not claimed as complete)
- Province-level army movement and occupation distinct from state control, shared-border topology and non-overlap checks.
- Location/facility assignments to provinces and materialized goods flows.
- Functional cross-province road/rail links, supply hubs, capacity/terrain modifiers, and infrastructure influence on factory throughput.
- State-level construction queues and AI priorities for settlement/factory siting while preserving specialist city-builder customization.
- Military production and front-line AI tied to actual equipment, workforce, fuel and logistics.


## Reference artwork and freehand territory tracing (migration 077)
- **Reference layers** lets command staff upload a PNG/JPEG/WebP file. The browser scales/compresses it to WebP before saving it in `world_continent_reference` on the Windows database. Uploaded imagery persists across browsers; it does not require an independently hosted public URL.
- Use the fan-created continent/Ilsabard image as **reference artwork**, not a claim of canonical geography. Open World Administration → Territorial Map → Reference layers; choose the image, adjust opacity, scale, X/Y offsets, then select **Save reference**. The supplied conversation image is not automatically deployed into the repository; it must be selected through the new upload control.
- For map authoring: choose the state (or create and select a province), choose **Trace state border (drag)** or **Trace province (drag)**, then hold the mouse button and trace a complete outline. Releasing automatically closes and simplifies the polygon into <=100 editable points. Use **Edit corners** to drag the vertex handles, click to insert a vertex, or Alt-click a handle to delete one.
- Polygon validity is still enforced on the Windows API: malformed, tiny, or self-intersecting shapes are rejected. The trace is visual cartography, not automatic coastline or terrain inference.
- Original separate region map backgrounds, all city-builder content, industrial blueprints, and existing province polygons remain untouched.


## Native continent terrain (playable atlas)
- `src/IlsabardTerrain.jsx` now renders actual SVG terrain under the polygon and faction overlays: coastlines and islands, temperate and forested land, eastern highlands, snowy northern Ilsabard, ridged mountains, trees, rivers and shaded seas. It is **native world-space geometry**, not the uploaded map image stretched over the grid.
- The broad layout is an original cartographic interpretation **inspired by the supplied fan-made Three Great Continents map** and is not claimed as official FFXIV geography. The native atlas is intentionally free of the fan map's original labels, icons and decorative parchment framing.
- Native **Terrain relief** is on by default. Existing reference images are only shown while the `Reference layers` editor is open, so they cannot obscure the ground during ordinary gameplay. Previously saved external map backgrounds remain available when relief is turned off.
- Polygon province/state geometry and faction ownership remain independent database records rendered above this terrain. The existing local maps and city-builder remain unchanged.
- Terrain imagery is an **art layer**; it does not silently assign resource deposits, climate, roads, buildings, province borders, or ownership. These remain authored and simulated by their existing systems.


## Exact illustrated map as playable terrain (migration 078)
The native terrain is an interpretation, not an exact rendering of supplied fantasy artwork. To use the original illustrated map *itself* for the strategic ground: World Administration → Territorial Map → Reference layers → upload the artwork → select **Use artwork as playable map ground** → Save reference. This persists the compressed WebP on the Windows server and uses it as the primary map at full opacity, including after refresh. State borders, province polygons, and political layers still render on top. The existing native atlas remains the fallback; uncheck the setting and save to return to it. This does not automatically relocate existing province coordinates to features shown on the artwork, and it does not change production, ownership or settlement data.

The uploaded conversation image has not been silently published as an asset in the repository. Staff must choose the saved map image through the upload field. Source artwork may contain decorative labels/ships/dragons baked into the image; those remain part of the background unless replaced by artwork without them.
