---
tags: [world, maps, factions, guide]
---
# World map, regions, zones and settlement ownership

**UI:** World Administration → Territorial Map, Order Settlements, NPC Settlements, Unclaimed; region and zone selectors; settlement dossier/editor.

A **region** has geography and climate. A **zone** contains its own map and placed locations; don't assume switching region or zone changes the control of every settlement. The regional overview and separate zones are distinct map contexts. Roads, rails, mountains and river annotations are geography; transports are managed through logistics, not by drawing vehicle sprites.

For each settlement distinguish **Government** (governing body), **Control** (current controlling faction), **Supporting faction**, **NPC residents**, and **Strategic state** (physical/political condition). These values are intentionally separate. The Order should be explicitly selected where it really holds control; do not change another faction's ownership just to enable an Order-only building.

**Create/edit a location:** choose region and zone, place on clear map ground, enter faction assignments, state, population and baseline services. Mountain geometry blocks invalid placement; NPC placements have edge margins. The server validates data. The editor can record the territorial condition but cannot magically build industry, homes, warehouses or power stations.

**Route network:** settlement roads, railway connections and junctions are edited in Territorial Map. Supply and convoy eligibility checks use network/corridor and equipment data. Routes across zones require supported transfer systems; do not assume two drawings in different zones form a path.

**States:** `Destroyed` or `Abandoned` can block industrial production; `Rebuilding` is a staged narrative condition. `Secure` is not the same as `Occupied`. The map displays the settlement state independently of faction control.

**When a zone looks empty:** confirm the selected region, zone, visibility scope and correct controlling faction. Power plants only appear in the **Power Grid** area for their settlement's zone.

**Code:** `WorldAdministration.jsx`, `WorldTerritoryMap.jsx`, `world-administration.js`, `world-zones.js`, `world-route-network.js`, `world-terrain-placement.js`. See [[01-SETTLEMENT-REBUILDING]] and [[07-DIPLOMACY-WAR-AND-NPC-SIMULATION]].
