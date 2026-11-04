# Eclipse Order — Operations

## Database migration

For a fresh project, apply the baseline SQL under `supabase/SETUP-ALL.sql` and then the new **`supabase/profile-encounters.sql`** migration. For an existing Supabase project, first inspect the installed schema and back it up; apply only missing forward migrations. A GitHub build does not install SQL.

The new migration creates private `order_profile_preferences`, encounter/turn/combatant/dice tables, and server-checked RPCs. It revokes the legacy scene-consent endpoints while preserving historical records. This revision does not require ID scans or document storage.

## Eligibility model

- Each member must declare they are at least 18 and choose their private content categories.
- The Domina controls the separate adult-access flag after the FC's appropriate off-platform member screening. This flag is not proof of age or identity.
- No ID upload, birthdate, documentary age verification or identity document storage is built into the app.
- Member profile choices are private and editable; encounters list their required themes.
- Server RPCs deny encounter rolls when the member is not approved, has not declared 18+, lacks a required profile category, or has paused OOC participation.
- Encounter GMs should honor stop/withdrawal requests outside the app as well. Profile opt-ins never authorize coercing an OOC participant to continue.

## Acceptance tests before release

1. Test the Domina, unrelated member, bound member and assigned handler roles in separate authenticated browser sessions.
2. Verify private profile preferences cannot be read or modified by another account's API calls.
3. Check that new characters can become bound/unbound with separate player approval and full sheet preservation.
4. Create an encounter; add a GM NPC and an eligible player character; verify initiative ordering and turn/round progression.
5. Change combatant HP, AC, initiative and conditions; verify values persist across reloads and are not editable by ordinary members.
6. Test public dice, GM-only dice, advantage/disadvantage and shared history.
7. Reject dice rolls when a user is not eligible, has not opted into required themes, or has paused OOC.
8. Verify a player can pause participation even when bound. Confirm profile changes take effect without a code deployment.
9. Ensure unauthorized accounts cannot see GM notes or private player preferences.
10. Check browser/mobile layout, expired sessions, offline behavior, safe migration to staging and backup restore.

## Backups and release controls

Automated encrypted offsite backup and restoration are still **not configured**. Back up the database privately and test a restore before production. Do not upload private records into public GitHub Actions artifacts.

Deploy only after database setup, integration tests and explicit review. Use a staged PR rather than directly pushing work to the live `main` branch. Update dependencies periodically and keep independent backups.
