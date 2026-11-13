---
tags: [fronts, commerce, trade, treasury]
---
# Fronts, commerce, treasury and NPC trading

**UI:** Fronts, Commerce/Trade, Treasury; World Admin diplomacy and logistics trade-treaty controls.

**Fronts** represent continuing operations with their own balances, daily costs, supply allocations and status. A front's daily rent/upkeep can spend funds; reserving a crafted good for a front should be an accountable allocation from real FC materials, not a free duplicate. Review both front balance and linked stock before assuming a project can continue indefinitely.

**Commerce:** contracts and goods must be validated against actual materials/equipment and allowed counterparties. A successful delivery can create revenue recorded in the Order treasury. An order/trade contract is not equivalent to immediately receiving physical goods in a different city's warehouse.

**Treasury and wallets:** the ledger tracks income/expenses and, where enabled, character wallet/payroll entries. Payroll has configured enablement and once-per-cycle safeguards; do not assume a displayed rank implies automatic salary without the relevant settings. Financial balances are separate from physical inventories.

**Diplomacy and trade treaties:** proposed NPC trade agreements can be accepted, countered or rejected based on trust/tension, with scheduled response/start/end times. A treaty/approved deal can permit trading but does not itself prove that goods are already transported. Route capacity, source stock and actual deliveries still matter.

**Code:** `Fronts.jsx`, `Commerce.jsx`, `Treasury.jsx`, `TradeWorkspace.jsx`, `fronts.js`, `commerce.js`, `treasury.js`, `world-treaty-negotiations.js`, `world-logistics.js`. Related [[06-LOGISTICS-AND-WAREHOUSES]].
