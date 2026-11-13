# Family and dependent care — ordinary and Imperial Lineage parenthood

The dedicated **Family & Care** section and the childcare panel in **Imperial Lineage Project > Lineage Parenthood** share the same guardian-protected dependent records.

**Core functions:** register a dependent (name, optional IC birth date, age stage and notes); record nursing, bottle feeding, meals and comforting care; keep separate logged quantities of acquired milk/formula and meals; view a care history; and assign eligible Household helpers. Age stages are newborn, infant, toddler and child. Only newborn/infant stages can use nursing or bottle events; older dependents use meal events. This is a fictional RP record, not medical feeding advice or a real infant-care scheduler.

**Household participation:** a dependent's owning guardian explicitly adds and removes individual Household members. Role membership alone provides no access to a specific child. Assignments are revalidated against live Household standing on every action. Helpers can record care and food acquisition only on assigned dependent records; they cannot change the guardian or stage and cannot further delegate access.

**Nursing:** nursing is a normal childcare event only. Caregivers each choose **Nursing available** under their own account, independent of staff roles or the physical properties of a character model. Neither Household rank nor an IC fictional lactation treatment automatically sets the option. The setting can be revoked by the same player. Nursing is unavailable for toddlers/children. No adult RP preferences, production systems, or extraction mechanics are connected.

**Supplies:** to record a bottle or a meal, caretakers need recorded servings in the child's supplies. An authorized caregiver can record acquired stock by entering an amount and its IC source. This is a provenance-labelled care log, **not** an automatic transfer from city warehouses or a claim that the economic simulation produced resources. Feeding decrements the recorded count transactionally. Comfort and direct nursing do not consume bottled supplies.

**Lineage link:** registering a dependent through a documented lineage-parenthood case requires that case to belong to a character owned by the guardian, with current research authorization. A dependent is NEVER a normal character record. The Imperial Lineage view does not reveal other families or create any adult-servitude or breeding-pit record.

## Deployment

Back up the Windows MySQL database, pull this feature's approved merged revision, then apply additive migration **131_dependent_family_care.sql** through the API Control Center and restart the service. No existing child, pregnancy, research, or character records are deleted or converted. GitHub CI cannot apply the migration on your Windows machine.
