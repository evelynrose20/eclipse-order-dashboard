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

## Construction supplies: committed project inventory (migration 066)

Order-controlled settlement construction is funded through **Civilian Welfare → Buildings & Defenses → Construction Supplies**, using the same commitment principle as **Industry & Projects**. Every active Order building, repair, or level-up project lists its required material, total requirement, already committed amount, remaining shortage, shared workshop availability, construction labor progress, and recent contributions.

The **Commit materials** control debits a chosen partial or full amount from actual shared Order stock in a locked transaction, writes the corresponding `fc_material_ledger` record and append-only `world_civic_project_contributions` receipt, and increases the project's funded total. Once committed, those goods are no longer part of available shared stock and therefore cannot be spent by other facilities or projects. A project cannot receive more than its remaining requirement or commit nonexistent stock. Construction uses labor only after the full material requirement has been committed. No automatic withdrawal takes place on a scheduled world cycle. Repeated simulation ticks cannot commit the materials again.

The existing `materials_paid=1` flag on completed/funded projects remains valid; migration 066 does not erase or recreate prior project history. NPC projects remain funded with autonomous development resources, not Order stock. Future template changes cannot alter a project's pinned material requirement. Projects with incomplete commitments retain their progress and funding records across API restarts. Civic templates support 1–12 distinct crafted materials per level, like Industry & Projects. Each ingredient has its own required, contributed, and remaining quantities. Construction starts using labor only after every required ingredient is fully committed; each contribution debits shared stock once.

Apply `066_civic_project_contributions.sql` using Windows `setup:local` before restarting the API. Automated MySQL coverage verifies partial commitments, insufficient funding, no labor while underfunded, completed funding, and refusal of extra charges.

## Multi-material construction and NPC industry-funded development (migrations 067–068)

Migration 067 introduces a list of material requirements for each civic building template and stores a frozen list of requirements for each construction, level-up, and repair project. Existing single-material recipes, already funded projects, and partial contributions are migrated without erasing their records. Template editors can add, remove or change up to twelve different materials, but duplicate item IDs, zero requirements, and implausibly cheap configurations are rejected. Industry & Projects already supported separate material needs; Civilian Welfare now uses the same user-facing model. Each construction project has independent commitment controls for each required item.

The migration seeds legacy template ingredients **once**. Future setup runs do not reinsert ingredients removed from a customized recipe. New project ingredient lists are pinned when the project begins, so later template edits cannot change an outstanding project's material debt.

Migration 068 removes the NPC settlement's former automatic development bonus based solely on population and employed workers. An NPC settlement now earns development only from **completed production records** of operational, active NPC-faction-owned industry facilities associated with that same settlement. The simulation looks at the previous day's production, awards at most ten development points per productive facility based on operations, and prevents multiple development payouts on fast settlement cycles. Factories with no production or disabled/ruined facilities award nothing. New NPC construction and upgrades still spend accumulated development points and require labor; no factories means no new development. Existing accrued balances and existing construction are preserved rather than reset. NPC industry facilities must exist and actually be running, so initial industry establishment is a world-building prerequisite, not a free output from population.

Windows setup must apply `067_civic_multimaterial_projects.sql` and `068_npc_industry_development.sql`, then restart the API. Automated tests cover ingredient lists and per-item commitments, plus zero development without operational industrial output.

## One-time NPC founding stage (migration 069)

A newly created or previously stuck empty NPC-controlled settlement can be switched to **Automatic** in NPC Settlements. Its first committed simulation cycle initializes a single founding package, recorded permanently by settlement ID in `world_npc_settlement_foundings`: operational housing (using an enabled housing template), a small population of eight founding residents with age-bounded eligible employment, baseline civilian food/water/fuel/medicine, and a real NPC-faction-owned founding farm attached to the settlement with automatic daily production. The founding farm uses the existing `starter-working-farmland` recipe, not a permanent production multiplier or a special material faucet. It must actually produce an industry cycle before generating any NPC development points. Industry and civic simulation then proceed under their normal weather, workforce, disease, materials, supply, and development rules.

The bootstrap is never repeated on pause/resume, changes of cadence, restart or subsequent simulation cycles. Existing productive settlements and their facilities remain untouched. Already stalled zero-population/no-facility NPC outposts are eligible for this once-only rescue. A settled NPC location with infrastructure will not receive new duplicate infrastructure. Disabling simulation stops the ordinary scheduled cycles but retains the founding and all production/project history. Order-controlled settlements are excluded from NPC founding so they cannot create free resources by transferring ownership.

The new additive migration permits system-created NPC facilities with NULL human creator, while leaving audit attribution on staff-created buildings and factories unchanged. Restart Windows API after `setup:local`; no need to manually add NPC housing or workshops.
