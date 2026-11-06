-- Canonical in-character hierarchy; account_role remains independent API permissions.
-- This migration is rerunnable and preserves old records without guessing rank equivalences.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_rank_catalog (
 code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 track ENUM('leadership','snakes','fangs','golden_claws','household','membership','servitude') NOT NULL,
 title VARCHAR(90) NOT NULL,
 sort_order TINYINT UNSIGNED NOT NULL,
 UNIQUE KEY uq_order_rank_track_sort(track,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
INSERT INTO order_rank_catalog(code,track,title,sort_order) VALUES
('domina','leadership','Domina',1),
('grand_viper','leadership','Grand Viper',2),
('inner_council','leadership','Inner Council',3),
('hatchling','snakes','Hatchling',1),
('coil','snakes','Coil',2),
('whisper','snakes','Whisper',3),
('shadowkeeper','snakes','Shadowkeeper',4),
('high_serpent','snakes','High Serpent',5),
('fangling','fangs','Fangling',1),
('fang','fangs','Fang',2),
('viper','fangs','Viper',3),
('fangmaster','fangs','Fangmaster',4),
('high_fang','fangs','High Fang',5),
('gildling','golden_claws','Gildling',1),
('claw','golden_claws','Claw',2),
('goldkeeper','golden_claws','Goldkeeper',3),
('gilded_talon','golden_claws','Gilded Talon',4),
('high_claw','golden_claws','High Claw',5),
('keepers_apprentice','household','Keeper’s Apprentice',1),
('overseer','household','Overseer',2),
('master_of_chains','household','Master of Chains',3),
('high_steward','household','High Steward',4),
('freshscales','membership','Freshscales',1),
('voidscales','membership','Voidscales',2),
('unmarked','servitude','Unmarked',1),
('marked_thrall','servitude','Marked Thrall',2),
('bound_serpent','servitude','Bound Serpent',3),
('eclipse_attendant','servitude','Eclipse Attendant',4),
('silken_thrall','servitude','Silken Thrall',5),
('violet_keeper','servitude','Violet Keeper',6),
('serpents_chosen','servitude','Serpent’s Chosen',7),
('eclipsed_consort','servitude','Eclipsed Consort',8)
ON DUPLICATE KEY UPDATE track=VALUES(track),title=VALUES(title),sort_order=VALUES(sort_order);

CREATE TABLE IF NOT EXISTS account_order_ranks (
 account_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 track ENUM('leadership','snakes','fangs','golden_claws','household','membership') NOT NULL,
 rank_code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(account_id,track),
 CONSTRAINT fk_account_order_rank_owner FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE,
 CONSTRAINT fk_account_order_rank_catalog FOREIGN KEY(rank_code) REFERENCES order_rank_catalog(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS character_order_ranks (
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL PRIMARY KEY,
 rank_code VARCHAR(48) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT fk_character_order_rank_owner FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE,
 CONSTRAINT fk_character_order_rank_catalog FOREIGN KEY(rank_code) REFERENCES order_rank_catalog(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Exact existing Domina permissions are unambiguous; no other legacy role is guessed.
INSERT IGNORE INTO account_order_ranks(account_id,track,rank_code)
 SELECT id,'leadership','domina' FROM accounts WHERE account_role='domina';
-- Existing accounts without an Order membership title begin at Freshscales.
INSERT IGNORE INTO account_order_ranks(account_id,track,rank_code)
 SELECT id,'membership','freshscales' FROM accounts;
INSERT INTO schema_migrations(version) VALUES('016_order_hierarchy')
ON DUPLICATE KEY UPDATE version=VALUES(version);
