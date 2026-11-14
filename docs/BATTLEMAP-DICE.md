# Imperium Noctis — battle maps and encounter dice

Battle maps and server-verified encounter dice are implemented in the Windows/MySQL member portal. The feature originated in the historical Supabase implementation; the old PostgreSQL SQL Editor troubleshooting steps are not part of the current Windows deployment.

## Using the encounter workspace

1. A GM creates or selects a permitted encounter and prepares NPCs, bosses and participant records.
2. Open the battle map to place tokens. Desktop users drag-and-drop; touch users can select a token and tap a location.
3. GMs can set terrain and optionally supply a trusted HTTPS background image URL. The application stores the URL and tile positions, not uploaded image data.
4. Use dice/check controls for attacks, saves, damage, healing, advantage/disadvantage and GM requests. Rolls and encounter progress are recorded by the server.
5. Members can participate only if they are eligible under the event/profile restrictions; OOC pause/withdrawal must remain available.

Token movements are saved on placement rather than on every drag frame. Encounter controls require authorized roles; GM-only information must not be disclosed to unrelated members.

## Feature boundaries

This is a tabletop encounter tool, **not** a complete D&D rules implementation. Complete spell slot/rest resources, automatic resistances and concentration duration, encounter balancing, line of sight, and a fully automatic monster controller are not guaranteed. Record those as optional follow-up features rather than claiming they already work.

## Release tests

Test with separate GM, ordinary-member, unrelated-member and bound-player sessions:

- A GM may configure combatants and move tokens; an unrelated player cannot modify the encounter.
- A member can use eligible rolls but cannot see GM-only results or notes.
- Attack vs. AC, ordinary DC checks, damage/healing and duplicate damage application behave consistently.
- Saved HP, status and token positions survive reload.
- Private profile preferences are never revealed to the GM or other members.
- OOC pause and withdrawal deny further participation regardless of character binding.
- Mobile/touch token placement and an HTTPS map image behave correctly.

Back up MySQL first and run the current Windows setup from `server/` as described in [the backend guide](../server/README.md). Do not apply historical `supabase/battlemap-dice.sql` to MySQL. GitHub CI cannot replace a live multi-account authorization test.
