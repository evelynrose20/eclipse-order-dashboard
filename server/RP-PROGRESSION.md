# Eclipse Order — RP progression and economy (draft)

This feature is developed on `feature/rp-progression-economy` / draft PR #13, not on the currently deployed `main` branch.

## Character creation and classes
New D&D character sheets start at **level 1, 0 XP**, with 27 points to allocate among STR, DEX, CON, INT, WIS and CHA, using the cost schedule 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=7 and 15=9. Each ability must start between 8 and 15. The class sets the hit die, saving throws, starting HP and baseline abilities.

Six starting homebrew D20 classes are Warrior, Rogue, Mage, Healer, Ranger and Bard. Classes unlock signature abilities at levels 3, 7, 11 and 15. XP for level L is 100 × L × (L−1), to maximum level 20. Levels 4, 8, 12, 16 and 19 grant two ability improvement points, each granting +1 to a score up to 20. Command grants XP and members spend earned ability points through the economy/treasury panel. Neither class, level nor XP may be edited directly on a progression-managed sheet.

**Existing character sheets are NOT reset.** Records created before this feature remain legacy sheets until an explicit conversion system is designed. They are not automatically upgraded or given arbitrary starting stats.

## Wallets, purchases and paychecks
Each character has a separate MySQL wallet, item quantities and economy transaction history. Gil balances are never taken from the editable freeform `gil` sheet field. Purchases check available balance and record item stock and debit in a single transaction. The initial catalog has RP accessories, equipment, a tonic and a narrative deed; these are stock entries, **not automatic dice modifiers or changes to player consent**.

Order command can issue **one paycheck per character per UTC calendar week**, with a proposed default base salary of 1,000 gil editable at payout. Existing FC rank allowance percentages are reused: free = 100%, Bound I = 0%, Bound II = 10%, Bound III = 25%, Bound IV = 40%. These are *provisional gameplay settings*, not real-world obligations. Paychecks are manually approved rather than sent automatically.

For flavor, bound characters receive one free rank-based ration item per UTC day. Bound players can claim their ration themselves, even when their full sheet and inventory are sealed. Rations have no debuffs or OOC restrictions. Command may promote a bound rank separately from the player-approved bound/free status workflow.

## Local database installation — does not delete accounts
Update the development branch on your Windows PC and preserve your private `server/.env`. Back up the `eclipse_order` database with HeidiSQL. Stop the backend, then in the `server` folder run:

```powershell
npm run setup:local
npm start
```

The existing setup command requests the **MySQL administrator password**, not the Domina account password. It applies the additive `server/sql/006_economy.sql` migration for wallets/catalog/inventory/paychecks/rations without dropping existing accounts or characters. Never commit your `.env`. Run the website frontend on its existing configured port as usual.

## Release checklist
The GitHub Actions workflow includes React build/tests and MySQL 8 schema installation tests. Before merging PR #13, manually test on Windows with an empty newly created character, allocate exactly 27 points, save a class, award XP, spend a milestone ability point, pay once and reject a second payroll payment in the same week, purchase an item, and claim rations once per UTC day. Confirm restricted bound users cannot read wallets or buy items unless authorized. Do not deploy a draft branch or migrate existing character levels automatically.
