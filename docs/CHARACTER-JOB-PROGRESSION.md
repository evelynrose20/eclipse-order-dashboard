# Character jobs and progression

The **Homebrew Classes** management screen has been retired. There is no longer an administrative workflow for creating or rewriting class definitions.

## Current behavior

- The character editor continues to offer the established FFXIV tabletop job catalog, including Bastion and Zephyr.
- Character dossiers retain job abilities, spellbook unlocks, spell points, event-based progression and existing character levels.
- The authenticated `GET /classes` endpoint remains available for the character editor and encounter tools.
- `PUT /classes/:id` is no longer available. Definitions are read-only.
- Historically saved class definitions in `order_homebrew_classes` remain in the database so existing characters using those IDs are not broken.
- The historical `010_homebrew_classes.sql` migration stays in the repository for compatibility with fresh or upgraded installations; it is not new feature configuration and should not be dropped from old migrations.

## Operational note

Do not delete `order_homebrew_classes` or automatically reassign class IDs on character sheets. Removing either could invalidate existing character data or spell progression. Future changes to the standard job rules should be made as an explicit, separate ruleset change, with tests for existing characters.

This cleanup requires a frontend and API deployment, **not** a new SQL migration.
