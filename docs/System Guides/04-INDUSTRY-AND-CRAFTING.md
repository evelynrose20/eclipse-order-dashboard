---
tags: [industry, workshop, construction, guide]
---
# Industry, project sites, production and FC Workshop

**UI:** World Administration → Industry & Projects; facility attachment/editor, templates and construction projects; separate FC Workshop pages.

A **mapped industrial location** (farm, mine, factory etc.) and a **facility** attached to it are related but not identical. Templates determine what a facility can produce and what its inputs, byproducts, workers, environmental protection and operational costs are. An industrial facility may exist before its mapped location is usable; a destroyed or abandoned map state can block production.

**Production cycle:** a facility needs a valid location, supported faction control, available input stock, sufficient workforce, local utilities/fuel and—where configured—a working settlement grid. Output is recorded in its facility's **City Builder stock**, not automatically granted to the FC Workshop. Facilities can have site-specific material reservations, and transport to other facilities/warehouses is a separate accounted step.

**Construction and restoration:** starting a project creates a durable requirement rather than instantly upgrading. Materials must come from the project's specified supply ledger; funded work advances with its appropriate cycle. A completed industrial restoration can move a destroyed/abandoned associated settlement toward **Rebuilding**, but does not automatically complete every other building or set the whole settlement Secure.

**Separate stock pools:**
- **World Industry facility stock:** real goods physically recorded at a farm/factory/depot.
- **Warehouse stock:** goods that actually arrived at a warehouse.
- **FC Workshop shared stock:** player crafting materials, subject to reservation and transfer rules.
- **Civilian inventory:** settlement provisions counted for resident needs.
- **Project commitments:** ingredients already debited/reserved for a specific job.

If the picker shows both FC and City Builder item catalogs, that does **not** merge their inventories.

**FC Workshop:** crafts from defined recipes, character inventory and shared/reserved stock. Construction & Restoration's separate long-form campaign projects can consume materials over stages; don't assume they are the same as automatic industry rebuilding.

**Code:** `IndustrySitesPanel.jsx`, `IndustryTemplateEditor.jsx`, `ConstructionProjects.jsx`, `Workshop.jsx`, `world-industry.js`, `world-industry-engine.js`, `construction.js`, `crafting.js`. Existing design references: [[P3-INDUSTRY]], [[01-SETTLEMENT-REBUILDING]].
