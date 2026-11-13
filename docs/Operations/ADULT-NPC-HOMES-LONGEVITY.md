# Adult named civilians: independent NPC homes and longevity

After a dependent enters adulthood, the child's original record stays as family history while the adult becomes a named autonomous civilian attached to an existing settlement. No playable character, salary, free population or workforce is generated.

## Independent life
On graduation the adult attempts to find vacant accommodation in an actual operational settlement housing upgrade. Capacity checks use both effective housing building places and the settlement's unoccupied total housing capacity. Each named adult reserves at most one building place. Damaged, destroyed and unfinished housing does not receive new occupants. When no vacant housing exists, they are marked Seeking a home rather than being assigned a fabricated one. They try again on eligible settlement simulation cycles, and a family member can request an immediate search using the family status screen.

Named NPCs also independently look for employment at existing operational facilities that already have workforce. Assignment uses only unassigned named shares of the settlement's existing workforce and facility workforce; it never creates workers, changes production or pays wages. Unemployed adults can retry during settlement cycles. Staff may continue to record moves and workplace statuses using the existing guarded civilian registry. The old housing assignment is cleared on relocation and a new one sought.

**Important limit:** Both population and housing capacity are aggregate civic simulation figures. Named profiles describe residents without increasing aggregate population. Housing and employment reservations are conservative, derived from actual vacant capacity. Full individual-NPC migration and city-wide household occupancy accounting would require an additional reconciliation model. Simulation-off Order settlements cannot automatically advance NPC decisions on settlement ticks; the family status screen includes an on-demand search.

## Long lifespan
These named descendants are not subject to ordinary population age cohorts. They can live through age 349 and reach their natural end at age **350**. Age is derived from the recorded birth date when valid, otherwise adulthood begins at age 18 on the transition date. The family status screen shows age, lifespan and living/deceased state. Dead profiles stay in family history; they cannot receive new housing or employment assignments, and do not consume future available named housing places. Nothing in this feature changes aggregate civilian demographics or global mortality rules.

## Deployment
Stacked on PR #150, itself dependent on PRs #149 and #148. Apply migration **136_named_civilian_homes_longevity.sql** after 133–135 on a backed-up Windows MariaDB database using the API Control Center. Migration 136 is rerunnable, adds only nullable housing_upgrade_id and its FK and preserves existing adult/child records. Verify that staff and guardian family permissions are distinct before release.
