# Eclipse Order — Imperial Faction Canon and Implementation Rules

Status: adopted narrative direction, November 2026. This document governs public-facing terminology and future content authoring; it is **not** a database migration or an automatic rewrite of players' records.

## Identity
The Eclipse Order is an **independent Garlean-influenced imperial villain faction**, led by Domina Rosa from New Cassia in northern Ilsabard. It seeks territorial control, political authority, military capability, industrial reconstruction and a lasting empire under the Eclipse. It draws on Garlean traditions but does not claim to be the restored Garlean Empire or to possess universal legal legitimacy.

The Order promises stability, infrastructure, loyalty and protection to its subjects. Its imperial ambitions may involve coercion, occupations, conquest, harsh rule and conflict with neighbors. Villainy does not require every member to be personally cruel, and characters can disagree about tactics without changing the faction's antagonist premise. Avoid presenting the faction as a mafia, criminal syndicate, smuggling ring or a collection of illicit business fronts. Individuals may have criminal histories, but criminal enterprise is not the faction's defining institution.

## Historical continuity
- The Order is a Garlean-influenced imperial villain faction, not a criminal syndicate.
- Its personal origin and exact founding chronology are **not established** in this document. Do not invent prior headquarters, supernatural origins, childhood history, or a formal founding era.
- The Final Days and the fall of old powers provide the setting for an Order rebuilding its influence.
- In the present era, **Domina Rosa** commands the Order from New Cassia in northern Ilsabard, where it pursues its own imperial ambitions.
- The Fangs, Snakes, Golden Claws, and Household remain the Order's current branches. Their earlier formation dates should not be asserted without renewed canon approval.

**Retired lore:** No Thirteenth origin or Yanxia headquarters/history is part of the Order's current canon. Historic database IDs and past migrations may still contain older labels for compatibility; these are not authoritative story text.

## World governance and gameplay
New Cassia is the Order's administrative and military seat, not automatically a fully recognized sovereign state. Region, zone, settlement, and faction ownership remain represented by existing world-admin data. Use explicit control and occupation states: do not automatically convert every inhabited settlement into Order territory. NPC autonomy, military authority and DM approval rules remain in force. Population, housing, food, workforce, power grids, trains, airships, warehouses, construction, diplomacy, war commands, research, and civilian welfare systems are retained.

The **Fangs** are the martial and security arm; the **Snakes** are intelligence and counterintelligence; the **Golden Claws** manage commerce, enterprise and supply. Household service and binding are separate from combat and economic branches. These are narrative duties, not changes to account authorization or character consent.

## Commerce
Use **Order Enterprises** for player-facing licensed businesses, with storefronts, staff, stock, expenses, revenue and approvals intact. Businesses are not automatically illicit covers. Preserve existing database tables (including `order_fronts`), `/fronts` endpoints, identifiers, categories, and saved records until a separately tested migration is warranted. Do not reset ledgers or ownership during terminology updates.

## Governance and events
Retain Domina authority, the existing Council and optional Senate mechanics, ratification requirements and permissions. **Council Meeting** is the Friday meeting for Order affairs and strategic decisions. **Imperial Assembly** is the Sunday gathering for proposals, funding requests, member creations, and project showcases. Neither is a public venue opening or obligates recurring nightclub staffing.

## Consent and technical boundaries
OOC consent, moderation, Discord access, and protected user records are distinct from fictional authority. Do not alter member permissions, Discord auth, characters, finances or simulation configuration simply to change lore text.

## Content management checklist
1. Update public copy, default Chronicles, recruitment and visible labels.
2. Review **persisted** `/lore/public` and `/faq/public` entries separately. The public site fetches these from the API and stored entries may supersede code defaults. Any editing of stored records requires authorized admin review and backing up originals.
3. Review event descriptions, faction entries, recruitment notices and Discord announcements that are user-created; do not overwrite member-authored stories.
4. Keep historical internal names and migration scripts for compatibility even where they mention `syndicate` or `front`.
5. Validate the frontend build, static public routes, tests, and live API behavior before declaring a production rollout complete.
