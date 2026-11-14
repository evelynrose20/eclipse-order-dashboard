# Imperium Noctis — long-term platform foundation and safe rollout

**Status: approved direction + design proposals; NOT implemented by this PR.**

## Product direction

A Raven's Keep-inspired **but original** immersive public site, connected member portal, encounter interface and staff authoring workshop. Discord authenticates identities and supplies mapped **baseline** role permissions; website-managed scoped appointments determine which exact records and operations each person can manage. IC rank and character status remain separate. Retain the current login until a verified account-linking migration is ready.

### Recruitment and consent
- Public applications for ordinary members and consensual servitude-RP storylines.
- Normal recruits select an IC introduction: contact, contract, sponsor, refuge or custom.
- Servitude applicants may propose a fictional auction/sale, negotiated capture/hunt, debt or other introduction. An independent OOC consent/limits step is required before RP; no blanket or irrevocable approval.
- Forms, routing, revisions, staff assignments and final membership decisions should be configured by staff. Discord changes follow durable, auditable workflow completion.

### Original character and RP rules
- Design original classes, abilities, progression, noncombat specialties and magic rather than retaining the six D&D-like starter classes as permanent lore.
- Custom player spells are drafts until a staff reviewer approves the **specific mechanically unchanged version**. Only approved spells may be executed in combat. Balance caps, costs, cooldowns and target/effect schemas belong in the rule engine.
- Existing characters, event XP, battle maps, dice and other working assets should be migrated rather than discarded.

### Factions and story
- Good, bad and ambiguous factions with distinct individual reputation, faction-to-faction relationships, territorial influence and Heat.
- Missions and Council mandates may update faction state through permitted, auditable staff actions.

### Living criminal underworld economy
- Order-owned large criminal operations (including wholly fictional illicit alchemy, contraband, smuggling, information and black markets).
- Individual player-owned **front businesses only**, all formally Order-affiliated and requiring **both IC and website approval**.
- Player production, gathering, crafting, inventory, quality, simulated currency, commissions, partnerships, treasury and transactions; regional supply/demand, scarcity, NPC competition, faction trade policies and changing prices.
- All fictional drug crafting uses **imaginary game materials and abstract mechanics**, not real recipes.
- Record all currency/item movements transactionally; cap automated economic ticks and use idempotent jobs. Event XP must not become purchasable with money.

### Reusable authoring and approvals
- Define permission groups, IC offices, appointments, applications, stages, reviewer scopes, no-self-approval rules, spell versions, businesses, recipes, factions and missions via safe validated schemas.
- No arbitrary workflow scripts or SQL. Draft/publish/versioning, audit trails, reversible states, retries and explicit privilege boundaries.
- Protect sensitive OOC profile/consent data with strict need-to-know rules and reasonable retention policies.

## Rollout sequence — safety gates, not a big-bang rewrite

1. **Foundation in isolation** (this PR): governance charter, agreed product rules, pure policy functions and synthetic-account regression tests. No schema changes, login changes or production endpoints.
2. **Private testing harness**: synthetic users with Discord-role permutations, multiple characters, applicants, reviewers and Council seats. Simulate approval/withdrawal/revocation and verify data cannot leak across accounts. Run independently of real Discord.
3. **Governance persistence behind disabled flags**: additive DB tables, workflow versioning and migrations with rollback/backups; tests on disposable MySQL first.
4. **Discord sandbox integration**: use an isolated test guild and role mappings, validate joining/leaving, revoked roles, failed role assignments, expired sessions and account linking. Keep the existing live login usable until proven.
5. **Staff-only Council and workflows**: trial votes, appointments, approval chains and audit without executing financial/gameplay effects.
6. **Member pilot with synthetic accounts**: recruitment, dual-approved fronts, spell review, economy and encounter authorization. Test negative paths and repeated submissions.
7. **Feature-by-feature controlled release**: publish only verified modules; each gets a test checklist, explicit enablement and rollback plan.

## Acceptance criteria before any live authorization changes

- **No migration surprises:** backups/restores tested; existing user accounts and characters intact.
- **No self-approval:** member, officer and Domina edge cases included as applicable.
- **No privilege escalation:** spoofed roles, old sessions, revoked Discord roles and unauthorized resources rejected by API.
- **No data leakage:** consent/OOC fields never surfaced solely by IC rank or staff UI preview.
- **No duplicate rewards:** repeated submissions cannot duplicate currency, items, XP or business licenses.
- **No Council ambiguity:** 5 seats, quorum 3, fixed 4 yes votes, reserved ratification in 7 days, vacant seats cannot lower threshold.
- **No external dependency surprises:** Discord failures and duplicate/out-of-order events do not corrupt grants.
- **No accidental launch:** features remain disabled until tests and explicit enablement.

## Synthetic test matrix (minimum)

| Test persona | Discord baseline | Website scope | Expected |
|---|---|---|---|
| Applicant Ada | Applicant | Own application | Can revise own draft, not approve |
| Member Bea | Member | Own characters | No staff/treasury capabilities |
| Event GM Cal | Event Staff | One encounter | Cannot manage other encounters |
| Commerce Officer Dee | Economy Staff | Harbor region | Can review assigned-region business, not other districts |
| Councilor Eli | Council access | Commerce seat | Vote only when eligible; no admin privileges |
| Revoked Fran | Role removed | Old appointment remains | All role-dependent access immediately denied |
| Domina Gia | Command | Council chair | Ratify reserved motion; no OOC consent bypass |

These are fabricated identities for testing, not real accounts; **the prototype must never write into production MySQL or live Discord**.

## What remains to design

Council succession/absence, emergency quorum handling, public-site visual system, original classes/RPG mathematics, exact economy pricing, faction names and territories, application question library, consent storage/retention, Discord role catalog and exact workflow schemas. Do not pretend these are finalized.
