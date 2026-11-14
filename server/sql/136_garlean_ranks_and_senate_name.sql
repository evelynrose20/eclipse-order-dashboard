-- 136: Align Imperium Noctis with documented Garlean rank and civil-office terms.
-- Display-only change. Keep track names, rank codes, assignments, technical account roles,
-- Council/Senate mechanics, and ALL servitude titles exactly as they were.
USE eclipse_order;

UPDATE order_rank_catalog
SET title=CASE code
 WHEN 'grand_viper' THEN 'Consul'
 WHEN 'inner_council' THEN 'Senatus Imperialis'
 WHEN 'hatchling' THEN 'Eques'
 WHEN 'coil' THEN 'Notarius'
 WHEN 'whisper' THEN 'Frumentarius'
 WHEN 'shadowkeeper' THEN 'Praefectus'
 WHEN 'high_serpent' THEN 'Primus Frumentarius'
 WHEN 'fangling' THEN 'Legionarius'
 WHEN 'fang' THEN 'Optio'
 WHEN 'viper' THEN 'Centurio'
 WHEN 'fangmaster' THEN 'Primus Pilus'
 WHEN 'high_fang' THEN 'Legatus Legionis'
 WHEN 'gildling' THEN 'Eques'
 WHEN 'claw' THEN 'Notarius'
 WHEN 'goldkeeper' THEN 'Compulsor'
 WHEN 'gilded_talon' THEN 'Aedilis'
 WHEN 'high_claw' THEN 'Quaestor'
 WHEN 'keepers_apprentice' THEN 'Architectus'
 WHEN 'overseer' THEN 'Architectus Veteranus'
 WHEN 'master_of_chains' THEN 'Architectus Magiteci'
 WHEN 'high_steward' THEN 'Primus Architectus Magiteci'
 WHEN 'freshscales' THEN 'Peregrinus'
 WHEN 'voidscales' THEN 'Civis'
 ELSE title END
WHERE track IN ('leadership','snakes','fangs','golden_claws','household','membership');

-- Only update unchanged previously seeded Council office titles.
UPDATE order_council_offices SET title='Legatus Augustus'
 WHERE code='operations' AND title='Magister Militum';
UPDATE order_council_offices SET title='Quaestor'
 WHERE code='commerce' AND title='Quaestor Aerarii';
UPDATE order_council_offices SET title='Praetor'
 WHERE code='faction' AND title='Legatus Diplomaticus';
UPDATE order_council_offices SET title='Praefectus'
 WHERE code='internal' AND title='Praefectus Civium';

-- Update only the untouched default narrative text, never a member-edited charter.
-- Senatus Imperialis is the displayed chamber name, not an automatic Senate activation.
UPDATE order_governance_charter
 SET charter_text=REPLACE(charter_text,
 'The Consilium Imperiale serves until the Senate is convened.',
 'The Senatus Imperialis is the imperial governing chamber. Existing Council rules remain in effect until the optional Senate is convened.')
 WHERE id=1 AND revision=1 AND updated_by IS NULL
 AND title='Imperium Noctis Charter'
 AND charter_text LIKE 'Under Imperatrix Rosa, Imperium Noctis is governed by its appointed chamber.%'
 AND charter_text LIKE '%The Consilium Imperiale serves until the Senate is convened.%';

INSERT INTO schema_migrations(version) VALUES('136_garlean_ranks_and_senate_name')
ON DUPLICATE KEY UPDATE version=VALUES(version);
