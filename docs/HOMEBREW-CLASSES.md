# Eclipse Order — homebrew class and spell progression

## What staff can edit

Domina and High Command can open **Homebrew classes** in the Windows/MySQL member portal. Six editable starter classes are supplied: Warrior, Rogue, Mage, Healer, Ranger, and Bard. Their feature and spell names are starter proposals; they are not fixed FC lore.

For any class, staff can set its name, description, hit die (d6/d8/d10/d12), primary ability, two saving throw proficiencies, and casting style. A class may define up to 60 level-gated features and 80 level-gated spells. Custom classes use a stable lowercase ID; **do not rename IDs after creating characters**. Editing an existing class does not rewrite or level-up existing characters, but updated unlock definitions immediately affect their spellbook and server casting checks.

Each feature has a name, description, and character level (1–20). Each spell has a unique class-local ID, name, description/effect, unlock level (1–20), and spell-point cost (1–12). Spell effects are narrative/GM adjudicated, not automatically applied as damage, healing, or conditions; use the encounter controls for those results.

## Character unlocks and spell resources

- Creating a new character uses the latest server class definition, enforces the 27-point starting ability allocation, starts at level 1, and applies class HP/save rules.
- XP comes from completed-event awards. Level-ups update class features, HP, proficiency, ability-point milestones, and maximum spell points.
- Full caster pool: `2 + 2 × character level`. Half caster pool: zero at level 1, then `1 + floor(level/2)` from level 2. Non-casters have zero spell points.
- The **Class progression** spellbook on the full character sheet shows unlocked features, available spells, and future unlocks.
- Linked owners of **unbound** progression-managed characters can record a spell cast. The server checks class, spell ID, unlock level, points remaining, and character ownership in a locked transaction before deducting points. A long rest restores the points, requires confirmation, and records an audit entry.
- Staff inspecting another member's character cannot cast that member's spells. Bound characters retain the existing limited-sheet restrictions. Player View remains a read-only preview.

## Windows deployment

This update adds forward MySQL migration **`010_homebrew_classes.sql`**, applied by `npm run setup:local`. Back up `eclipse_order` before pulling the new server code, run the migration setup from `server/`, then restart the Node API. The new table stores staff class overrides; the six starter classes are provided by code and do not need manual inserts. Old character sheets are not deleted or re-created.

The GitHub Pages build does **not** update MySQL. Tests and build must pass before merging, and the live server should be checked with one caster, one noncaster, a low-level locked spell, and a second member account.
