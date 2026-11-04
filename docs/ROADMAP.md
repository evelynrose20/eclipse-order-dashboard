# Eclipse Order roadmap

Implemented in development (not necessarily live):
- [x] Redesigned dashboard, command hierarchy and full D&D character dossiers
- [x] Free ↔ bound character status changes requiring player OOC approval
- [x] Private player-profile category preferences; no ID collection
- [x] GM encounter creation with theme declarations and saved combatants
- [x] Initiative, turns and rounds, HP, AC, conditions, NPC and player records
- [x] Server-recorded dice formulas, advantage and GM-only visibility
- [x] Encounter OOC pause and profile-category checks
- [x] FC policy editor, role management and character-change audits
- [x] Basic rules unit tests and CI production-build verification

Required to reach full D&D Beyond-like usability and years of reliability:
- [ ] Apply and integration-test the new SQL migrations with real Supabase accounts
- [ ] Character spell-slot/rest trackers, automatic damage/healing, resistances and concentration
- [ ] Stat-block/monster compendium, encounter templates and dynamic difficulty calculations
- [ ] Roll requests, contested checks, saving throws, real-time party display and campaign linkage
- [ ] Full profile privacy and OOC withdrawal tests plus incident handling/moderation policies
- [ ] Granular theme subcategories and dedicated private safety boundaries if members request them
- [ ] Admin-controlled house-rule and rank editors rather than hardcoded mechanics
- [ ] Automated encrypted offsite database backups with tested restores
- [ ] End-to-end browser tests, staging release checks, error monitoring and rate limiting
- [ ] Accessible mobile layouts and data-retention/deletion workflow

A green frontend build is not the same as verified SQL migrations, permission security or a production-ready app.
