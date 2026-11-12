-- Persistent, protected chamber operations. Additive and safe to rerun.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_thrall_chamber (
 id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
 revision INT UNSIGNED NOT NULL DEFAULT 0,
 machine_status ENUM('offline','standby','running','maintenance') NOT NULL DEFAULT 'offline',
 upper_status ENUM('offline','ready','active','maintenance') NOT NULL DEFAULT 'offline',
 lower_status ENUM('offline','ready','active','maintenance') NOT NULL DEFAULT 'offline',
 upper_volume INT UNSIGNED NOT NULL DEFAULT 0,
 lower_volume INT UNSIGNED NOT NULL DEFAULT 0,
 upper_capacity INT UNSIGNED NOT NULL DEFAULT 1000,
 lower_capacity INT UNSIGNED NOT NULL DEFAULT 1000,
 notes VARCHAR(1200) NOT NULL DEFAULT '',
 updated_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_thrall_chamber_editor FOREIGN KEY(updated_by) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO order_thrall_chamber(id) VALUES(1);
CREATE TABLE IF NOT EXISTS order_thrall_chamber_log (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 action VARCHAR(36) NOT NULL,
 detail VARCHAR(600) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_chamber_log_created(created_at),
 CONSTRAINT fk_thrall_chamber_log_actor FOREIGN KEY(actor_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_thrall_chamber_batches (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 material ENUM('lacteal','secondary') NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 classification VARCHAR(80) NOT NULL DEFAULT 'Unclassified',
 notes VARCHAR(500) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_chamber_batch_created(created_at),
 CONSTRAINT fk_thrall_chamber_batch_actor FOREIGN KEY(created_by) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('061_thrall_chamber') ON DUPLICATE KEY UPDATE version=VALUES(version);
