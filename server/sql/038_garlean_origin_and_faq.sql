-- 038: Public FAQ managed from the Order portal, plus an opt-in canon correction
-- to untouched founding lore. Entries edited by leadership are NEVER overwritten.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_public_faq (
 id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 question VARCHAR(240) NOT NULL,
 answer TEXT NOT NULL,
 sort_order INT NOT NULL DEFAULT 100,
 published TINYINT(1) NOT NULL DEFAULT 1,
 updated_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_order_public_faq(published,sort_order,id),
 CONSTRAINT fk_order_public_faq_editor FOREIGN KEY (updated_by) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Initial published questions are imported only if the FAQ is still empty.
INSERT INTO order_public_faq(question,answer,sort_order,published)
SELECT q.question,q.answer,q.sort_order,1 FROM (
 SELECT 'What kind of FFXIV group is this?' question,'The Eclipse Order is a Garlean-founded criminal syndicate led by the Domina. It is a story-focused, 18+ Final Fantasy XIV roleplay Free Company built around loyalty, power, ambition and consequences.' answer,10 sort_order
 UNION ALL SELECT 'Do I need to know the Order’s history?','No. You can join with only rumors of the Order and discover its history through roleplay.',20
 UNION ALL SELECT 'Do I need to play a villain?','Not necessarily. What matters is that your character has a believable reason to become involved with an underworld organization ruled by the Domina.',30
 UNION ALL SELECT 'How do events and character sheets work?','Members use the companion portal for character dossiers, event registrations and dice-based encounters. Roleplay takes place in Final Fantasy XIV.',40
 UNION ALL SELECT 'Can my character have a different rank from my account role?','Yes. In-character rank is separate from website access and out-of-character moderation responsibilities.',50
 UNION ALL SELECT 'How do I request membership?','Sign in with Discord. Order command reviews new membership requests before access to character and event tools is granted.',60
 UNION ALL SELECT 'What does Bad End FC mean?','Characters can face long-lasting negative outcomes, including captivity, servitude or death. All players must follow out-of-character consent and safety boundaries.',70
) q WHERE NOT EXISTS (SELECT 1 FROM order_public_faq LIMIT 1)
 AND NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version='038_garlean_origin_and_faq')
ORDER BY q.sort_order;

-- Only migrate the exact initial lore text still present from migration 037.
-- A member-edited title, introduction or body is preserved independently.
UPDATE order_lore_entries
 SET title='Before the Garlean Order',
 summary='Elira’s personal history begins on the Thirteenth; the Eclipse Order itself was founded in Garlemald.',
 body='Elira’s history reaches back to the Thirteenth and the Flood of Darkness. Those events belong to her personal past, not to a founding chapter of the Eclipse Order. The Order would be established in Garlemald after her arrival on the Source, as a Garlean organization under her own rule.'
 WHERE id='origins-thirteenth'
 AND title='The House Before the Flood'
 AND summary='The Eclipse Order traces its heraldry and loyalties to Elira’s noble household on the Thirteenth.'
 AND body='Before the Flood of Darkness, Elira belonged to a noble household on the Thirteenth. Its serpent-and-eclipse heraldry and surviving loyalties became the roots of what would later be called the Eclipse Order. The Flood changed Elira and scattered what remained of the house.';

UPDATE order_lore_entries
 SET title='The Road to Garlemald',
 summary='Elira reaches the Source. Her personal history precedes the Garlean-founded Eclipse Order.',
 body='Elira arrived on the Source near Carteneau, where her history with Vy’lana continued. What followed led her to Garlemald and to the establishment of the Eclipse Order under her authority. The Order was Garlean from its founding; it was not a Thirteenth household renamed later.'
 WHERE id='carteneau-crossing'
 AND title='A Passage into the Source'
 AND summary='Elira reached the Source through a voidrift in the Carteneau era.'
 AND body='Elira crossed into the Source through a voidrift near Carteneau and took a Miqo’te vessel. In this period she formed a partnership with Vy’lana. The survivors were connected by old household obligations and personal loyalties; the Order’s later formal ranks did not yet exist.';

UPDATE order_lore_entries
 SET title='An Order Forged in Garlemald',
 summary='A private chapter reserved for the Eclipse Order’s Garlean founding and earliest operations.',
 body='The Eclipse Order was established in Garlemald under Elira’s authority. This unpublished chapter awaits the details of its earliest campaigns, political interests and underworld alliances.'
 WHERE id='early-journeys'
 AND title='The Years Between'
 AND summary='The household’s story between Carteneau and the formal Order has yet to be fully recorded.'
 AND body='This chapter is awaiting the Order’s account of its movements, relationships and conflicts. Add only events that have been established in roleplay.';

UPDATE order_lore_entries
 SET title='The Garlean Order in Yanxia',
 summary='Already Garlean in origin, the Order established its formal ranks and a Yanxia base during Stormblood.',
 body='The Eclipse Order was founded in Garlemald and remained Garlean in identity even as its operations expanded beyond Ilsabard. During Stormblood the syndicate established a base in Yanxia and formalized its hierarchy and branches. Yanxia was a chapter of its operations, not its birthplace.'
 WHERE id='yanxia-order'
 AND title='The Order Takes Shape'
 AND summary='The Eclipse Order developed its formal ranks and branches in Yanxia.'
 AND body='During Stormblood, the Eclipse Order established its formal hierarchy, headquarters and branches in Yanxia. Earlier household loyalties should not be described as having already used these ranks.';

UPDATE order_lore_entries
 SET summary='Elira’s home in Ilsabard and the Garlean-founded Order’s renewed seat of power.',
 body='New Cassia is Elira’s home in Ilsabard and the seat of her renewed authority over the Eclipse Order. The Order’s Garlean identity has been part of its history since its founding. Here its criminal trade, political ambitions and dealings with imperial remnants can deepen. The listed residential estate remains its out-of-character in-game meeting address.'
 WHERE id='new-cassia'
 AND summary='Elira’s home in Ilsabard and the intended center of a renewed, Garlean-facing Order.'
 AND body='New Cassia is Elira’s home in Ilsabard. The Order’s renewed direction turns toward this place and the political, imperial-remnant and underworld stories that can unfold around it. This is the Order’s roleplay setting; the listed residential estate remains its in-game meeting address.';

INSERT INTO schema_migrations(version) VALUES('038_garlean_origin_and_faq') ON DUPLICATE KEY UPDATE version=VALUES(version);
