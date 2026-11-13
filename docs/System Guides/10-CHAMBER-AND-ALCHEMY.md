---
tags: [chamber, alchemy, character, inventory]
---
# Aetheric Extraction Chamber and alchemy inventory

**UI:** Character contribution preferences; Aetheric Extraction Chamber control room; Collected Batch Inventory; FC Workshop.

**Manual sequence:** seat eligible character; reservoirs start **Offline**; manually put one or both to **Ready**; Start activates only prepared assemblies. Each reservoir can operate independently. Stop or power loss interrupts production. The selected character's profile and available daily capacity gate output.

**Daily capacity:** standard Lacteal baseline is 18 units for established production (8 for variable; zero if unavailable). Secondary baseline is 6 units when eligible. Staff-managed enhancement tiers can increase Lacteal to 24/30/40/50 and Secondary to 8/10/14/18, without automatically changing extraction speed. Profile eligibility remains required.

**Rate:** with an unlinked legacy power source, 0.1 fluid unit every 30 seconds; with a linked world generator, Low/Outage pauses, Good gives 0.2 per 30 seconds, Perfect 0.5 per 25 seconds. Values update in tenths and persist in decimal database columns. Separate chambers/assemblies do not share daily balances.

**Collected Batch Inventory:** separate lacteal and secondary views show character-attributed fluid tanks. Decant from a live collection reservoir into its matching attributed tank; drain whole fluid units into the shared Workshop and Garden crafting-stock ledger. Fractional residual stays in the tank. Do not assign old unclassified/legacy liquid to the wrong character. Custom fluid display names are staff-controlled; changing a label never changes fluid quantity, material type or provenance.

**Demon Dust:** the existing recipe retains Hellshade Bloom and Moonstone and includes chamber reagent inputs; draining into Workshop is required before crafting from those goods. The chamber is not automatically refilled by Workshop stock.

**Troubleshooting:** check selected power source and grade, assembly state, chair occupancy, character permissions, available daily balance, full tank, incompatible/misattributed legacy stock, Windows API health and migrations. Do not change stock by hand to conceal a failed extraction timer.

**Code:** `ThrallChamber.jsx`, `ContributionPreferences.jsx`, `thralls.js`, `chamber-stimulation.js`, `world-power.js`, `crafting.js`.
