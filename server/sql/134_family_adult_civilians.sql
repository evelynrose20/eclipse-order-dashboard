-- A named civilian is a distinct profile linked to childhood history.
-- It does not increment settlement population or workforce (those are managed by civic simulation).
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_named_civilians (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 dependent_id BIGINT UNSIGNED NOT NULL,
 settlement_id BIGINT UNSIGNED NOT NULL,
 workplace_facility_id BIGINT UNSIGNED NULL,
 employment_state ENUM('seeking','employed','between_jobs','retired') NOT NULL DEFAULT 'seeking',
 wellbeing ENUM('settled','adjusting','needs_support') NOT NULL DEFAULT 'adjusting',
 public_update VARCHAR(500) NOT NULL DEFAULT '',
 transitioned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_named_civilian_dependent(dependent_id),
 INDEX ix_named_civilian_settlement(settlement_id),
 FOREIGN KEY(dependent_id) REFERENCES order_dependents(id) ON DELETE RESTRICT,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE RESTRICT,
 FOREIGN KEY(workplace_facility_id) REFERENCES world_industry_facilities(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('134_family_adult_civilians')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
