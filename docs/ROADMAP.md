# Roadmap — long-lived Eclipse Order FC app

Completed in development code (not yet production validated):
- [x] Redesigned command dashboard and role-based D&D character sheets
- [x] Domina, High Command, Master/Mistress and Member roles; independent member standing
- [x] Reversible magical binding with OOC approval from the linked player
- [x] Shared scene creation with immutable declared themes and OOC opt-in/pause/revoke
- [x] Server-generated dice, logged rolls, advantage/disadvantage and GM-private visibility
- [x] Domina-reviewed adult RP eligibility flag
- [x] Character-change audit log and basic automated rule tests

Still needed before calling it a production-ready, years-long system:
- [ ] Apply and test all database migrations on Supabase
- [ ] Independent multi-role permission tests and safety tests using real JWTs
- [ ] Actual adult eligibility verification process and moderation policies
- [ ] Private invited scenes, granular content boundaries and incident-response tools
- [ ] Full D&D mechanics (rests, spell slots, status effects, encounters, GM requests)
- [ ] In-app editors for ranks, rules, conditions, catalog items and campaign settings
- [ ] Automated encrypted offsite backups, restore drills and retention/deletion
- [ ] Dedicated staging environment, end-to-end browser QA, alerts and rate limiting
- [ ] Release procedures and maintenance review cadence

A green frontend build is only syntax/dependency validation; it does not prove SQL security, database migrations, privacy, consent enforcement or reliability.
