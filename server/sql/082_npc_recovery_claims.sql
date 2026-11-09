-- Recovery claims for existing unclaimed towns and ruined holdings.
-- NPCs can propose restoration; command approval is required before any control change.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_recovery_claims (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 claimant_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 settlement_id BIGINT UNSIGNED NOT NULL,
 source_kind ENUM('npc_assessment','staff') NOT NULL DEFAULT 'npc_assessment',
 status ENUM('pending','postponed','approved','rejected','rp_event') NOT NULL DEFAULT 'pending',
 rationale VARCHAR(1500) NOT NULL,
 reviewed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 review_note VARCHAR(1500) NOT NULL DEFAULT '',
 reviewed_at TIMESTAMP NULL DEFAULT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY ix_recovery_review(status,created_at),
 KEY ix_recovery_target(settlement_id,claimant_id),
 FOREIGN KEY(claimant_id) REFERENCES order_factions(id),
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(reviewed_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('082_npc_recovery_claims')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
