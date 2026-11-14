# Imperium Noctis — Imperial Chain of Command

The public hierarchy is a connected organizational chart rather than a single vertical ladder. Rank titles are Latin or Latin-inspired and draw on Garlean military conventions; invented faction offices are not asserted to be canonical Garlean ranks.

## Central command

1. **Imperatrix — Rosa**: sovereign and final authority.
2. **Praefectus Imperii**: principal deputy and administrative/executive coordinator.
3. **Consilium Imperiale**: Imperial Council, responsible for strategic advice and policy under the Imperatrix. Its existing governance and ratification mechanics stay unchanged.

The four operational branches descend from imperial command:

| Branch | Mandate | Progression (lowest → highest) |
| --- | --- | --- |
| **Garlean Shadows** (`snakes`) | Intelligence, reconnaissance, counterintelligence, covert operations | Tiro Umbrae → Speculator → Explorator → Frumentarius → Magister Umbrae |
| **The Legions** (`fangs`) | Military operations, defense, territorial security | Tiro → Miles → Optio → Centurio → Legatus |
| **Officium Aerarii** (`golden_claws`) | Treasury, enterprise, trade, procurement, supply | Discipulus → Scriba → Negotiator → Quaestor → Procurator |
| **R&D** (`household`) | Magitek, scientific research, technical development | Discipulus Technicus → Artifex → Machinator → Magister Technicus |

**Membership standing:** Tiro → Civis. Membership standing is independent of branch appointment.

**Bound Path:** Deferred. All eight current servitude titles, character records, service rules, and permissions are deliberately untouched by this change. Any future proposal to reduce this track to five must be separately designed, reviewed and migrated after approval.

## Compatibility and permissions

- The canonical `order_rank_catalog` stores the labels and order; `account_order_ranks` points to unchanged rank codes.
- Stable tracks remain `leadership`, `snakes`, `fangs`, `golden_claws`, `household`, `membership`, and `servitude`. These are internal IDs, not UI names.
- Existing accounts keep their assigned rank codes. No automatic promotions, demotions or role transfers occur.
- `account_role='domina'` and related API permission checks remain unchanged. **Imperatrix** is the new visible title; it is not a permissions migration.
- The original `domina`, `grand_viper`, and other catalog codes stay intact as internal identifiers.
- Officium Aerarii's historical `gilded_talon` / `high_claw` access rules still apply to the renamed Quaestor / Procurator until a separate permissions review.
- The legacy `syndicate_rank` field and older `syndicateRanks.js` code are for compatibility only.
- No changes to consent or the Bound Path.

## Deployment

Pull `main`, back up the MariaDB database, then run `npm run setup:local` in `server/` and restart the Windows API. Migration `134_imperial_command_hierarchy.sql` updates only the canonical catalog's non-servitude titles.

A public static deployment cannot update stored ranks. Do not remove or rename existing rank codes, track identifiers, account roles or character-bound values.
