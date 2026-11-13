-- 128: Apply corrected imperial public canon to untouched legacy lore seeds.
-- Historical SQL migrations and stable row IDs are intentionally preserved.
-- Only rows with no author/editor recorded and recognizable legacy titles are changed.
-- Player-authored lore entries remain untouched.
USE eclipse_order;

UPDATE order_lore_entries
SET title='Imperial Foundations',
 era='garlemald',
 summary='The Eclipse Order draws its outlook from Garlean imperial traditions and the pursuit of authority.',
 body='The Order embraces discipline, magitek, strategic strength, and loyalty to its leadership. Its current identity is an independent imperial villain faction led by Domina Rosa. The details of its earliest founding have not been established in the current canon.',
 sort_order=10
WHERE id='origins-thirteenth' AND updated_by IS NULL
AND title IN ('The House Before the Flood','Before the Garlean Order','Origins in Garlemald','The Household and the Thirteenth');

UPDATE order_lore_entries
SET title='An Era of Upheaval',
 era='arr',
 summary='The Calamity reshaped the political and military landscape in which imperial powers operated.',
 body='The fall of Dalamud and the conflicts that followed changed the balance of power across the realm. This public record does not assert a personal origin or founding event for the Order.',
 sort_order=20
WHERE id='carteneau-crossing' AND updated_by IS NULL
AND title IN ('A Passage into the Source','The Road to Garlemald','Dalamud and the Calamity');

UPDATE order_lore_entries
SET title='Foundations and Resources',
 summary='The Order builds the resources and connections needed to pursue its imperial ambitions.',
 body='Its imperial direction prizes discipline, intelligence, industry, and control. Details of the Order’s early development remain open to established current RP canon.',
 sort_order=30
WHERE id='early-journeys' AND updated_by IS NULL
AND title IN ('The Years Between','An Order Forged in Garlemald','Foundations of the Order');

UPDATE order_lore_entries
SET title='The Imperial Ambition',
 era='stormblood',
 summary='The Order’s ambitions take shape against a backdrop of imperial conflict and shifting alliances.',
 body='The current branches of the Order—the Fangs, Snakes, and Golden Claws—support military strength, intelligence, and the economy. Their original founding dates and former headquarters are not established in current canon.',
 sort_order=40
WHERE id='yanxia-order' AND updated_by IS NULL
AND title IN ('The Order Takes Shape','The Garlean Order in Yanxia','The Yanxia Operations');

UPDATE order_lore_entries
SET title='The Breaking of the Order',
 summary='The Final Days shattered the Order’s operations and scattered its people.',
 body='The Final Days and their aftermath left the Order weakened and fragmented. The struggle to rebuild its strength is part of its present imperial ambitions.'
WHERE id='final-days-fall' AND updated_by IS NULL
AND title='The Breaking of the Order';

UPDATE order_lore_entries
SET title='After Dawntrail',
 summary='An independent imperial villain faction emerges from the wreckage of its former power.',
 body='Domina Rosa gathers loyalists as the Order rebuilds its influence in northern Ilsabard. Foreign governments, rival factions, and imperial remnants must decide whether to bargain with, resist, or oppose its rise.'
WHERE id='dawntrail-return' AND updated_by IS NULL
AND title IN ('What Remains After Dawntrail','After Dawntrail');

UPDATE order_lore_entries
SET title='New Cassia',
 summary='New Cassia is the seat of a rebuilding imperial power in northern Ilsabard.',
 body='New Cassia serves as the Order’s administrative and military center under Domina Rosa. Infrastructure, magitek industry, diplomacy, and territorial control support its ambition to build an independent empire. Its Eorzean estate remains the in-game meeting address.'
WHERE id='new-cassia' AND updated_by IS NULL
AND title='New Cassia'
AND (
 summary LIKE '%Elira%'
 OR body LIKE '%Elira%'
 OR body LIKE '%underworld%'
 OR summary LIKE '%renewed seat%'
);

INSERT INTO schema_migrations(version) VALUES('128_rosa_imperial_lore_correction')
ON DUPLICATE KEY UPDATE version=VALUES(version);
