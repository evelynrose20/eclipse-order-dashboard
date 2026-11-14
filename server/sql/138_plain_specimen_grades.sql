-- 138: Plain, non-invented specimen grades. Stable rank codes and assignments are unchanged.
-- This follows 137 so rerunning setup cannot restore the invented Latin titles.
USE eclipse_order;

UPDATE order_rank_catalog SET title=CASE code
 WHEN 'unmarked' THEN 'Specimen Grade I'
 WHEN 'marked_thrall' THEN 'Specimen Grade II'
 WHEN 'bound_serpent' THEN 'Specimen Grade III'
 WHEN 'eclipse_attendant' THEN 'Specimen Grade IV'
 WHEN 'silken_thrall' THEN 'Specimen Grade V'
 ELSE title END
WHERE track='servitude'
 AND code IN ('unmarked','marked_thrall','bound_serpent','eclipse_attendant','silken_thrall');

INSERT INTO schema_migrations(version) VALUES('138_plain_specimen_grades')
ON DUPLICATE KEY UPDATE version=VALUES(version);
