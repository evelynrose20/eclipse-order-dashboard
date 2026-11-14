# Imperium Noctis hierarchy — MySQL canonical ranks

The Order's current hierarchy is stored in `order_rank_catalog`, with separate member and character assignments. This replaces the five-title model **for new in-character rank assignments**.

## Leadership
Domina → Grand Viper → Inner Council.

## Branches
- The Snakes: Hatchling, Coil, Whisper, Shadowkeeper, High Serpent.
- The Fangs: Fangling, Fang, Viper, Fangmaster, High Fang.
- The Golden Claws: Gildling, Claw, Goldkeeper, Gilded Talon, High Claw.
- The Household: Keeper's Apprentice, Overseer, Master of Chains, High Steward.

## Membership and servitude
Membership standing is an independent track (Freshscales / Voidscales), rather than a promotion in a branch. The named servitude ranks are stored separately in the catalog and are intended for **character** assignments, not site login accounts: Unmarked, Marked Thrall, Bound Serpent, Eclipse Attendant, Silken Thrall, Violet Keeper, Serpent's Chosen, Eclipsed Consort.

## Database design

- `order_rank_catalog`: canonical names, tracks, and ordering.
- `account_order_ranks`: one assignment per member per track, with a foreign key to the catalog.
- `character_order_ranks`: character servitude rank assignments, separate from account membership.
- `account_role` remains **website permissions**, not an in-character rank. Its values `domina`, `high_command`, `handler`, and `member` must not be confused with the new Order ranks.
- Older `standing` and `syndicate_rank` account fields remain temporarily for compatibility; do not assign new in-character ranks using them. Their old values are not mapped to branches, because no safe mapping exists.
- `bound_rank` in the older character model is not silently rewritten, to avoid changing roleplay character records.

Existing Domina-permission accounts get the leadership Domina rank. Existing accounts get Freshscales if they have no membership standing assigned. No other legacy permissions or standing is guessed to be a new rank. The migration is designed to be safe to rerun.

**Important:** Moving a member between in-character ranks does not grant staff privileges. The API only permits Domina administrators to assign ranks, validates rank against its track, and refuses a Domina leadership assignment unless the account has Domina-level technical permissions.

## Windows installation

Back up the `eclipse_order` MySQL database and pull the latest `main`. From `server` on the Windows host:

```powershell
npm run setup:local
```

This applies `016_order_hierarchy.sql`, creates the new catalog and assignment tables, and preserves existing records. Restart the Windows Node API after successful migration.

The GitHub Pages deployment **cannot apply** a local MySQL migration. Applying the frontend alone before the migration will cause rank requests to fail. Do not manually delete the old columns until the remaining compatibility paths are retired and old data has been backed up.
