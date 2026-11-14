-- 137: Five-grade specimen classification for the Imperium Noctis research registry.
-- The servitude track and stable rank codes remain for existing foreign keys.
-- Only the first five codes are active for new assignments. Retired codes 6-8
-- remain intact for legacy character records until individually reviewed.
-- No character assignment, binding, permission, or consent data is modified.
USE eclipse_order;

UPDATE order_rank_catalog SET title=CASE code
 WHEN 'unmarked' THEN 'Specimen I — Receptus'
 WHEN 'marked_thrall' THEN 'Specimen II — Registratus'
 WHEN 'bound_serpent' THEN 'Specimen III — Observatus'
 WHEN 'eclipse_attendant' THEN 'Specimen IV — Probatus'
 WHEN 'silken_thrall' THEN 'Specimen V — Praecipuus'
 ELSE title END
WHERE track='servitude'
 AND code IN ('unmarked','marked_thrall','bound_serpent','eclipse_attendant','silken_thrall');

INSERT INTO schema_migrations(version) VALUES('137_specimen_classification')
ON DUPLICATE KEY UPDATE version=VALUES(version);
