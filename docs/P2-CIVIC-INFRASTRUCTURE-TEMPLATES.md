# Civilian Welfare infrastructure templates and autonomous construction

## Overview

Migration `063_civic_building_templates.sql` introduces a common **building template catalog** for Order and NPC-controlled settlements. This supersedes the old practice of assigning every civic building an arbitrary '+10 services' score. Existing data, settlement ownership, population, workshops and industry projects remain in place.

**Civilian Welfare → Buildings & defenses → Manage templates** edits the reusable catalog. Creating or improving a building uses **+ Add structure → choose template → construction setup**, in the same popup pattern as Industry & Projects' Attach Production wizard.

Template fields: name, description, category, fixed effect type and effect per level, material and units required per tier, construction labor per tier, autonomous NPC development cost per tier, maximum level and whether the template is available for new projects. Template edits increment an internal revision but **do not create an extra player-facing V2**. Existing completed levels keep pinned effect snapshots. A new construction or upgrade receives the then-current recipe.

## Functional effects

| Default template | Per completed level | System integration |
| --- | --- | --- |
| Granary | +250 food storage units | Caps all new civilian food deposits including deliveries and relief shipments; existing stored goods are never silently deleted |
| Waterworks | +35 water units / cycle | Actual water production depends on healthy workforce, is recorded in civilian stock/movements, and is limited by water storage capacity |
| Residential Quarter | +30 housing places | Housing-based migration and eligibility checks |
| Civic Clinic | +12 medical access | Existing civic pressure and medical services |
| Community School | +45 classroom places | School enrollment and growing workforce attainment |
| Weatherproofing | +12 insulation | Heating need and cold protection |
| Perimeter Defenses | +10 defense | Effective settlement security |
| Public Works | +12 public service | Civilian living conditions |

There is **no storage bonus from a generic service score**. Base settlement food and water capacity is `max(500, population × 12)` for each category. Operational granaries add food capacity; operational waterworks also add water-storage capacity equal to three times their daily output. Damaged facilities provide reduced effects based on condition. Planned, under-construction and destroyed buildings provide no effective benefits.

NPC supplies are simulated independently from the Order's workshop and player inventories. Food and water reserves respect these capacities; actual NPC water production includes their completed waterworks output.

## Real building and upgrade projects

A new building creates a template-backed project. A level improvement creates a new project **without switching off the previously completed building**. No level increase occurs merely from a staff settings edit. Construction requires real labor, and Order projects debit only actual shared, unreserved workshop materials once, with an audited stock-ledger entry. Manual and automatic settlement cycles advance projects; project tick keys prevent double progression on the same day. A site with zero residents needs actual housing before settlement population increases; NPC starting work crews are simulated separately from resident workers.

Autonomous NPCs choose from enabled templates according to housing shortages, food-storage pressure, water needs, medical services, schooling and safety. The NPC selects an effective template for the needed category and pays the template's development cost from accumulated NPC development points. NPCs improve available existing buildings, expand with additional buildings, and repair damaged buildings. They never withdraw from the Order's material stock.

Repairs are material- and labor-funded projects. A damaged facility returns to its prior level and pinned recipe after repair; it does not gain an unearned level. Staff cannot freely rewrite a template-backed building's level, status, or effects. Legacy non-template structures are retained to preserve historical records and existing facilities.

The catalog validates effect-category compatibility, tier maxima and meaningful material, labor and NPC development costs. Higher-impact templates cannot be configured with near-zero construction requirements.

## Existing settlements and installation

The one-time migration converts previously recorded Granaries and Waterworks into template-backed buildings, retaining their names, levels, condition, status and location. Their old generic service bonus is replaced by actual food capacity and water-production mechanics. Existing completed cycle reports are never rewritten.

Windows setup: pull current `main`, run `npm run setup:local` in `server`, restart the Windows API and refresh the dashboard. The default catalog is seeded with `INSERT IGNORE` so running setup again does not overwrite staff-edited templates. Incomplete projects and material commitments persist through restarts.

Automated coverage includes template validation, physical storage limits, water production, school places, bounded costs, NPC priorities, and MySQL-backed building creation, material funding, completion, tier upgrades, storm damage and repair.
