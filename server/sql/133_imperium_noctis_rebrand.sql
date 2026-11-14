-- 133: Imperium Noctis display-name migration.
-- Preserve stable API routes, record IDs, ownership relations and financial history.
USE eclipse_order;

-- The first-party faction retains its stable ID referenced by maps and logistics.
UPDATE order_factions
SET name='Imperium Noctis'
WHERE id='eclipse-order' AND name IN ('The Eclipse Order','Eclipse Order');

-- Rebrand organization mentions in existing editable public material.
-- This changes the displayed name only; it neither resets authorship nor republishes drafts.
UPDATE order_lore_entries
SET
 title=REPLACE(REPLACE(title,'The Eclipse Order','Imperium Noctis'),'Eclipse Order','Imperium Noctis'),
 summary=REPLACE(REPLACE(summary,'The Eclipse Order','Imperium Noctis'),'Eclipse Order','Imperium Noctis'),
 body=REPLACE(REPLACE(body,'The Eclipse Order','Imperium Noctis'),'Eclipse Order','Imperium Noctis')
WHERE title LIKE '%Eclipse Order%' OR summary LIKE '%Eclipse Order%' OR body LIKE '%Eclipse Order%';

UPDATE order_public_faq
SET
 question=REPLACE(REPLACE(question,'The Eclipse Order','Imperium Noctis'),'Eclipse Order','Imperium Noctis'),
 answer=REPLACE(REPLACE(answer,'The Eclipse Order','Imperium Noctis'),'Eclipse Order','Imperium Noctis')
WHERE question LIKE '%Eclipse Order%' OR answer LIKE '%Eclipse Order%';

-- Associated faction descriptions can mention the old organization name.
UPDATE order_factions
SET
 description=REPLACE(REPLACE(description,'The Eclipse Order','Imperium Noctis'),'Eclipse Order','Imperium Noctis'),
 notes=REPLACE(REPLACE(notes,'The Eclipse Order','Imperium Noctis'),'Eclipse Order','Imperium Noctis')
WHERE description LIKE '%Eclipse Order%' OR notes LIKE '%Eclipse Order%';

INSERT INTO schema_migrations(version) VALUES ('133_imperium_noctis_rebrand')
ON DUPLICATE KEY UPDATE version=VALUES(version);
