-- Eclipse Order factions. Seed records are initial RP lore, not member accounts.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_factions (
 id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 leader VARCHAR(100) NOT NULL,
 relationship ENUM('friendly','rival','watchful_rival','hostile','neutral') NOT NULL DEFAULT 'neutral',
 description TEXT NOT NULL,
 notes TEXT NOT NULL,
 image_reference_url VARCHAR(1500) NOT NULL DEFAULT '',
 public_visible TINYINT(1) NOT NULL DEFAULT 1,
 sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 100,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_faction_events (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 title VARCHAR(140) NOT NULL,
 details TEXT NOT NULL,
 occurred_on DATE NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_faction_events(faction_id,created_at),
 CONSTRAINT fk_faction_event FOREIGN KEY(faction_id) REFERENCES order_factions(id) ON DELETE CASCADE,
 CONSTRAINT fk_faction_event_actor FOREIGN KEY(created_by) REFERENCES accounts(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert only absent starter factions; edits by Order command survive repeated setup.
INSERT IGNORE INTO order_factions(id,name,leader,relationship,description,notes,sort_order) VALUES
('house-kurogane','House of Kurogane','Lady Reika Kurogane','friendly','A Yanxian merchant family with longstanding Golden Claws connections. Eager to restore trade agreements, provided the Order respects its independence.','',10),
('crimson-lotus-society','Crimson Lotus Society','Lady Akane Mori','friendly','An independent organization operating venues and private entertainment businesses. Welcomes Elira\'s return and values her as a former partner.','',20),
('iron-remnant','The Iron Remnant','Cassian var Corvinus','hostile','Former Garlean loyalists who hold Elira responsible for the deaths of imperial soldiers and officers. Their grievance is personal, not merely political.','',30),
('blackthorn-consortium','Blackthorn Consortium','Lord Darius Blackthorn','rival','A commercially powerful syndicate that took over several markets during the Order\'s absence. Opposes any attempt to reclaim those interests.','',40),
('ashen-veil','The Ashen Veil','Seraphine Voss','watchful_rival','An intelligence organization that expanded into territory once controlled by the Snakes. Interested in exploiting Elira\'s weakened position rather than rushing into war.','',50);

INSERT INTO schema_migrations(version) VALUES('017_factions')
ON DUPLICATE KEY UPDATE version=VALUES(version);
