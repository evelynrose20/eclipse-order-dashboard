## Supabase SQL Editor warning and previous syntax failure

The SQL Editor can warn that a migration creates tables without RLS even when the script later enables RLS. **Choose "Run and enable RLS" (green)** for the corrected migration. The two new tables are also explicitly configured with `ENABLE ROW LEVEL SECURITY`, and browser table privileges are revoked.

If you previously got `ERROR 42601: syntax error at or near "then" LINE 681`, you had the corrupted older copy of `supabase/battlemap-dice.sql`. **Discard that copied SQL**, open the updated file on branch `feature/encounter-battlemap-dice`, and copy the entire updated script. It was rebuilt into a single transaction, with duplicate RPC bodies removed. Do not try to delete just line 681; there were more malformed duplicates.

The GitHub unit tests and frontend build pass, and the SQL now passes structural duplication/delimiter checks. **It has not yet been executed against your live Supabase project or a test database**, so report any new SQL error verbatim rather than applying individual fragments.

# Eclipse Order — Encounter map and dice release checklist

This is development code in PR #9; it has **not** been applied to the live Supabase database by GitHub.

## To activate this version

1. Back up the existing Supabase PostgreSQL data.
2. Confirm that `supabase/profile-encounters.sql` was already applied; the encounter and profile tables must exist.
3. Run **`supabase/battlemap-dice.sql`** from this branch, once, in the trusted Supabase SQL Editor.
4. Open **My RP profile** and confirm you are 18 or older; the new checkbox saves the declaration automatically. Click **Save profile preferences** after changing content categories.
5. Reload **Encounters & dice**. If no encounters exist, that is a valid empty state; create one with a Domina, High Command, or Handler account.
6. If you cannot create encounters, check that your Supabase Auth email was assigned the correct Order role via `order_members`. The user's main login email is NOT automatically an admin solely because they own the website.

The previous "Adult-only access not enabled" error came from a second, independent `order_members.adult_approved` check. The migration retires that staff approval control and changes encounter access to use the player's **saved 18+ profile declaration** instead. It does not request or store identity documents. An 18+ self-declaration is not conclusive verification of actual age.

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
- Two combatants cannot occupy the same tile; moving a token makes one write, and an external battlemap image only stores a URL.
- Attack vs AC applies natural-20/1 behavior; saves and ability checks use DC totals.
- GM-private rolls are invisible to unrelated members.
- GM roll requests cannot be answered by the wrong account; ability/save/skill proficiency modifiers can be filled from the authorized character sheet.
- Reapplying the same damage/healing roll is rejected without changing HP twice.
- Member OOC pause or category opt-out blocks rolls, including on bound characters.
- Export and restore a database backup before production.

No files with member OOC preference data or private character information belong in the public GitHub repository.

## If there is still no Create Encounter control

The signed-in account may not have a GM-capable Order role. Verify in the trusted Supabase SQL Editor (replace the placeholder with the actual account email):

```sql
select u.email, coalesce(m.role,'NOT APPROVED') as order_role
from auth.users u left join public.order_members m on m.user_id=u.id
where lower(u.email)=lower('YOUR_EMAIL_HERE');
```

Only `domina`, `high_command`, and `handler` can create an encounter. Existing encounter records are empty until a GM creates one; “No encounter selected” is not a database error by itself.
