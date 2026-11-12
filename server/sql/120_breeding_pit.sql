-- 120: Independent Brood Pit facility, separate from the Extraction Chamber and normal pregnancy.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS order_brood_facility (
 id TINYINT UNSIGNED PRIMARY KEY,
 incubator_capacity SMALLINT UNSIGNED NOT NULL DEFAULT 8,
 nursery_capacity SMALLINT UNSIGNED NOT NULL DEFAULT 30
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO order_brood_facility(id) VALUES(1);
CREATE TABLE IF NOT EXISTS order_brood_strains (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL UNIQUE,
 description VARCHAR(700) NOT NULL DEFAULT '',
 role ENUM('scout','assault','support') NOT NULL DEFAULT 'scout',
 incubation_days TINYINT UNSIGNED NOT NULL DEFAULT 2,
 maturation_days TINYINT UNSIGNED NOT NULL DEFAULT 2,
 hatch_yield TINYINT UNSIGNED NOT NULL DEFAULT 2,
 egg_stock INT UNSIGNED NOT NULL DEFAULT 0,
 last_cultivation_day DATE NULL,
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(created_by) REFERENCES accounts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_brood_host_permissions (
 character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
 allow_incubation TINYINT(1) NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_brood_incubations (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 strain_id BIGINT UNSIGNED NOT NULL,
 host_character_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 incubation_mode ENUM('vat','host') NOT NULL DEFAULT 'vat',
 started_at DATETIME NOT NULL,
 ready_at DATETIME NOT NULL,
 status ENUM('incubating','hatched','cancelled') NOT NULL DEFAULT 'incubating',
 notes VARCHAR(800) NOT NULL DEFAULT '',
 created_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX ix_brood_ready(status,ready_at),
 FOREIGN KEY(strain_id) REFERENCES order_brood_strains(id),
 FOREIGN KEY(host_character_id) REFERENCES characters(id) ON DELETE SET NULL,
 FOREIGN KEY(created_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_brood_cohorts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 incubation_id BIGINT UNSIGNED NOT NULL UNIQUE,
 strain_id BIGINT UNSIGNED NOT NULL,
 quantity INT UNSIGNED NOT NULL,
 mature_at DATETIME NOT NULL,
 status ENUM('growing','ready','deployed') NOT NULL DEFAULT 'growing',
 deployed_installation_id BIGINT UNSIGNED NULL,
 deployed_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(incubation_id) REFERENCES order_brood_incubations(id),
 FOREIGN KEY(strain_id) REFERENCES order_brood_strains(id),
 FOREIGN KEY(deployed_installation_id) REFERENCES world_military_installations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS order_brood_activity (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 action VARCHAR(40) NOT NULL,
 detail VARCHAR(600) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(actor_id) REFERENCES accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO order_brood_strains(name,description,role,incubation_days,maturation_days,hatch_yield,egg_stock) VALUES
 ('Umbral Stalker','Fast void-touched scouts for reconnaissance and ambushes.','scout',2,2,3,6),
 ('Voidscale Ravager','Armored assault beasts suited to frontline attacks.','assault',4,4,2,4),
 ('Aetherweaver','Aether-disrupting creatures for support detachments.','support',3,3,2,4)
 ON DUPLICATE KEY UPDATE name=VALUES(name);
INSERT INTO schema_migrations(version) VALUES('120_breeding_pit') ON DUPLICATE KEY UPDATE version=VALUES(version);
