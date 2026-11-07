-- 039: Garlean canon correction for originally seeded chronicle entries.
-- Preserve anything subsequently edited through the Order Chronicles portal:
-- an authored update always stores updated_by.
USE eclipse_order;

UPDATE order_lore_entries
 SET title='Origins in Garlemald',
 era='garlemald',
 summary='The Eclipse Order was founded in Garlemald as an organization of influence, secrecy and criminal enterprise.',
 body='The Eclipse Order began in Garlemald, amid the pressures of imperial life and the opportunities of its underworld. Informants, trade arrangements, protection and debts helped establish a network with ambitions of its own. Its earliest campaigns are still being chronicled.',
 sort_order=10
 WHERE id='origins-thirteenth' AND updated_by IS NULL
 AND title IN ('The House Before the Flood','Before the Garlean Order');

UPDATE order_lore_entries
 SET title='Dalamud and the Calamity',
 era='arr',
 summary='Elira was born in Garlemald and lived through the era of Carteneau and Dalamud’s fall.',
 body='Elira was born in Garlemald. She was alive during the Battle of Carteneau and the fall of Dalamud; her history does not involve a passage from another world or a voidsent origin. Vy’lana remains part of her life. The details of how this turbulent period affected the Order’s operations are open for future chronicles.',
 sort_order=20
 WHERE id='carteneau-crossing' AND updated_by IS NULL
 AND title IN ('A Passage into the Source','The Road to Garlemald');

UPDATE order_lore_entries
 SET title='Foundations of the Order',
 era='heavensward',
 summary='The early Garlean syndicate developed its contacts, resources and alliances.',
 body='The Order’s origins are Garlean. The precise events of its early development, including the businesses, allies and rivals that shaped it, remain open for the Order’s chronicles.',
 sort_order=30
 WHERE id='early-journeys' AND updated_by IS NULL
 AND title IN ('The Years Between','An Order Forged in Garlemald');

UPDATE order_lore_entries
 SET title='The Yanxia Operations',
 summary='The Garlean Order expanded its operations into Yanxia and established formal ranks during Stormblood.',
 body='By Stormblood, the Eclipse Order had already established its Garlean identity. In Yanxia it extended its reach and organized the formal hierarchy and branches that shaped its operations. Yanxia became an important base, but never the origin of the Order.',
 sort_order=40
 WHERE id='yanxia-order' AND updated_by IS NULL
 AND title IN ('The Order Takes Shape','The Garlean Order in Yanxia');

UPDATE order_lore_entries
 SET summary='New Cassia in Ilsabard is the renewed seat of the Eclipse Order.',
 body='With its roots in Garlemald and operations shaped by years of conflict, the Eclipse Order has turned toward New Cassia in Ilsabard. Imperial remnants, rival families and underworld dealings offer new opportunities and dangers. The Eorzean estate remains the in-game place for members to meet.',
 sort_order=10
 WHERE id='new-cassia' AND updated_by IS NULL
 AND summary IN (
  'Elira’s home in Ilsabard and the intended center of a renewed, Garlean-facing Order.',
  'Elira’s home in Ilsabard and the Garlean-founded Order’s renewed seat of power.'
 );

INSERT INTO schema_migrations(version) VALUES('039_garlean_history_revision')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
