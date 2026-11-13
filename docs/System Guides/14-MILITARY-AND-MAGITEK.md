---
tags: [military, magitek, readiness]
---
# Military installations, readiness and magitek equipment

**UI:** World Admin military installations and magitek equipment/fleet tools; Logistics for transports and deliveries.

Military installations are not merely map icons. They record assigned troops/equipment, condition and ammunition on hand. A castrum needs supplies at the actual site; the global Workshop or a factory stock figure does not mean the castrum possesses it. Military ammunition deliveries debit a chosen industrial source and credit installation stock through a ledger.

**Readiness** reflects the installation's actual equipment/state and supplies; it is not the same as a territorial condition of Secure/Occupied. Damaged vehicle lots or a damaged installation should be restored through the appropriate repair/project controls; newly fabricated tanks, trains and airships originate from industry/equipment templates and must be assigned/transported into service.

**Example:** Castrum Moonlight's ammunition requirement should be satisfied by factory production → actual stock movement → a warehouse if needed → delivery to the installation. Do not manually set a warehouse or castrum quantity to simulate a missing transport route.

**War permission:** resource readiness may enable an operation but does not grant permission to conquer a faction or overwrite the outcome of a GM-approved battle.

**Code:** `MilitaryInstallationsPanel.jsx`, `MagitekEquipmentPanel.jsx`, `world-military-installations.js`, `world-military-readiness.js`, `world-magitek-equipment.js`, `world-industry-engine.js`. Related [[06-LOGISTICS-AND-WAREHOUSES]], [[07-DIPLOMACY-WAR-AND-NPC-SIMULATION]], [[P3-MAGITEK-EQUIPMENT]].
