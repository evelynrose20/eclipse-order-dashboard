---
tags: [diplomacy, npc, warfare, simulation, guide]
---
# Diplomacy, controlled territory and NPC simulation

**UI:** World Administration → Diplomacy & Wars / NPC Settlements / Simulation Rules; regional and settlement settings.

**Ownership is deliberate.** Diplomacy/trade proposals and war outcomes are reviewed under command authority. NPCs cannot annex existing Order or third-party land merely because simulation is enabled. Recovery claims target **unclaimed authored locations**; approving a ruined NPC claim can set its state to Rebuilding. Protected plots and hostile takeovers require the appropriate approval process.

**NPC simulation:** when configured and allowed, NPC settlements can consume supplies, produce local resources, accumulate development, start funded civic construction, change population/unrest and generate narrative events. NPC construction pays with NPC development points, which depend on actual economic activity; it does not debit Order Workshop stock. Simulation settings are intended to be distinct for NPC and Order-controlled settlements; avoid toggling Order self-development just to test NPCs.

**Order-managed civics:** uses its own civic stock, commitment, workforce and managed-cycle requirements. Region Off/Narrative/Managed, settlement simulation_enabled and civic profile mode/pause determine eligibility. “On” in one screen does not override a region-wide Off or paused civic profile.

**War:** results and political control changes require authorized approval. The system separates a proposed conflict, an approved outcome, a site's current controller and its physical condition. A capture can leave a location occupied or rebuilding, not magically operational. NPC war and diplomacy can drive story events but do not bypass approvals.

**Code:** `world-diplomacy.js`, `world-recovery-claims.js`, `world-settlement-simulation.js`, `world-npc-economy.js`, `world-npc-founding.js`, `world-administration.js`. Additional design: [[NPC-DIPLOMACY-AND-APPROVED-WARS]], [[LIVING-WORLD-WAR-COMMAND-MASTER-PLAN]].
