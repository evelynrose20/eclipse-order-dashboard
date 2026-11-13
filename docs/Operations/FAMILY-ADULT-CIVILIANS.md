# Family adulthood and named civilians

**At adulthood**, the dependent's guardian can explicitly complete the Teenager stage and select a starting settlement. The system creates a **named civilian profile** linked one-to-one to that dependent; it does not create an adult player sheet, delete childhood care history or keep the former child eligible for childcare actions. The transition is transactional and cannot be repeated or performed by a Household helper.

### Named citizen and family connections

Family members keep a **Family Connections / Adult Civilian Lives** screen, which reports the adult's name, current settlement, employer facility when assigned, employment status, well-being and a short family-readable update. Guardians can see their own former dependents; Household assignment for childhood does **not** grant automatic adult-record access. Both thrall and regular account guardians receive the same view.

Staff authorized for civilian administration can open the **Staff Civilian Registry**, update residence, link an operational facility in that settlement, and report employment/well-being. The API checks that employed status has an actual operational workplace within the selected settlement. Guardians cannot fabricate a job or a salary.

### Settlement integration limitation

The existing world simulation stores population and employment as aggregate numbers rather than individually named citizens. This feature creates a **tracked resident attached to a real mapped settlement**, not an additional simulated inhabitant or workforce slot. It never increments/decrements aggregate population, changes housing demand, creates factory capacity, runs wages or affects trade. Future job/population integration must reconcile with the authoritative civic population and labor simulation instead of creating extra residents or employment by fiat.

### Deployment

After PR #148 is merged, this stacked feature requires **migration 134_family_adult_civilians.sql** via the API Control Center after a verified MariaDB backup. It is additive and repeatable; the migration preserves all childhood records. The new staff view and family permissions must be tested with separate guardian, Household and staff sessions before deployment.
