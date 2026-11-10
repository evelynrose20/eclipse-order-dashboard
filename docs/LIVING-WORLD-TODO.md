---
aliases:
  - Living World TODO
tags: [eclipse-order, living-world, roadmap]
---

# Eclipse Order — Living World TODO

> [!important] Status verification
> This checklist restores the living-world task index referenced by the documentation vault. The authoritative requirements are in [[LIVING-WORLD-WAR-COMMAND-MASTER-PLAN]]. These checkboxes are **not** claims that existing features are unfinished: verify each item against the latest code and live Windows API before changing its status. Do not rebuild or reset existing implementations.

## P0 — Fix live editing
- [ ] Audit current settlement/region create/edit, map saves, staff authorizations, and API version compatibility.
- [ ] Confirm that migrations preserve records and live restoration state.

## P1 — World registry
- [ ] Audit mapped settlement ownership, governing faction, controlling faction, supporting factions, and territorial states.
- [ ] Confirm neutral, contested, ruined, abandoned, and rebuilding zones are distinguishable without fabricated ownership.

## P2 — Garlean climate
- [ ] Verify seasonal New Cassia climate and editable weather overrides against the design brief.
- [ ] Keep simulation disabled by default; significant consequences require DM approval.

## P3 — Sites
- [ ] Verify map-linked farms, mines, factories, industry, construction, repair and restoration workflows.
- [ ] Audit workforce, fuel, power and materials requirements, preventing direct staff resource inflation.

## P4 — Logistics
- [ ] Check roads, junctions, rail visualizations, internal trade, transport templates, stockpiles and cargo movements.
- [ ] Confirm transfer accounting prevents duplication and respects reserved/character-owned materials.

## P5 — Military
- [ ] Audit unit templates, Garlean vehicle/train/airship registries, readiness and resupply rules.
- [ ] Confirm military actions depend on resources and approved outcomes.

## P6 — War Command
- [ ] Check event-driven campaigns, political authority, diplomacy, character involvement and DM-approved results.
- [ ] Ensure future phases never automatically apply permanent consequences or enable inactive simulation.

## Release checks
- [ ] Reconcile the checklist with actual current behavior and mark verified items complete.
- [ ] Run frontend and API tests, build, and live migration/permission checks separately.
- [ ] Preserve user-created world records, archives and maps throughout upgrades.

See also: [[00-START-HERE]], [[LIVING-WORLD-WAR-COMMAND-MASTER-PLAN]], [[WORLD-ADMIN-TROUBLESHOOTING]].
