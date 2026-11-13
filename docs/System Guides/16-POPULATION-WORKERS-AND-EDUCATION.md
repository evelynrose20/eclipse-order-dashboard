---
tags: [population, workforce, education, healthcare]
---
# Population, worker health, education and daily civilian cycles

**UI:** World Administration → Civilian Welfare and settlement dossier.

A settlement's resident population, workforce, housing capacity and services are interdependent but not interchangeable. Housing enables settlement growth; an industrial template's required workforce is not a command to spawn free workers. The managed simulation uses available labor and recorded civic conditions, with rules for civilian migration, shortages, stability and unrest.

**Worker health:** work-related illness/injury can reduce usable labor. Clinics and medical access contribute to recovery; do not assume a headcount listed in an editor equals healthy available employees. Civilian medicine stock and completed clinic buildings matter for welfare and worker-care calculations.

**Schools and training:** completed, operational school buildings provide places; enrollment of eligible residents can gradually improve educational attainment. Schools under construction, ruined, or unfunded should not provide their full completed benefit.

**Cycle requirements:** the region and individual settlement/civic profile must allow the applicable simulation mode. Some worker health, education and population updates are keyed to prevent duplicate same-day processing. NPC and Order-controlled settlements follow different resource-payment rules.

**Typical chain:** housing → residents → healthy/educated workers → staffed industry → actual production → real supply deliveries → improved civilian stability. A repaired waterworks does not replace required food, medicine or heating supplies.

**Code:** `world-population-simulation.js`, `world-worker-care.js`, `world-worker-hazards.js`, `world-education.js`, `world-settlement-simulation.js`, `world-civic-needs.js`. Related [[03-CIVILIAN-WELFARE-AND-BUILDINGS]].
