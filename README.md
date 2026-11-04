# Eclipse Order — D&D FC and RP platform

Eclipse Order combines character sheets, in-world magical binding mechanics, role-based FC administration, private player OOC content preferences and shared tabletop encounters.

## Current development status

The new encounter/profile revision is on **draft PR #8** and is **not deployed**. Database functions still require migration and manual permission testing in Supabase. A successful GitHub build is not proof that the SQL is installed or safe.

## Player features

- **My RP profile:** players privately select which content themes they generally allow. The default is opt-out. An account-level 18+ declaration is available; no IDs or identity documents are collected.
- **Encounters & dice:** directors create named encounters and declare thematic categories, manage combatants and initiative, track rounds/turns, update HP and AC, mark conditions, and roll on the Supabase server.
- **OOC pause:** every player can pause participation in an encounter regardless of IC rank, collar, or other story restrictions.
- **Character sheets:** full D&D-style sheet for authorized characters; redacted bound-character sheet for the linked player. Free ↔ bound transitions require explicit linked-player approval and preserve the entire sheet.
- **Account roles:** Domina, High Command, assigned Master/Mistress handlers and normal members.

Player selections remain private to their own account. The encounter API checks eligible accounts and required themes; staff don't receive a list of private unchecked categories. General profile opt-ins are **not** unlimited or irrevocable consent. Players can change preferences and pause/leave scenes at any time.

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
