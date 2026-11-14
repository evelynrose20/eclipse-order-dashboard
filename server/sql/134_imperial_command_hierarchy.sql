-- 134: Imperium Noctis command titles. Stable rank codes and track IDs are retained.
-- Do not change account_role, rank_code, assignments, or the servitude track.
USE eclipse_order;
UPDATE order_rank_catalog SET title=CASE code
 WHEN 'domina' THEN 'Imperatrix'
 WHEN 'grand_viper' THEN 'Praefectus Imperii'
 WHEN 'inner_council' THEN 'Consilium Imperiale'
 WHEN 'hatchling' THEN 'Tiro Umbrae'
 WHEN 'coil' THEN 'Speculator'
 WHEN 'whisper' THEN 'Explorator'
 WHEN 'shadowkeeper' THEN 'Frumentarius'
 WHEN 'high_serpent' THEN 'Magister Umbrae'
 WHEN 'fangling' THEN 'Tiro'
 WHEN 'fang' THEN 'Miles'
 WHEN 'viper' THEN 'Optio'
 WHEN 'fangmaster' THEN 'Centurio'
 WHEN 'high_fang' THEN 'Legatus'
 WHEN 'gildling' THEN 'Discipulus'
 WHEN 'claw' THEN 'Scriba'
 WHEN 'goldkeeper' THEN 'Negotiator'
 WHEN 'gilded_talon' THEN 'Quaestor'
 WHEN 'high_claw' THEN 'Procurator'
 WHEN 'keepers_apprentice' THEN 'Discipulus Technicus'
 WHEN 'overseer' THEN 'Artifex'
 WHEN 'master_of_chains' THEN 'Machinator'
 WHEN 'high_steward' THEN 'Magister Technicus'
 WHEN 'freshscales' THEN 'Tiro'
 WHEN 'voidscales' THEN 'Civis'
 ELSE title END
WHERE track IN ('leadership','snakes','fangs','golden_claws','household','membership');
INSERT INTO schema_migrations(version) VALUES('134_imperial_command_hierarchy')
ON DUPLICATE KEY UPDATE version=VALUES(version);
