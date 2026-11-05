# Eclipse Order — events, roster and XP

The event planner is implemented in the Windows/MySQL codebase. This guide documents the current workflow, not an unpublished draft PR.

## Character roster

Free characters have `collar_bound=false`. Bound characters have `collar_bound=true` and a separate in-character progression:

- Rank I — Fresh Intake / Unbroken
- Rank II — Initiate / Indentured
- Rank III — Trusted / Specialized
- Rank IV — Elite / Favor of the Domina

This is distinct from the **five syndicate account ranks**. A rank setting must not bypass explicit player OOC approval for binding or unbinding.

## Event workflow

1. A GM opens **Encounters & dice** and prepares a private event draft with location, timing, capacity and publicly declared content themes.
2. Prepare monsters, NPCs, bosses and the battle map before opening registration.
3. Publish the event to open signups. Members use an eligible linked character; their private OOC preferences remain private.
4. The GM reviews applications, approves participation, and separately adds approved characters to the party.
5. Run initiative, turns, rolls and HP changes during the event. Players retain OOC pause and withdrawal controls.
6. Mark the event **completed**.
7. In the GM event overview, choose an eligible participating character and grant event XP. The award is stored in `order_event_xp_awards` and applied through character progression. **Only one XP award per character per event** is permitted; direct arbitrary XP grants from character sheets are not used.

Only authorized event staff should manage event participation and XP; a member's in-character status never overrides OOC boundaries. Test signup privacy and withdrawals with multiple accounts before launch.

## Windows database setup

From the `server` folder, **after backing up MySQL**, run `npm run setup:local` and restart Node. This installs additive MySQL migrations, including `008_event_xp`. It does not replace existing characters. Verify that old accounts still work and test an actual event XP award.

The `supabase/events-roster.sql` file belongs to the historical PostgreSQL compatibility path; it is not a Windows/MySQL installation step. A GitHub frontend deployment does not update the Windows database.
