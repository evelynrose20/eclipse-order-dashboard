# Imperium Noctis — Imperial Chain of Command

The public hierarchy is a connected organizational chart rather than a single vertical ladder. Branch ranks use occupational and military titles recorded in FFXIV's Garlean hierarchy; the exact progression and branch assignments are unique to Imperium Noctis. The title **Imperatrix** and the chamber name **Senatus Imperialis** are faction choices, not claims of official Garlean imperial succession. Reference: https://ffxiv.consolegameswiki.com/wiki/Garlean_Empire

## Central command

1. **Imperatrix — Rosa**: sovereign and final authority.
2. **Consul**: principal deputy and administrative/executive coordinator; a documented Garlean civil office.
3. **Senatus Imperialis**: Imperial Senate, a faction-specific name for the governing chamber. This display name does not enable the optional Senate or alter Council/Senate rules, voting, ratification or appointments.

The four operational branches descend from imperial command:

| Branch | Mandate | Progression (lowest → highest) |
| --- | --- | --- |
| **Garlean Shadows** (`snakes`) | Intelligence, reconnaissance, counterintelligence, covert operations | Eques → Notarius → Frumentarius → Praefectus → Primus Frumentarius |
| **The Legions** (`fangs`) | Military operations, defense, territorial security | Legionarius → Optio → Centurio → Primus Pilus → Legatus Legionis |
| **Officium Aerarii** (`golden_claws`) | Treasury, enterprise, trade, procurement, supply | Eques → Notarius → Compulsor → Aedilis → Quaestor |
| **R&D** (`household`) | Magitek, scientific research, technical development | Architectus → Architectus Veteranus → Architectus Magiteci → Primus Architectus Magiteci |

**Membership standing:** Peregrinus → Civis (a faction-specific use of Garlean non-citizen and citizen terminology, not an OOC rights classification). Membership standing is independent of branch appointment.

**Specimen Classification:** Five research grades: Specimen I — Receptus; II — Registratus; III — Observatus; IV — Probatus; V — Praecipuus. These are faction-specific Latin-inspired research labels, not canonical Garlean military ranks. Three retired servitude codes remain in the database strictly to preserve historical character assignments until individually reviewed. Existing consent and technical access rules are unchanged.

## Compatibility and permissions

- The canonical `order_rank_catalog` stores the labels and order; `account_order_ranks` points to unchanged rank codes.
- Stable tracks remain `leadership`, `snakes`, `fangs`, `golden_claws`, `household`, `membership`, and `servitude`. These are internal IDs, not UI names.
- Existing accounts keep their assigned rank codes. No automatic promotions, demotions or role transfers occur.
- `account_role='domina'` and related API permission checks remain unchanged. **Imperatrix** is the new visible title; it is not a permissions migration.
- The original `domina`, `grand_viper`, and other catalog codes stay intact as internal identifiers.
- Officium Aerarii's historical `gilded_talon` / `high_claw` access rules still apply to the renamed Aedilis / Quaestor until a separate permissions review.
- The legacy `syndicate_rank` field and older `syndicateRanks.js` code are for compatibility only.
- Specimen classifications do not supersede OOC consent; legacy assignments remain readable until reassigned.

## Deployment

Pull `main`, back up the MariaDB database, then run `npm run setup:local` in `server/` and restart the Windows API. Migration `134_imperial_command_hierarchy.sql` updates only the canonical catalog's non-servitude titles.

A public static deployment cannot update stored ranks. Do not remove or rename existing rank codes, track identifiers, account roles or character-bound values.
