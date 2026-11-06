-- Two-way diplomacy and per-member reputation. 0 is neutral; values range -100..100.
USE eclipse_order;
SET @has_scope := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='order_factions' AND COLUMN_NAME='faction_scope');
SET @ddl := IF(@has_scope=0,"ALTER TABLE order_factions ADD COLUMN faction_scope ENUM('order_story','world') NOT NULL DEFAULT 'order_story'","SELECT 1");
PREPARE faction_scope_stmt FROM @ddl; EXECUTE faction_scope_stmt; DEALLOCATE PREPARE faction_scope_stmt;

CREATE TABLE IF NOT EXISTS order_faction_reputation (
 faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 order_view SMALLINT NOT NULL DEFAULT 0,
 faction_view SMALLINT NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_order_rep_faction FOREIGN KEY(faction_id) REFERENCES order_factions(id) ON DELETE CASCADE,
 CONSTRAINT ck_order_rep_view CHECK (order_view BETWEEN -100 AND 100),
 CONSTRAINT ck_faction_rep_view CHECK (faction_view BETWEEN -100 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS player_faction_reputation (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 reputation SMALLINT NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(account_id,faction_id),
 CONSTRAINT fk_player_rep_account FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
 CONSTRAINT fk_player_rep_faction FOREIGN KEY(faction_id) REFERENCES order_factions(id) ON DELETE CASCADE,
 CONSTRAINT ck_player_rep CHECK (reputation BETWEEN -100 AND 100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS faction_reputation_changes (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 faction_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 target ENUM('order_view','faction_view','player') NOT NULL,
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 requested_delta SMALLINT NOT NULL,
 applied_delta SMALLINT NOT NULL,
 old_value SMALLINT NOT NULL,
 new_value SMALLINT NOT NULL,
 event_title VARCHAR(140) NOT NULL,
 event_details TEXT NOT NULL,
 source_event_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 authored_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_rep_history(faction_id,created_at),
 INDEX ix_rep_person(account_id,created_at),
 CONSTRAINT fk_rep_history_faction FOREIGN KEY(faction_id) REFERENCES order_factions(id) ON DELETE CASCADE,
 CONSTRAINT fk_rep_history_person FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE RESTRICT,
 CONSTRAINT fk_rep_history_author FOREIGN KEY(authored_by) REFERENCES accounts(id) ON DELETE RESTRICT,
 CONSTRAINT fk_rep_history_event FOREIGN KEY(source_event_id) REFERENCES order_encounters(id) ON DELETE SET NULL,
 CONSTRAINT ck_rep_scope CHECK ((target='player' AND account_id IS NOT NULL) OR (target<>'player' AND account_id IS NULL)),
 CONSTRAINT ck_rep_requested CHECK (requested_delta BETWEEN -100 AND 100 AND requested_delta <> 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Initial diplomacy reflects the supplied relationships; only populate absent rows.
INSERT IGNORE INTO order_faction_reputation(faction_id,order_view,faction_view) VALUES
('house-kurogane',45,40),('crimson-lotus-society',60,55),
('iron-remnant',-80,-95),('blackthorn-consortium',-55,-65),('ashen-veil',-20,-35);
-- Any new faction begins neutral on both axes. Personal standing defaults to neutral without a row.
INSERT IGNORE INTO order_faction_reputation(faction_id,order_view,faction_view)
 SELECT id,0,0 FROM order_factions;
INSERT INTO schema_migrations(version) VALUES('018_faction_reputation')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
