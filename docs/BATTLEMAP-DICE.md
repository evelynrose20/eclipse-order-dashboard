# Eclipse Order — Encounter map and dice release checklist

This is development code in PR #9; it has **not** been applied to the live Supabase database by GitHub.

## To activate this version

1. Back up the existing Supabase PostgreSQL data.
2. Confirm that `supabase/profile-encounters.sql` was already applied; the encounter and profile tables must exist.
3. Run **`supabase/battlemap-dice.sql`** from this branch, once, in the trusted Supabase SQL Editor.
4. Open **My RP profile**, confirm you are 18 or older, and **click Save profile preferences**. The checkbox alone was not persisted in the old UI.
5. Reload **Encounters & dice**. If no encounters exist, that is a valid empty state; create one with a Domina, High Command, or Handler account.
6. If you cannot create encounters, check that your Supabase Auth email was assigned the correct Order role via `order_members`. The user's main login email is NOT automatically an admin solely because they own the website.

The previous "Adult-only access not enabled" error came from a second, independent `order_members.adult_approved` check. The migration changes the encounter access helper to use the player's **saved 18+ profile declaration** instead. It does not request or store identity documents. An 18+ self-declaration is not conclusive verification of actual age.

## Battle map

- Select an encounter, create combatants and place them using drag-and-drop (desktop) or select + tap a tile (touch).
- Player tokens and monster/NPC tokens show current HP on the grid.
- GMs can switch terrain and optionally paste a trusted HTTPS map image URL.
- Map URL strings and combatant tile coordinates are stored, not image files.
- Token movement makes one database write when a token is placed, not continuous writes during dragging. Server checks that the tile is in bounds and not occupied.
- Refresh is polling, not a realtime websocket. For a small FC this is inexpensive, but it is not tuned for hundreds of simultaneous users.

## Dice

- Roll presets: ability, skill, saving throw, attack vs AC, contested check, damage, healing, death save, concentration, advantage, disadvantage, percentile and custom.
- Typical formulas: `1d20+5`, `2d20kh1+4`, `2d20kl1+2`, `2d6+3`.
- GMs can request a DC check or saving throw from a player character in the encounter; only the linked player can resolve the request.
- Ordinary d20 checks compare totals with DC; natural 20/1 automatically affect attacks, not ordinary skill checks.
- Damage/healing rolls can be applied to a selected combatant exactly once, using an atomic server-side operation.
- Dice results are persisted server-side; GM-private visibility is filtered in the RPC.
- Rolls require the account's saved profile eligibility, permitted encounter content categories and an unpaused OOC state.
- GM quick damage/heal controls, manual status effects, automated initiative and rounds are also available.

## Important limitations

This is a substantial D&D encounter foundation, not a complete rules encyclopedia or licensed replacement for D&D Beyond. Spell-slot tracking, concentration durations, automatic attack/spell resources, advantage sources, death-save counters, automatic monster attacks, encounter balance, line of sight, terrain effects, real-time presence and private map uploads are not all implemented. Manual permission testing is required before a live rollout.

## Security and QA

In a separate Supabase staging project, test:
- Normal member with 18+ declaration **saved** can view an encounter.
- The same member without a saved declaration is rejected.
- GM creates an encounter and adds a linked consenting member; no profile preference details leak.
- GM can move tokens but a member cannot call `order_move_token`.
- Drag/touch placement causes one save per move and persists after reload.
- Two combatants cannot occupy the same tile.
- Attack vs AC applies natural-20/1 behavior; saves and ability checks use DC totals.
- GM-private rolls are invisible to unrelated members.
- GM roll requests cannot be answered by the wrong account.
- Reapplying the same damage/healing roll is rejected without changing HP twice.
- Member OOC pause or category opt-out blocks rolls, including on bound characters.
- Export and restore a database backup before production.

No files with member OOC preference data or private character information belong in the public GitHub repository.
