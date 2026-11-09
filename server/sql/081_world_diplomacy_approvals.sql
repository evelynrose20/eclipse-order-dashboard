-- Narrative-safe diplomacy and war authorization. Fixed FFXIV locations remain canonical.
-- No triggers that change ownership or launch conflicts automatically.
USE eclipse_order;
CREATE TABLE IF NOT EXISTS world_faction_relations (
 faction_a VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 faction_b VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 tension TINYINT UNSIGNED NOT NULL DEFAULT 0,
 trust TINYINT UNSIGNED NOT NULL DEFAULT 50,
 last_incident_date DATE NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY(faction_a,faction_b),
 FOREIGN KEY(faction_a) REFERENCES order_factions(id) ON DELETE CASCADE,
 FOREIGN KEY(faction_b) REFERENCES order_factions(id) ON DELETE CASCADE,
 CONSTRAINT chk_world_relation_order CHECK(faction_a<faction_b)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_conflict_proposals (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 attacker_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 defender_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 target_settlement_id BIGINT UNSIGNED NULL,
 conflict_kind ENUM('border_dispute','raid','siege','war','territory_transfer','peace') NOT NULL,
 status ENUM('pending','approved','postponed','rejected','rp_event','completed','cancelled') NOT NULL DEFAULT 'pending',
 rationale VARCHAR(1500) NOT NULL,
 proposed_effect VARCHAR(1000) NOT NULL DEFAULT '',
 source_kind ENUM('npc_assessment','staff','war_outcome') NOT NULL DEFAULT 'staff',
 related_conflict_id BIGINT UNSIGNED NULL,
 reviewed_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
 review_note VARCHAR(1500) NOT NULL DEFAULT '',
 reviewed_at TIMESTAMP NULL DEFAULT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY ix_conflict_review(status,created_at),
 KEY ix_conflict_parties(attacker_id,defender_id),
 FOREIGN KEY(attacker_id) REFERENCES order_factions(id),
 FOREIGN KEY(defender_id) REFERENCES order_factions(id),
 FOREIGN KEY(target_settlement_id) REFERENCES world_settlements(id) ON DELETE SET NULL,
 FOREIGN KEY(reviewed_by) REFERENCES accounts(id),
 CONSTRAINT chk_conflict_different_parties CHECK(attacker_id<>defender_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_authorized_conflicts (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 proposal_id BIGINT UNSIGNED NOT NULL UNIQUE,
 attacker_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 defender_id VARCHAR(45) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 target_settlement_id BIGINT UNSIGNED NULL,
 status ENUM('authorized','active','concluded','cancelled') NOT NULL DEFAULT 'authorized',
 authorized_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 authorized_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 ended_at TIMESTAMP NULL DEFAULT NULL,
 FOREIGN KEY(proposal_id) REFERENCES world_conflict_proposals(id),
 FOREIGN KEY(attacker_id) REFERENCES order_factions(id),
 FOREIGN KEY(defender_id) REFERENCES order_factions(id),
 FOREIGN KEY(target_settlement_id) REFERENCES world_settlements(id) ON DELETE SET NULL,
 FOREIGN KEY(authorized_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_plot_protection (
 settlement_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
 protection ENUM('major_changes','all_conflict') NOT NULL DEFAULT 'major_changes',
 explanation VARCHAR(500) NOT NULL DEFAULT '',
 updated_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(settlement_id) REFERENCES world_settlements(id) ON DELETE CASCADE,
 FOREIGN KEY(updated_by) REFERENCES accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS world_conflict_decision_log (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 proposal_id BIGINT UNSIGNED NOT NULL,
 actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 decision VARCHAR(40) NOT NULL,
 note VARCHAR(1500) NOT NULL DEFAULT '',
 decided_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(proposal_id) REFERENCES world_conflict_proposals(id),
 FOREIGN KEY(actor_id) REFERENCES accounts(id),
 KEY ix_conflict_decision_proposal(proposal_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO schema_migrations(version) VALUES('081_world_diplomacy_approvals')
 ON DUPLICATE KEY UPDATE version=VALUES(version);
