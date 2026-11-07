-- Editable Order chronicle. Only explicitly published entries appear publicly.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_lore_entries (
 id VARCHAR(72) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 title VARCHAR(160) NOT NULL,
 era VARCHAR(32) NOT NULL DEFAULT 'present',
 kind ENUM('history','place','person','faction') NOT NULL DEFAULT 'history',
 summary VARCHAR(420) NOT NULL DEFAULT '',
 body TEXT NOT NULL,
 sort_order INT NOT NULL DEFAULT 100,
 published TINYINT(1) NOT NULL DEFAULT 0,
 updated_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_lore_public(published,kind,sort_order),
 CONSTRAINT fk_lore_editor FOREIGN KEY(updated_by) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- Founding canon. Later eras are placeholders for the Order to complete, not fabricated stories.
INSERT IGNORE INTO order_lore_entries(id,title,era,kind,summary,body,sort_order,published) VALUES
 ('origins-thirteenth','The House Before the Flood','thirteenth','history','The Eclipse Order traces its heraldry and loyalties to Elira’s noble household on the Thirteenth.','Before the Flood of Darkness, Elira belonged to a noble household on the Thirteenth. Its serpent-and-eclipse heraldry and surviving loyalties became the roots of what would later be called the Eclipse Order. The Flood changed Elira and scattered what remained of the house.',10,1),
 ('carteneau-crossing','A Passage into the Source','arr','history','Elira reached the Source through a voidrift in the Carteneau era.','Elira crossed into the Source through a voidrift near Carteneau and took a Miqo’te vessel. In this period she formed a partnership with Vy’lana. The survivors were connected by old household obligations and personal loyalties; the Order’s later formal ranks did not yet exist.',20,1),
 ('early-journeys','The Years Between','heavensward','history','The household’s story between Carteneau and the formal Order has yet to be fully recorded.','This chapter is awaiting the Order’s account of its movements, relationships and conflicts. Add only events that have been established in roleplay.',30,0),
 ('yanxia-order','The Order Takes Shape','stormblood','history','The Eclipse Order developed its formal ranks and branches in Yanxia.','During Stormblood, the Eclipse Order established its formal hierarchy, headquarters and branches in Yanxia. Earlier household loyalties should not be described as having already used these ranks.',40,1),
 ('shadowbringers-years','A House of Shadows','shadowbringers','history','A chapter reserved for events during Shadowbringers.','This chapter remains open for the Order’s established story and surviving records.',50,0),
 ('final-days-fall','The Breaking of the Order','endwalker','history','The Final Days shattered the Order and scattered those who remained.','The Final Days brought the destruction and collapse of the Order. Elira broke beneath the losses; Kaede left, and the organization ceased to function. This was not an uninterrupted period of orderly leadership.',60,1),
 ('dawntrail-return','What Remains After Dawntrail','dawntrail','history','Elira’s return meets both old enemies and those prepared to welcome the Order back.','By the end of Dawntrail, the Order had fallen. Elira’s return did not erase the consequences: Garlean and criminal-family rivals have their own reasons to respond, some hostile and others welcoming. The details of rebuilding belong to the Order’s unfolding story.',70,1),
 ('new-cassia','New Cassia','present','place','Elira’s home in Ilsabard and the intended center of a renewed, Garlean-facing Order.','New Cassia is Elira’s home in Ilsabard. The Order’s renewed direction turns toward this place and the political, imperial-remnant and underworld stories that can unfold around it. This is the Order’s roleplay setting; the listed residential estate remains its in-game meeting address.',10,1);
INSERT INTO schema_migrations(version) VALUES('037_order_lore_archive') ON DUPLICATE KEY UPDATE version=VALUES(version);
