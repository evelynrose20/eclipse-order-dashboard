# Eclipse Order — Event Planning & Roster Update

This feature is on draft PR #10 and is **not yet deployed**. Existing Supabase data remains where it is. Do not rerun old setup scripts.

## New roster structure

Character roster has two lists:

- **Free members**: any character with `collar_bound=false`. Their account's membership standing is a different system.
- **Bound characters**: any character with `collar_bound=true`, with exactly these four ranks:
  - Rank I: Fresh Intake / Unbroken
  - Rank II: Initiate / Indentured
  - Rank III: Trusted / Specialized
  - Rank IV: Elite / Favor of the Domina

Existing records are renamed in the forward migration. Their character IDs, owners, player links, sheets, HP and magical-binding status are preserved. Free ↔ bound changes still require player OOC approval through Binding requests; a rank dropdown cannot bind or unbind anyone.

## Planned FC event workflow

1. A Domina, High Command officer or designated Master/Mistress opens **Encounters & dice → New event**.
2. Set the event's name, description, date/time, location, party size and content-theme tags. By default it's a **private draft**.
3. Prepare monster/NPC stat blocks, bosses and enemies under **Combat setup**. This is possible before any player signup.
4. When ready, **publish** the event under Event details to open registration.
5. Members see the event and sign up using their own linked character. Private OOC category preferences are checked by Supabase; a player can withdraw.
6. Under **Sign-ups**, the event GM approves or declines applications.
7. The GM explicitly clicks **Add to party** for an approved character. Approval never automatically changes the battle map or character roster.
8. Place the party, NPCs and bosses on the battle map and roll initiative.
9. Start combat only when the actual event begins. Run turns and dice from separate **Live encounter** and **Dice & checks** tabs.

The navigation now has: Overview, Event details, Sign-ups, Combat setup, Battle map, Live encounter, Dice & checks.

### Permission and privacy rules

- Only the linked player account can sign up using that character.
- Only the event director can approve signups, edit private draft content, or add approved players to a party.
- Normal members see only **published events** and **their own signup entries**, never everyone's pending requests.
- The character's collar status has no bearing on whether the player can sign up or withdraw OOC.
- The event's published content tags are checked against the player's **private profile** when signing up. Other players do not see their private preferences.
- Withdrawing from an event removes the character from that event's combatant party, including mid-event if necessary.
- Boss and NPC setup is GM-controlled, and unrelated characters cannot be added as player combatants without an approved signup.

## Deployment

1. Back up your Supabase database.
2. Make sure the existing `supabase/profile-encounters.sql` and `supabase/battlemap-dice.sql` have been applied successfully.
3. Open **[supabase/events-roster.sql](../supabase/events-roster.sql)** and run that **new forward migration only** in the trusted Supabase SQL Editor.
4. Use the Supabase RLS confirmation's secure option if Supabase detects table creation; the new signup table explicitly enables RLS and revokes direct client table access.
5. Test on a GM account and a normal member account. Test rank migration, private draft visibility, member signup, GM approval, party assignment, withdrawal and original character-sheet preservation.
6. Merge the reviewed PR only after SQL and authorization tests pass. GitHub build success alone does not test Supabase.

The application and schema are not automatically deployed by this GitHub branch.
