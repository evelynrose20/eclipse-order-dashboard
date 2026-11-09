# Narrative-safe NPC diplomacy & approved conflict (migration 081)

## Intent
The FFXIV world has **preset places**: NPC factions may develop existing holdings and
existing industry/civic buildings, but they do not found random new cities or new world
zones. Wars and conquest are story-critical and require affirmative command decisions.

## Current behavior
1. World Administration -> **Diplomacy & Wars** is command-only.
2. Staff can adjust two factions' **tension** and **trust** (0-100), author
   narrative incidents, or run **Assess NPC tensions**.
3. After a successful NPC settlement economic simulation cycle, the server can
   also assess eligible tension and submit a **pending** incident. It never
   declares war itself. An NPC assessment needs tension >=70, trust <=35, two
   distinct NPC factions and an existing defender-owned location. The Eclipse
   Order is excluded from this automatic NPC-vs-NPC assessment.
4. Incidents can be **approved, postponed, rejected**, or converted to an RP
   event. Rejecting does not change territorial ownership or the simulation.
   Reviewed incidents are recorded with reviewer, timestamp, and notes.
   Duplicate NPC incidents are suppressed while pending; dismissed incidents
   are not proposed again for the same target for 30 days.
5. Approving a raid, siege, border dispute or war creates an **authorized
   conflict record** but does not change settlement ownership, damage facilities,
   or simulate battles.
6. For an authorized conflict staff can separately propose **capture of an
   existing location** or **peace**. That is another pending approval. Captures
   require the location still to be controlled by the defender. Approval
   transfers only `world_settlements.controlling_faction_id`, sets state to
   `occupied`, and writes an audit decision. It leaves population, inventory,
   governance, industry sites, buildings and wages untouched. Peace approval
   concludes the conflict.
7. Staff can mark a preset location **major_changes** or **all_conflict**
   plot-protected. Protected captures require an explicit override on the
   **second** review, while all_conflict protection also stops approval of a
   new attack aimed at that location.

## Security and invariants
- All routes require an authenticated `domina` or `high_command` role.
- All approvals, decisions, and ownership mutations are transactional;
  reviewing a proposal twice is rejected.
- A conflict cannot be started by a simulation tick. Approval alone only creates
  an authorized record. No blanket autonomous annexation exists.
- Preset zones, settlements, and their map coordinates are unchanged.
- The current detailed city builder, shared/Order-only industrial blueprints,
  materials, housing, NPC settlement simulation, and transport networks remain.

## Still to implement
This migration is **the political decision and authorization foundation**, not a
full military game. Army mobilization, equipment use, supply consumption,
campaign progress, land battle resolution, and unit losses are not automatically
simulated yet. Those mechanics can be added to authorized conflicts, with
battle/peace/capture outcomes still returned for separate command approval.


## Map faction control and ruined-location recovery (migration 082)

World Administration → Territorial Map now offers two map views:
- **Faction control** (default) adds a persistent owner chip, faction color and
  zone-local-government comparison on each mapped settlement. It distinguishes
  the local governing faction, an outside/occupying faction, the Eclipse Order,
  an independent faction and unclaimed sites. A per-zone ownership legend
  summarizes how many locations each faction currently controls.
- **Condition** highlights the pre-existing civic/strategic state (secure,
  contested, destroyed, abandoned, rebuilding, etc.). Condition and controller
  are independent attributes; a destroyed town can still legally be held by the
  old owner until reviewed and approved for transfer.

**Recovery / Claim Requests** is a separate section within Diplomacy & Wars.
After NPC simulation cycles, an NPC faction with an existing holding within
35 map units in the same preset zone may request to reclaim an unclaimed
destroyed or abandoned settlement. This request never creates new land or
automatically changes ownership. A commander may review, postpone, reject,
convert to RP, or approve. An approved claim changes only the settlement
controller and strategic condition: destroyed/abandoned becomes **rebuilding**;
intact unclaimed becomes **secure**. Existing population, infrastructure,
warehouses, inventory and industry projects are not conjured or reset.

Staff can also create manual recovery requests for unclaimed locations.
Plot-protected claims require an explicit override from the reviewer. If a
location is **already controlled by any faction**, the recovery claim endpoint
rejects the request. Conquest of a defended or ruined *owned* location still
requires an authorized conflict plus the second, separate territorial outcome
approval; destroyed or abandoned owned sites enter **rebuilding** on approval.

Migration `082_npc_recovery_claims.sql` is additive. Rerun Windows setup after
pulling main and restart the API. The map view itself requires only refreshing
the deployed frontend; it doesn't rely on the new recovery table.
