# Eclipse Order — D&D FC and RP platform

Eclipse Order combines character sheets, in-world magical binding mechanics, role-based FC administration, private player OOC content preferences and shared tabletop encounters.

## Current development status

The new encounter/profile revision is on **draft PR #8** and is **not deployed**. Database functions still require migration and manual permission testing in Supabase. A successful GitHub build is not proof that the SQL is installed or safe.

## Player features

- **My RP profile:** players privately select which content themes they generally allow. The default is opt-out. An account-level 18+ declaration is available; no IDs or identity documents are collected.
- **Encounters & dice:** directors create named encounters and declare thematic categories, manage combatants and initiative, track rounds/turns, update HP and AC, mark conditions, save reusable homebrew monster/NPC stat blocks, automatically roll initiative, and roll on the Supabase server.
- **OOC pause:** every player can pause participation in an encounter regardless of IC rank, collar, or other story restrictions.
- **Character sheets:** full D&D-style sheet for authorized characters; redacted bound-character sheet for the linked player. Free ↔ bound transitions require explicit linked-player approval and preserve the entire sheet.
- **Account roles:** Domina, High Command, assigned Master/Mistress handlers and normal members.

Player selections remain private to their own account. The encounter API checks eligible accounts and required themes; staff don't receive a list of private unchecked categories. General profile opt-ins are **not** unlimited or irrevocable consent. Players can change preferences and pause/leave scenes at any time.

## D&D encounter battle maps and dice (new branch)

- Battle map with player/monster tokens, current HP labels, dungeon/forest/parchment terrain, optional HTTPS map artwork, and touch/drag placement.
- Each token placement is a single Supabase update; no map image is stored in the database.
- GM roll requests and player responses, server-recorded attack vs AC, saves/skills vs DC, natural critical outcomes, damage, healing, death/concentration saves, and advantage/disadvantage.
- A verified damage or healing roll can change combatant HP exactly once. D&D encounter mechanics not yet automated are tracked in the roadmap.
- The old double adult-access blocker has been replaced with the saved profile 18+ declaration. Profile now has a top Save button. No identity document is requested.

To activate this revision, apply the forward SQL migration [battlemap-dice.sql](supabase/battlemap-dice.sql) **after** profile-encounters.sql, then save your My RP profile and reload. See [Battlemap & Dice Setup](docs/BATTLEMAP-DICE.md) for a short troubleshooting and security checklist.

## FC event planning and roster (new draft feature)

- Free characters and magically bound characters have separate roster lists.
- Bound ranks: **Rank I: Fresh Intake / Unbroken**, **Rank II: Initiate / Indentured**, **Rank III: Trusted / Specialized**, **Rank IV: Elite / Favor of the Domina**.
- Events are created as **private planned drafts** with date/time, venue, description, capacity, and publicly declared themes.
- A GM can prepare monster stat blocks, NPCs, bosses, map tokens and encounters before publishing.
- Members can request a place using their own linked character after registration opens. A GM approves the signup and chooses when to add the character to the party. Players can withdraw OOC.
- The event workspace is divided into Overview, Event details, Sign-ups, Combat setup, Battle map, Live encounter, and Dice & checks.
- Published event details are visible to members. Unpublished drafts and the full signup list remain GM-controlled.

**For an existing project**, back up Supabase and apply only the new forward migration [events-roster.sql](supabase/events-roster.sql) **after** the existing battlemap-dice.sql migration. Do not rerun your old SETUP-ALL.sql. Details: [Event Planning guide](docs/EVENT-PLANNING.md).

## Database setup

**Existing project:** after a database backup and verifying the previous schema, run the new forward migration **supabase/profile-encounters.sql** in Supabase SQL Editor. The existing `supabase/SETUP-ALL.sql` is a baseline script and does **not** include this migration. Do not rerun earlier migration scripts blindly.

**New project:** apply baseline migration scripts as documented in [Operations](docs/OPERATIONS.md), then apply `profile-encounters.sql`.

Accounts are provisioned in Supabase Auth; adult access is moderated with the existing Domina permission flag. This is an administrative eligibility review, not a formal ID-based age-verification system. No identity documents are collected by Eclipse Order.

## Development

```sh
npm ci
npm test
npm run build
npm run dev
```

See [AGENTS.md](AGENTS.md), [Operations](docs/OPERATIONS.md), and [Roadmap](docs/ROADMAP.md). Do not merge into `main` or deploy until the migration, privacy tests, authorization, backups, and browser QA are complete.

The old hard-coded frontend admin password remains in Git history; rotate it anywhere reused. Never commit database secrets, member passwords, private character histories or backups.
