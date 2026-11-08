-- Education facilities and persistent school attainment (no population editing).
USE eclipse_order;
ALTER TABLE world_settlement_upgrades MODIFY COLUMN category ENUM('housing','defense','clinic','water','food_storage','insulation','public_works','school') NOT NULL;
CREATE TABLE IF NOT EXISTS world_settlement_education (
 settlement_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 attainment TINYINT UNSIGNED NOT NULL DEFAULT 20,
 FOREIGN KEY (settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 CONSTRAINT chk_settlement_attainment CHECK(attainment<=100)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO world_settlement_education(settlement_id,attainment)
 SELECT id,20 FROM world_settlements ON DUPLICATE KEY UPDATE settlement_id=VALUES(settlement_id);
INSERT INTO schema_migrations(version) VALUES('057_settlement_education') ON DUPLICATE KEY UPDATE version=VALUES(version);
