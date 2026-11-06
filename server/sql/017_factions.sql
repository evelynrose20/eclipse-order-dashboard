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

UPDATE order_factions SET image_reference_url='https://images.openai.com/static-rsc-4/qMClPr5U0rxYWUZoKg48EzXC01fhWlS3VP2ZDi-DV_SgD8sNuL8artI_xT0Lvc47kB_s8iDqyV7Rm63DRkMkTbg-7RBgNLzNPCHDVJrVhRRBicnA8x5VOnYLUOPdAtvd2MUi1J7ua21ljlB3n2mrx5MnBW01LPhjtXxrw1ZBjlg?purpose=inline' WHERE id='house-kurogane' AND image_reference_url='';
UPDATE order_factions SET image_reference_url='https://images.openai.com/static-rsc-4/VUm11tszt_AQuHc7nQX2sZsyICx4N6tQjPRKBxnUaraWm-elsLGiYuH8PMYrfNSqFzBpLgpB9W0HRtf8oN217v8iaGTbD8w4cDfbc4eQtOELw7XpJmICzCTtG_9En7-dg7MJ_Kufhxp9OtlM1Y2b3ZLbiS2nXpBmtE7udkxo1Xg?purpose=inline' WHERE id='crimson-lotus-society' AND image_reference_url='';
UPDATE order_factions SET image_reference_url='https://images.openai.com/static-rsc-4/IG-SlgNMax1ZULazZMo3UpxuLlQ1t8ej_3pOGeloWn-zHKfvhj8-ewtft97R7QzxBPSepgJRBV1fP8cL6IHefB29xBMOw0yEWK0cATj6afJdDYFkVAXFSUVpG6WqNaNJ5h8DdF4RYguLP7s4619MeWtm9I603ONElH37IK7A13M?purpose=inline' WHERE id='iron-remnant' AND image_reference_url='';
UPDATE order_factions SET image_reference_url='https://images.openai.com/static-rsc-4/nZD8IubWZMDaMSuWFDF0CTDv7WPLsfJxHhBsHNY59la07TU-Fpi2O60ZvVmyhuZ68Yali7pY-q8jRnccJ65idr-ZYyohEdaxRrURnAcnGJ95TmGOMjPO_qcK3AsfWnns17Ra7LbCCVvUUiu9P3VqBoHKu-HyWBXM7L7VzqyoDfE?purpose=inline' WHERE id='blackthorn-consortium' AND image_reference_url='';
UPDATE order_factions SET image_reference_url='https://images.openai.com/static-rsc-4/yheew_4xq4E0gMrcJp723xuR3gUgmoyAZ6Hj_jeF6ZlTiYiOH9z8YzG0PwhyONcsyGTkX2YtlHDcvuOActvKHzODYfGlR2NDJMzlukxQcuiiiwCbDHOpSa5uAi79RnUV-hwk_7k379G-veFGjR9D9Btwp85x4SLoBmKmICtDiXE?purpose=inline' WHERE id='ashen-veil' AND image_reference_url='';

INSERT INTO schema_migrations(version) VALUES('017_factions')
ON DUPLICATE KEY UPDATE version=VALUES(version);
